import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';

import 'prepare.dart';
import 'registry.dart';

const startupTimeout = Duration(seconds: 45);
const executionTimeout = Duration(seconds: 4);
const maxResponseBytes = 8 * 1024 * 1024;

String repoPath = 'structures';
final clients = <Client>{};

String _studentPath(String student, String kind) =>
    '${Directory(repoPath).absolute.path}/$student/${specFor(kind).filename}';

String stamp(String student,String kind){
  final f=File(_studentPath(student,kind));
  if(!f.existsSync()) return 'missing';
  return studentStamp(f);
}

List<Map<String,Object?>> catalog(){
  final root=Directory(repoPath);
  if(!root.existsSync())return [];
  final result=<Map<String,Object?>>[];
  final dirs=root.listSync(followLinks:false).whereType<Directory>().toList()
    ..sort((a,b)=>a.path.compareTo(b.path));
  for(final directory in dirs){
    final student=directory.uri.pathSegments.where((s)=>s.isNotEmpty).last;
    if(!RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$').hasMatch(student))continue;
    final available=[for(final spec in structures)
      if(File('${directory.path}/${spec.filename}').existsSync()) spec.id];
    if(available.isNotEmpty)result.add({'id':student,'structures':available});
  }
  return result;
}

void broadcastCatalog(){
  final json=jsonEncode({'type':'catalog','students':catalog(), 'default':lastSelection()});
  for(final client in clients)client.sendRaw(json);
}

Map<String,String> lastSelection(){
  try {
    final data=jsonDecode(File('.runtime/selection.json').readAsStringSync());
    if(data is Map && data['student'] is String && data['structure'] is String){
      return {'student':data['student'] as String,'structure':data['structure'] as String};
    }
  }catch(_){ }
  return {'student':'example','structure':'list'};
}
void saveSelection(String student,String kind){
  Directory('.runtime').createSync(recursive:true);
  File('.runtime/selection.json').writeAsStringSync(jsonEncode({'student':student,'structure':kind}));
}

class StudentWorker {
  final Process process;
  final _responses=Queue<Completer<Map<String,dynamic>>>();
  final _backlog=Queue<Map<String,dynamic>>();
  String _buffer='';
  String diagnostic='';
  bool dead=false;
  late final StreamSubscription<String> _out;
  late final StreamSubscription<List<int>> _err;

  StudentWorker(this.process){
    _out=utf8.decoder.bind(process.stdout).listen((chunk){
      if(dead)return;
      _buffer+=chunk;
      if(_buffer.length>maxResponseBytes){
        _fail(StateError('Execution trace exceeded 8 MB. Worker terminated.'));
        return;
      }
      while(true){
        final n=_buffer.indexOf('\n');if(n<0)break;
        final line=_buffer.substring(0,n).trim();_buffer=_buffer.substring(n+1);
        if(line.isEmpty)continue;
        Map<String,dynamic> message;
        try{
          final data=jsonDecode(line);
          if(data is! Map<String,dynamic>) throw const FormatException('Invalid worker reply');
          message=data;
        }catch(_){
          // Student print() output is diagnostic, not a protocol response.
          diagnostic='${diagnostic.length>10000?diagnostic.substring(diagnostic.length-10000):diagnostic}$line\n';
          continue;
        }
        if(_responses.isNotEmpty){final pending=_responses.removeFirst();if(!pending.isCompleted)pending.complete(message);}
        else _backlog.add(message);
      }
    },onError:(Object e)=>_fail(StateError('Worker stdout failed: $e')),
      onDone:()=>_fail(StateError('Student worker exited. $diagnostic')));
    _err=process.stderr.listen((chunk){
      diagnostic+=utf8.decode(chunk,allowMalformed:true);
      if(diagnostic.length>16000)diagnostic=diagnostic.substring(diagnostic.length-16000);
    });
    unawaited(process.exitCode.then((code){
      _fail(StateError('Student worker exited with status $code. $diagnostic'));
    }));
  }
  Future<Map<String,dynamic>> next(Duration limit) async {
    if(dead)throw StateError('Student worker is not running. $diagnostic');
    if(_backlog.isNotEmpty)return _backlog.removeFirst();
    final pending=Completer<Map<String,dynamic>>();_responses.add(pending);
    try{return await pending.future.timeout(limit);}on TimeoutException {
      kill();throw TimeoutException('Student code exceeded ${limit.inSeconds}s. Worker stopped; previous trace retained.');
    }
  }
  Future<Map<String,dynamic>> request(Map<String,dynamic> message) async {
    if(dead)throw StateError('Worker is not available; choose the implementation again.');
    final response=next(executionTimeout);
    process.stdin.writeln(jsonEncode(message));
    await process.stdin.flush();
    return response;
  }
  void _fail(Object error){
    if(dead)return; dead=true;
    while(_responses.isNotEmpty){final c=_responses.removeFirst();if(!c.isCompleted)c.completeError(error);}
    process.kill(ProcessSignal.sigkill);
  }
  void kill(){_fail(StateError('Worker stopped.'));unawaited(_out.cancel());unawaited(_err.cancel());}
}

class Client {
  final WebSocket socket;
  StudentWorker? worker;
  String? student,kind,currentStamp;
  bool closed=false;
  bool refreshing=false;
  int selectionEpoch=0;
  Client(this.socket);
  void send(Map<String,dynamic> data)=>sendRaw(jsonEncode(data));
  void sendRaw(String data){if(!closed && socket.readyState==WebSocket.open)socket.add(data);}
  void error(Object e){send({'type':'error','message':e.toString().replaceFirst('FormatException: ','').replaceFirst('Bad state: ','')});}
  void markChanged(){
    if(refreshing || student==null || kind==null)return;
    final next=stamp(student!,kind!);
    if(next==currentStamp)return;
    currentStamp=next;
    refreshing=true;
    worker?.kill();worker=null;
    send({'type':'sourceChanged','message':'Student source changed; checking Dart…'});
    unawaited(select(student!,kind!).whenComplete(()=>refreshing=false));
  }
  Future<void> select(String selected,String structure) async {
    final epoch=++selectionEpoch;
    try{
      if(!catalog().any((s)=>s['id']==selected && (s['structures'] as List).contains(structure))){
        throw FormatException('Implementation not found: $selected / $structure');
      }
      worker?.kill();worker=null;
      student=selected;kind=structure;currentStamp=stamp(selected,structure);
      final recompiling=workerNeedsBuild(selected,structure,repoPath);
      send({'type':'building','recompiling':recompiling,
        'message':recompiling?'Compiling $selected / $structure…':
          'Starting cached $selected / $structure…'});
      final path=await prepare(selected,structure,repoPath);
      // If a later selection overtook this compilation, do not start its worker.
      if(closed || epoch!=selectionEpoch || currentStamp!=stamp(selected,structure))return;
      final process=await Process.start(Platform.resolvedExecutable,[path],
        workingDirectory:Directory.current.path);
      final newWorker=StudentWorker(process);
      final hello=await newWorker.next(startupTimeout);
      if(closed || epoch!=selectionEpoch){newWorker.kill();return;}
      if(hello['type']!='hello')throw StateError('Student runner failed to initialize: $hello');
      worker=newWorker;
      saveSelection(selected,structure);
      send({...hello,'student':selected});
    }catch(e){
      if(closed)return;
      if(epoch==selectionEpoch){
        stderr.writeln('[sandbox] Failed to prepare $selected/$structure:\n$e');
        worker?.kill();worker=null;error(e);
      }
    }
  }
  Future<void> handle(Map<String,dynamic> message) async {
    if(message['action']=='ping'){send({'type':'pong'});return;}
    if(message['action']=='select'){
      final requestedStudent=message['student'];
      final requestedStructure=message['structure'];
      final selected=requestedStudent is String ? requestedStudent : lastSelection()['student']!;
      final chosen=requestedStructure is String ? requestedStructure : 'list';
      await select(selected,chosen);return;
    }
    final runner=worker;
    if(runner==null){error('Select a valid student implementation first.');return;}
    try{
      final result=await runner.request(message);
      if(result['type']=='error'){
        runner.kill();if(identical(worker,runner))worker=null;
        send({'type':'error','message':'${result['message']} · Runner stopped; choose the implementation again to reset it.'});
      }else send(result);
    }catch(e){
      stderr.writeln('[sandbox] Student execution failed ($student/$kind):\n$e');
      runner.kill();if(identical(worker,runner))worker=null;
      error(e);
    }
  }
  void close(){closed=true;worker?.kill();worker=null;}
}

Future<void> main(List<String> args) async {
  var port=8081,openBrowser=true;
  for(var i=0;i<args.length;i++){
    switch(args[i]){
      case '--no-open':openBrowser=false;break;
      case '--port':if(i+1>=args.length)throw FormatException('Missing --port value');port=int.parse(args[++i]);break;
      case '--students':if(i+1>=args.length)throw FormatException('Missing --students path');repoPath=args[++i];break;
      default:throw FormatException('Usage: ./run [--port PORT] [--no-open] [--students PATH]');
    }
  }
  if(!Directory(repoPath).existsSync()){
    throw FormatException('Student repository not found: $repoPath');
  }
  final server=await HttpServer.bind(InternetAddress.loopbackIPv4,port);
  final url='http://127.0.0.1:${server.port}/';
  stdout.writeln('Data Structure Sandbox · $url · Students: ${Directory(repoPath).absolute.path}');
  if(openBrowser)unawaited(_openBrowser(url));
  var fingerprint=jsonEncode(catalog());
  Timer.periodic(const Duration(milliseconds:700),(_){
    final next=jsonEncode(catalog());
    if(next!=fingerprint){fingerprint=next;broadcastCatalog();}
    for(final client in [...clients])client.markChanged();
  });
  await for(final request in server){unawaited(_handleRequest(request));}
}

Future<void> _handleRequest(HttpRequest request) async {
  try{
    if(request.uri.path=='/ws'&&WebSocketTransformer.isUpgradeRequest(request)){
      final socket=await WebSocketTransformer.upgrade(request);
      socket.pingInterval=const Duration(seconds:20);
      final client=Client(socket);clients.add(client);
      client.send({'type':'catalog','students':catalog(),'default':lastSelection()});
      try{
        await for(final raw in socket){
          try{
            final decoded=jsonDecode(raw as String);
            if(decoded is! Map<String,dynamic>)throw FormatException('Expected JSON command');
            await client.handle(decoded);
          }catch(e){client.error(e);}
        }
      }finally{client.close();clients.remove(client);}
      return;
    }
    if(request.method!='GET'&&request.method!='HEAD'){
      request.response.statusCode=HttpStatus.methodNotAllowed;await request.response.close();return;
    }
    final path=switch(request.uri.path){
      '/' || '/index.html'=>'web/index.html',
      '/style.css'=>'web/style.css',
      '/app.js'=>'web/app.js',
      _=>null,
    };
    if(path==null){request.response.statusCode=HttpStatus.notFound;await request.response.close();return;}
    final file=File(path);
    request.response.headers
      ..contentType=path.endsWith('.html')?ContentType.html:path.endsWith('.css')?
        ContentType('text','css',charset:'utf-8'):ContentType('application','javascript',charset:'utf-8')
      ..set(HttpHeaders.cacheControlHeader,'no-store');
    if(request.method=='GET')await request.response.addStream(file.openRead());
    await request.response.close();
  }catch(e){stderr.writeln('Browser request error: $e');
    try{request.response.statusCode=HttpStatus.internalServerError;await request.response.close();}catch(_){}}
}
Future<void> _openBrowser(String url) async {
  await Future<void>.delayed(const Duration(milliseconds:350));
  try{
    if(Platform.isMacOS)await Process.run('open',[url]);
    else if(Platform.isWindows)await Process.run('cmd',['/c','start','',url]);
    else await Process.run('xdg-open',[url]);
  }catch(_){ }
}
