// Run after ./run has initialized the local example repository:
//   dart test/smoke.dart
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/prepare.dart';
import '../tool/host.dart' as host;

Future<void> main() async {
  final found=host.catalog();
  if(!found.any((s)=>s['id']=='example')) {
    throw StateError('Missing example student; run ./run once first.');
  }
  for(final kind in ['list','tree','stack']){
    final worker=await prepare('example',kind,'structures');
    final cached=await prepare('example',kind,'structures');
    if(worker!=cached)throw StateError('Cache did not reuse $kind worker: $worker vs $cached');
    stdout.writeln('PASS: $kind · identical sources reuse ${worker.endsWith('.dill') ? 'compiled kernel' : 'validated worker'}');
    final process=await Process.start(Platform.resolvedExecutable,[worker]);
    final lines=StreamIterator(process.stdout.transform(utf8.decoder).transform(const LineSplitter()));
    try{
      Future<Map<String,dynamic>> next() async {
        final hasLine=await lines.moveNext().timeout(const Duration(seconds:40));
        if(!hasLine) throw StateError('Worker closed before replying to $kind');
        final result=jsonDecode(lines.current);
        if(result is! Map<String,dynamic>) throw StateError('Invalid worker response: $result');
        return result;
      }
      final hello=await next();
      if(hello['type']!='hello') throw StateError('Expected hello for $kind: $hello');
      final method=kind=='stack'?'push':'insert';
      process.stdin.writeln(jsonEncode({'action':'run','method':method,'arguments':[25]}));
      await process.stdin.flush();
      final trace=await next();
      if(trace['type']!='trace' || trace['steps'] is! List ||
          (trace['steps'] as List).isEmpty || trace['structure']!=kind){
        throw StateError('Unexpected trace for $kind: $trace');
      }
      final values=(trace['values'] as List).cast<int>();
      if(!values.contains(25)) throw StateError('$kind did not store the inserted value');
      stdout.writeln('PASS: $kind · discovered methods · instrumented source · worker reply');
    }finally{
      process.kill(ProcessSignal.sigkill);
      await lines.cancel();
    }
  }
}
