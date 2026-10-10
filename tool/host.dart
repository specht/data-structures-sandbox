import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';

import 'source_editor.dart';
import 'prepare.dart';
import 'cache_cleanup.dart';
import 'instrument_client.dart';
import 'registry.dart';
import 'student_validation.dart';

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

// A node-based heap adds pointer bookkeeping without clarifying the heap ADT;
// keep the legacy runtime support internal, but remove it from classroom use.
Iterable<StructureSpec> visibleStructures() =>
    structures.where((spec)=>spec.id!='node_heap');

List<Map<String,Object?>> catalog(){
  final root=Directory(repoPath);
  if(!root.existsSync())return [];
  final result=<Map<String,Object?>>[];
  final dirs=root.listSync(followLinks:false).whereType<Directory>().toList()
    ..sort((a,b)=>a.path.compareTo(b.path));
  for(final directory in dirs){
    final student=directory.uri.pathSegments.where((s)=>s.isNotEmpty).last;
    if(!RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$').hasMatch(student))continue;
    final available=[for(final spec in visibleStructures())
      if(File('${directory.path}/${spec.filename}').existsSync()) spec.id];
    if(available.isNotEmpty)result.add({'id':student,'structures':available});
  }
  return result;
}

void broadcastCatalog(){
  final json=jsonEncode({'type':'catalog','students':catalog(), 'default':lastSelection()});
  for(final client in clients)client.sendRaw(json);
}

class ProgressJob {
  final String student, kind, revision;
  const ProgressJob(this.student,this.kind,this.revision);
}

class ProgressResult {
  final int passed, total;
  final String? error;
  final bool stale;
  const ProgressResult(this.passed,this.total,{this.error,this.stale=false});
}

Map<String,dynamic> _loadProgressCache(){
  try{
    final decoded=jsonDecode(File('.runtime/progress.json').readAsStringSync());
    if(decoded is Map){
      return decoded.map((key,value)=>MapEntry(key.toString(),value));
    }
  }catch(_){ }
  return <String,dynamic>{};
}

final progressCache=_loadProgressCache();
Future<void>? progressSweep;
String progressStatusMessage='Open class progress to check current implementations.';
String? progressStatusStudent,progressStatusStructure;
const progressCacheVersion=2;

String _progressKey(String student,String kind)=>'$student/$kind';

int progressCheckCount(String kind)=>validationCases(kind)
    .fold<int>(0,(total,scenario)=>total+scenario.calls.length);

Map<String,dynamic>? _cachedProgress(String student,String kind,String revision){
  final raw=progressCache[_progressKey(student,kind)];
  if(raw is Map && raw['version']==progressCacheVersion &&
      raw['revision']==revision){
    return Map<String,dynamic>.from(raw);
  }
  return null;
}

void _saveProgressCache(){
  Directory('.runtime').createSync(recursive:true);
  File('.runtime/progress.json').writeAsStringSync(jsonEncode(progressCache));
}

void recordProgress(
  String student,
  String kind,
  String revision,
  int passed,
  int total, {
  String? error,
}){
  final safeError=error==null?null:
      (error.length>600?error.substring(0,600):error);
  progressCache[_progressKey(student,kind)]={
    'version':progressCacheVersion,
    'revision':revision,
    'passed':passed,
    'total':total,
    'testedAt':DateTime.now().toUtc().toIso8601String(),
    if(safeError!=null)'error':safeError,
  };
  _saveProgressCache();
}

Map<String,Object?> progressSnapshot(){
  final rows=<Map<String,Object?>>[];
  for(final entry in catalog()){
    final student=entry['id'] as String;
    final available=(entry['structures'] as List).whereType<String>().toSet();
    final cells=<String,Object?>{};
    for(final spec in visibleStructures()){
      if(!available.contains(spec.id)){
        cells[spec.id]={'state':'missing'};
        continue;
      }

      final revision=stamp(student,spec.id);
      final cached=_cachedProgress(student,spec.id,revision);
      if(cached==null){
        cells[spec.id]={
          'state':'pending',
          'tested':false,
          'total':progressCheckCount(spec.id),
        };
        continue;
      }

      final passed=(cached['passed'] as num?)?.toInt()??0;
      final total=(cached['total'] as num?)?.toInt()??0;
      cells[spec.id]={
        'state':total>0&&passed==total?'complete':'pending',
        'tested':true,
        'passed':passed,
        'total':total,
        if(cached['error'] is String)'error':cached['error'],
      };
    }
    rows.add({'id':student,'cells':cells});
  }

  return {
    'type':'progressSnapshot',
    'structures':[
      for(final spec in visibleStructures())
        {'id':spec.id,'label':spec.label}
    ],
    'students':rows,
  };
}

List<ProgressJob> pendingProgressJobs(){
  final result=<ProgressJob>[];
  for(final entry in catalog()){
    final student=entry['id'] as String;
    final available=(entry['structures'] as List).whereType<String>();
    for(final kind in available){
      final revision=stamp(student,kind);
      if(_cachedProgress(student,kind,revision)==null){
        result.add(ProgressJob(student,kind,revision));
      }
    }
  }
  return result;
}

void broadcastProgressSnapshot(){
  final json=jsonEncode(progressSnapshot());
  for(final client in clients)client.sendRaw(json);
}

void broadcastProgressStatus(String message,{ProgressJob? current}){
  progressStatusMessage=message;
  progressStatusStudent=current?.student;
  progressStatusStructure=current?.kind;
  final json=jsonEncode({'type':'progressStatus','message':message,
    if(current!=null)'student':current.student,
    if(current!=null)'structure':current.kind});
  for(final client in clients)client.sendRaw(json);
}

Map<String,String> lastSelection(){
  try {
    final data=jsonDecode(File('.runtime/selection.json').readAsStringSync());
    if(data is Map && data['student'] is String && data['structure'] is String){
      return {'student':data['student'] as String,'structure':data['structure'] as String};
    }
  }catch(_){ }
  return {'student':'','structure':''};
}
void saveSelection(String student,String kind){
  Directory('.runtime').createSync(recursive:true);
  File('.runtime/selection.json').writeAsStringSync(jsonEncode({'student':student,'structure':kind}));
}

class StudentExecutionTimeout implements Exception {
  final Duration limit;
  final int? line;
  final int? traceIndex;
  final List<Map<String,Object?>> console;
  const StudentExecutionTimeout(this.limit,{this.line,this.traceIndex,
    this.console=const []});
  String get message=>'Student code timed out after ${limit.inSeconds} seconds.';
  @override String toString()=>line==null?message:
    '$message Last active source line: $line.';
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
  final List<Map<String,Object?>> _console=[];
  int? _lastLine,_lastTraceIndex;
  bool _consoleTruncated=false;

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
          _addConsole({'kind':'stdout','text':line,
            if(_lastLine!=null)'line':_lastLine,
            if(_lastTraceIndex!=null)'traceIndex':_lastTraceIndex});
          continue;
        }
        if(message['type']=='executionProgress'){
          if(message['line'] is int)_lastLine=message['line'] as int;
          if(message['traceIndex'] is int)_lastTraceIndex=message['traceIndex'] as int;
          continue;
        }
        if(message['type']=='studentOutput'){
          _addConsole({'kind':message['kind']=='warning'?'warning':'stdout',
            'text':message['text']?.toString()??'',
            if(message['line'] is int)'line':message['line'],
            if(message['traceIndex'] is int)'traceIndex':message['traceIndex']});
          continue;
        }
        final output=_takeConsole();
        if(output.isNotEmpty)message['console']=output;
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
  void _addConsole(Map<String,Object?> entry){
    if(_console.length<250){_console.add(entry);return;}
    if(!_consoleTruncated){
      _consoleTruncated=true;
      _console.add({'kind':'warning','text':'Further console output was truncated.',
        if(_lastLine!=null)'line':_lastLine,
        if(_lastTraceIndex!=null)'traceIndex':_lastTraceIndex});
    }
  }
  List<Map<String,Object?>> _takeConsole(){
    final result=[for(final entry in _console)Map<String,Object?>.from(entry)];
    _console.clear();_consoleTruncated=false;return result;
  }
  void _beginRequest(){
    _console.clear();_consoleTruncated=false;_lastLine=null;_lastTraceIndex=null;
  }
  Future<Map<String,dynamic>> next(Duration limit,{bool execution=false}) async {
    if(dead)throw StateError('Student worker is not running. $diagnostic');
    if(_backlog.isNotEmpty)return _backlog.removeFirst();
    final pending=Completer<Map<String,dynamic>>();_responses.add(pending);
    try{return await pending.future.timeout(limit);}on TimeoutException {
      _responses.remove(pending);
      final output=_takeConsole(),line=_lastLine,traceIndex=_lastTraceIndex;
      kill();
      if(execution)throw StudentExecutionTimeout(limit,line:line,
        traceIndex:traceIndex,console:output);
      throw TimeoutException('Student worker did not start within ${limit.inSeconds}s.');
    }
  }
  Future<Map<String,dynamic>> request(Map<String,dynamic> message) async {
    if(dead)throw StateError('Worker is not available; choose the implementation again.');
    _beginRequest();
    final response=next(executionTimeout,execution:true);
    process.stdin.writeln(jsonEncode({...message,'_diagnostics':true}));
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

final progressRuns=<String,Future<ProgressResult>>{};

Future<ProgressResult> _runProgressValidation(ProgressJob job) async {
  final scenarios=validationCases(job.kind);
  final totalChecks=scenarios.fold<int>(
      0,(total,scenario)=>total+scenario.calls.length);
  StudentWorker? runner;
  String? runError;

  try{
    final path=await prepare(job.student,job.kind,repoPath);
    if(stamp(job.student,job.kind)!=job.revision){
      return ProgressResult(0,totalChecks,stale:true);
    }

    Future<StudentWorker> startWorker() async {
      final process=await Process.start(
        Platform.resolvedExecutable,
        [path],
        workingDirectory:Directory.current.path,
      );
      final fresh=StudentWorker(process);
      final hello=await fresh.next(startupTimeout);
      if(hello['type']!='hello'){
        fresh.kill();
        throw StateError('Test worker failed to initialize.');
      }
      return fresh;
    }

    var passedChecks=0;
    for(final scenario in scenarios){
      var scenarioPassed=true;
      try{
        runner ??= await startWorker();

        final cleared=await runner.request({'action':'reset'});
        if(cleared['type']!='trace'){
          throw StateError('Could not reset the test instance.');
        }

        for(final call in scenario.calls){
          final reply=await runner.request({
            ...call.toRequest(),
            'action':'validateCall',
          });
          if(reply['type']=='validationCall'&&reply['ok']==true){
            passedChecks++;
          }else{
            scenarioPassed=false;
            break;
          }
        }
      }catch(error){
        scenarioPassed=false;
        runError??=error.toString();
      }

      if(!scenarioPassed){
        // A broken or timed-out scenario gets a fresh process for the next group.
        runner?.kill();
        runner=null;
      }
    }

    return ProgressResult(passedChecks,totalChecks,error:runError);
  }catch(error){
    return ProgressResult(0,totalChecks,error:error.toString());
  }finally{
    runner?.kill();
  }
}

Future<ProgressResult> validateProgressJob(ProgressJob job){
  final key='${job.student}\u0000${job.kind}\u0000${job.revision}';
  final existing=progressRuns[key];
  if(existing!=null)return existing;

  late final Future<ProgressResult> future;
  future=_runProgressValidation(job).whenComplete((){
    if(identical(progressRuns[key],future))progressRuns.remove(key);
  });
  progressRuns[key]=future;
  return future;
}

Future<void> runProgressSweep(List<ProgressJob> jobs) async {
  for(var index=0;index<jobs.length;index++){
    final job=jobs[index];
    broadcastProgressStatus(
      'Checking ${index+1} / ${jobs.length}: '
      '${job.student} · ${specFor(job.kind).label}',
      current:job,
    );

    final result=await validateProgressJob(job);
    if(!result.stale&&stamp(job.student,job.kind)==job.revision){
      recordProgress(
        job.student,
        job.kind,
        job.revision,
        result.passed,
        result.total,
        error:result.error,
      );
    }
    broadcastProgressSnapshot();
  }

  broadcastProgressStatus('Class progress is up to date.');
}

void requestProgress(Client client){
  client.send(progressSnapshot());
  client.send({
    'type':'progressStatus',
    'message':progressStatusMessage,
    if(progressStatusStudent!=null)'student':progressStatusStudent,
    if(progressStatusStructure!=null)'structure':progressStatusStructure,
  });

  if(progressSweep!=null)return;

  final jobs=pendingProgressJobs();
  if(jobs.isEmpty){
    client.send({
      'type':'progressStatus',
      'message':'Class progress is up to date.',
    });
    return;
  }

  late final Future<void> sweep;
  sweep=runProgressSweep(jobs).whenComplete((){
    if(identical(progressSweep,sweep))progressSweep=null;
  });
  progressSweep=sweep;
}

class Client {
  final WebSocket socket;
  StudentWorker? worker;
  StudentWorker? validationWorker;
  String? preparedPath;
  bool validationRunning=false;
  int validationEpoch=0;
  String? student,kind,currentStamp;
  bool closed=false;
  bool refreshing=false;
  int selectionEpoch=0;
  String? _pendingSelectionKey;
  Future<void>? _pendingSelection;
  Client(this.socket);

  void cancelValidation() {
    validationEpoch++;
    validationWorker?.kill();
    validationWorker=null;
    validationRunning=false;
  }
  void send(Map<String,dynamic> data)=>sendRaw(jsonEncode(data));
  void sendRaw(String data){if(!closed && socket.readyState==WebSocket.open)socket.add(data);}
  void error(Object e){
    if(e is StudentDiagnosticsException && student!=null && kind!=null){
      send({'type':'compileDiagnostics', 'student':student, 'structure':kind,
        'revision':currentStamp, 'message':e.message,
        'diagnostics':e.diagnostics});
      return;
    }
    send({'type':'error','message':e.toString().replaceFirst('FormatException: ','').replaceFirst('Bad state: ','')});
  }
  void markChanged(){
    if(refreshing || student==null || kind==null)return;
    final detected = Stopwatch()..start();
    final next=stamp(student!,kind!);
    if(next==currentStamp)return;
    buildProfile('$student/$kind', 'watcher stamp', detected.elapsed);
    currentStamp=next;
    refreshing=true;
    worker?.kill();worker=null;
    send({'type':'sourceChanged','message':'Student source changed; checking Dart…'});
    unawaited(select(student!,kind!, detectedAt:detected)
      .whenComplete(()=>refreshing=false));
  }
  Future<void> select(String selected,String structure,{Stopwatch? detectedAt}) {
    // A save notification and a concurrent select for the SAME revision
    // must join one startup, rather than each starting its own worker. Other
    // browser sessions retain their intentionally independent worker state.
    final key = '$selected\u0000$structure\u0000${stamp(selected,structure)}';
    final existing = _pendingSelection;
    if(existing!=null && _pendingSelectionKey==key) return existing;
    final pending = _selectOnce(selected,structure,detectedAt:detectedAt);
    _pendingSelectionKey = key;
    _pendingSelection = pending;
    unawaited(pending.then((_) {
      if(identical(_pendingSelection,pending)) {
        _pendingSelection=null;_pendingSelectionKey=null;
      }
    },onError:(Object error, StackTrace trace) {
      if(identical(_pendingSelection,pending)) {
        _pendingSelection=null;_pendingSelectionKey=null;
      }
    }));
    return pending;
  }
  Future<void> _selectOnce(String selected,String structure,{Stopwatch? detectedAt}) async {
    final selection = Stopwatch()..start();
    final subject = '$selected/$structure';
    final epoch=++selectionEpoch;
    cancelValidation();
    preparedPath=null;
    try{
      if(!catalog().any((s)=>s['id']==selected && (s['structures'] as List).contains(structure))){
        throw FormatException('Implementation not found: $selected / $structure');
      }
      worker?.kill();worker=null;
      student=selected;kind=structure;currentStamp=stamp(selected,structure);
      final probe=Stopwatch()..start();
      final recompiling=workerNeedsBuild(selected,structure,repoPath);
      buildProfile(subject, 'cache probe', probe.elapsed);
      send({'type':'building','recompiling':recompiling,
        'message':recompiling?'Compiling $selected / $structure…':
          'Starting cached $selected / $structure…'});
      final preparing=Stopwatch()..start();
      final path=await prepare(selected,structure,repoPath);
      buildProfile(subject, 'prepare await', preparing.elapsed);
      // If a later selection overtook this compilation, do not start its worker.
      if(closed || epoch!=selectionEpoch || currentStamp!=stamp(selected,structure))return;
      final launching=Stopwatch()..start();
      final process=await Process.start(Platform.resolvedExecutable,[path],
        workingDirectory:Directory.current.path);
      buildProfile(subject, 'worker process start', launching.elapsed);
      final newWorker=StudentWorker(process);
      final helloTimer=Stopwatch()..start();
      final hello=await newWorker.next(startupTimeout);
      buildProfile(subject, 'worker hello', helloTimer.elapsed);
      if(closed || epoch!=selectionEpoch){newWorker.kill();return;}
      if(hello['type']!='hello')throw StateError('Student runner failed to initialize: $hello');
      worker=newWorker;
      preparedPath=path;
      saveSelection(selected,structure);
      send({...hello,'student':selected,'validationRevision':path});
    }catch(e){
      if(closed)return;
      if(epoch==selectionEpoch){
        stderr.writeln('[sandbox] Failed to prepare $selected/$structure:\n$e');
        worker?.kill();worker=null;error(e);
      }
    }finally{
      buildProfile(subject, 'selection to ready (or exit)', selection.elapsed);
      if(detectedAt!=null)
        buildProfile(subject, 'detected change to ready (or exit)', detectedAt.elapsed);
    }
  }
  Future<void> validate() async {
    if(validationRunning) return;
    final path=preparedPath, selectedKind=kind, selectedStamp=currentStamp;
    if(path==null || selectedKind==null || worker==null) {
      send({'type':'validationError','message':'Wait for the selected implementation to compile.'});
      return;
    }
    final scenarios=validationCases(selectedKind);
    final epoch=++validationEpoch;
    validationRunning=true;
    send({'type':'validationStart','tests':[for(final test in scenarios)test.name]});

    bool current() => !closed && validationEpoch==epoch &&
        currentStamp==selectedStamp && kind==selectedKind &&
        student!=null && stamp(student!,selectedKind)==selectedStamp;
    Future<StudentWorker> startIsolated() async {
      final process=await Process.start(Platform.resolvedExecutable,[path],
        workingDirectory:Directory.current.path);
      final fresh=StudentWorker(process);
      if(!current()) {fresh.kill();throw StateError('Validation cancelled.');}
      validationWorker=fresh;
      try {
        final hello=await fresh.next(startupTimeout);
        if(hello['type']!='hello') throw StateError('Test worker failed to initialize.');
        if(!current()) throw StateError('Validation cancelled.');
        return fresh;
      } catch (_) {
        fresh.kill();
        if(identical(validationWorker,fresh))validationWorker=null;
        rethrow;
      }
    }

    var passed=0;
    var passedChecks=0;
    final totalChecks=scenarios.fold<int>(
        0,(total,scenario)=>total+scenario.calls.length);
    try {
      for(var index=0;index<scenarios.length;index++) {
        if(!current()) return;
        final scenario=scenarios[index];
        send({'type':'validationRunning','index':index,'name':scenario.name});
        String? failure;
        String? failingCall;
        final steps=<Map<String,Object?>>[];
        try {
          final isolated=validationWorker ?? await startIsolated();
          if(!current()) return;
          final cleared=await isolated.request({'action':'reset'});
          if(cleared['type']!='trace') throw StateError('Could not reset the test instance.');
          for(final call in scenario.calls) {
            if(!current()) return;
            failingCall=call.label;
            final reply=await isolated.request({
              ...call.toRequest(),'action':'validateCall',
            });
            if(reply['type']=='error') {
              failure='Student code raised an error: ${reply['message']}';
              steps.add({'call':failingCall,'passed':false,'message':failure});
              break;
            }
            if(reply['type']!='validationCall') {
              failure='Invalid response from the test worker.';
              steps.add({'call':failingCall,'passed':false,'message':failure});
              break;
            }
            steps.add({'call':failingCall,'passed':reply['ok']==true,
              'expectedReturn':reply['expectedReturn'],
              'actualReturn':reply['actualReturn'],
              'returnIsVoid':reply['returnIsVoid'],
              'notExecuted':reply['notExecuted']==true,
              'contentsComparedAsUnordered':reply['contentsComparedAsUnordered'],
              'expectedContents':reply['expectedContents'],
              'actualContents':reply['actualContents'],
              'checks':reply['checks']});
            if(reply['ok']==true)passedChecks++;
            if(reply['ok']!=true) {
              failure=reply['message']?.toString() ?? 'The public contract was not met.';
              break;
            }
          }
        } catch (error) {
          if(!current()) return;
          failure='${failingCall ?? scenario.name}: $error';
          steps.add({'call':failingCall ?? scenario.name,
            'passed':false,'message':'Student code or test worker threw: $error'});
        }
        if(!current()) return;
        if(failure==null)passed++;
        else {
          // A failing or timed-out group cannot contaminate the next group.
          validationWorker?.kill();validationWorker=null;
        }
        send({'type':'validationResult','index':index,'name':scenario.name,
          'passed':failure==null,'message':failure,'steps':steps,
          'completed':index+1,'total':scenarios.length,'passedCount':passed});
      }
      if(current()){
        send({
          'type':'validationDone',
          'passed':passed,
          'total':scenarios.length,
        });

        final selectedStudent=student;
        if(selectedStudent!=null&&selectedStamp!=null){
          recordProgress(
            selectedStudent,
            selectedKind,
            selectedStamp,
            passedChecks,
            totalChecks,
          );
          broadcastProgressSnapshot();
        }
      }
    } catch (error) {
      if(current())send({'type':'validationError','message':'Test runner failed: $error'});
    } finally {
      // Do not terminate a newer validation run after an asynchronous cancellation.
      if(validationEpoch==epoch) {
        validationWorker?.kill();validationWorker=null;
        validationRunning=false;
      }
    }
  }

  Future<void> handle(Map<String,dynamic> message) async {
    if(message['action']=='ping'){send({'type':'pong'});return;}
    if(message['action']=='progressOverview'){requestProgress(this);return;}
    if(message['action']=='validate') {unawaited(validate());return;}
    if(message['action']=='select'){
      final requestedStudent=message['student'];
      final requestedStructure=message['structure'];
      final selected=requestedStudent is String ? requestedStudent : lastSelection()['student']!;
      final chosen=requestedStructure is String ? requestedStructure : 'list';
      await select(selected,chosen);return;
    }
    if(message['action']=='formatSource') {
      final requestId=message['requestId'];
      final selected=student, selectedKind=kind;
      final response=<String,dynamic>{
        'requestId':requestId,'revision':message['revision'],
        'student':selected,'structure':selectedKind,
      };
      try {
        if(requestId is! int || requestId<1 ||
            message['revision'] is! String || message['content'] is! String ||
            selected==null || selectedKind==null) {
          throw const FormatException('Invalid source format request.');
        }
        // Never accept a client-supplied path or rewrite the student's saved file.
        final file=editableSource(repoPath, selected, selectedKind);
        final formatted=await formatEditableDraft(file.path, message['content'] as String);
        send({'type':'sourceFormatted',...response,'content':formatted});
      } catch(error) {
        final explanation=error is FormatException ? error.message : error.toString();
        send({'type':'sourceFormatError',...response,
          'message':explanation.length>1800?explanation.substring(0,1800):explanation});
      }
      return;
    }
    if(message['action']=='readSource'||message['action']=='saveSource'){
      try {
        final selected=student, selectedKind=kind;
        if(selected==null||selectedKind==null){
          throw const FormatException('Select a student implementation first.');
        }
        if(message['action']=='readSource'){
          send(readEditableSource(repoPath,selected,selectedKind));
        }else {
          final content=message['content'], revision=message['revision'];
          if(content is! String || revision is! String){
            throw const FormatException('Invalid source save request.');
          }
          send(saveEditableSource(repoPath,selected,selectedKind,revision,content));
          markChanged(); // Existing watcher recompiles the saved student file.
        }
      } on FormatException catch(error){
        send({'type':'sourceError','message':error.message});
      } on FileSystemException catch(error){
        send({'type':'sourceError','message':'Could not access the selected source: $error'});
      }
      return;
    }
    final runner=worker;
    if(runner==null){error('Select a valid student implementation first.');return;}
    try{
      final result=await runner.request(message);
      if(result['type']=='error'||result['type']=='executionError'){
        runner.kill();if(identical(worker,runner))worker=null;
        final details=result['error'] is Map?
          Map<String,dynamic>.from(result['error'] as Map):<String,dynamic>{
            'kind':'runtime','message':result['message']?.toString()??'Student code failed.'};
        send({...result,'type':'executionError','error':details,
          'message':'${details['message']} · Runner stopped; use Retry to start a fresh instance.'});
      }else send(result);
    }on StudentExecutionTimeout catch(e){
      stderr.writeln('[sandbox] Student execution timed out ($student/$kind): $e');
      runner.kill();if(identical(worker,runner))worker=null;
      send({'type':'executionError','error':{
        'kind':'timeout','message':e.message,
        if(e.line!=null)'line':e.line,
        if(e.traceIndex!=null)'traceIndex':e.traceIndex,
      },'console':e.console,
        'message':'${e.message} Runner stopped; use Retry to start a fresh instance.'});
    }catch(e){
      stderr.writeln('[sandbox] Student execution failed ($student/$kind):\n$e');
      runner.kill();if(identical(worker,runner))worker=null;
      error(e);
    }
  }
  void close(){closed=true;cancelValidation();worker?.kill();worker=null;}
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
  // No student workers have started yet; leave young/in-progress builds alone.
  final cleaned=pruneWorkerCache();
  if(cleaned.revisionsRemoved>0){
    stdout.writeln('[cache] Removed ${cleaned.revisionsRemoved} stale worker '
      'revisions (${cleaned.kernelsRemoved} kernels, '
      '${(cleaned.bytesRemoved/(1024*1024)).toStringAsFixed(1)} MiB).');
  }
  warmInstrumenter();
  // Missing class repository is an intentional empty first-run state.
  final server=await HttpServer.bind(InternetAddress.loopbackIPv4,port);
  final url='http://127.0.0.1:${server.port}/';
  stdout.writeln('Data Structure Sandbox · $url · Students: ${Directory(repoPath).absolute.path}');
  if(openBrowser)unawaited(_openBrowser(url));
  var fingerprint=jsonEncode(catalog());
  Timer.periodic(const Duration(milliseconds:700),(_){
    final next=jsonEncode(catalog());
    if(next!=fingerprint){
      fingerprint=next;
      broadcastCatalog();
      broadcastProgressSnapshot();
    }
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
      '/editor.js'=>'web/editor.js',
      '/vendor/codemirror.js'=>'web/vendor/codemirror.js',
      '/vendor/codemirror.css'=>'web/vendor/codemirror.css',
      '/vendor/fonts/OpenSans.ttf'=>'web/vendor/fonts/OpenSans.ttf',
      '/vendor/fonts/0xProtoNerdFont.ttf'=>'web/vendor/fonts/0xProtoNerdFont.ttf',
      '/vendor/tabler-icons.svg'=>'web/vendor/tabler-icons.svg',
      '/background.jpg'=>'web/background.jpg',
      _=>null,
    };
    if(path==null){request.response.statusCode=HttpStatus.notFound;await request.response.close();return;}
    final file=File(path);
    if(!file.existsSync()){
      request.response.statusCode=HttpStatus.notFound;
      await request.response.close();return;
    }
    request.response.headers
      ..contentType=path.endsWith('.html')?ContentType.html:path.endsWith('.css')?
        ContentType('text','css',charset:'utf-8'):path.endsWith('.jpg')?
        ContentType('image','jpeg'):path.endsWith('.ttf')?
        ContentType('font','ttf'):path.endsWith('.svg')?
        ContentType('image','svg+xml'):ContentType('application','javascript',charset:'utf-8')
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
