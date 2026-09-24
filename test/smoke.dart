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
  for(final kind in ['list','tree','stack','linked_stack','linked_queue']){
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
      final method=kind=='linked_queue'?'enqueue':(kind=='stack'||kind=='linked_stack')?'push':'insert';
      process.stdin.writeln(jsonEncode({'action':'run','method':method,'arguments':[25]}));
      await process.stdin.flush();
      final trace=await next();
      if(trace['type']!='trace' || trace['steps'] is! List ||
          (trace['steps'] as List).isEmpty || trace['structure']!=kind){
        throw StateError('Unexpected trace for $kind: $trace');
      }
      final values=(trace['values'] as List).cast<int>();
      if(!values.contains(25)) throw StateError('$kind did not store the inserted value');
      if (kind == 'tree') {
        // Exercise the actual persistent worker, not merely the JS layout.
        // The 12-call batch limit is independent of the total tree size.
        for (var n = 26; n < 40; n++) {
          process.stdin.writeln(jsonEncode({
            'action':'run', 'method':'insert','arguments':[n],
          }));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace' || (reply['values'] as List).length!=n-24) {
            throw StateError('Tree stopped growing at ${n - 24} nodes: $reply');
          }
        }
        stdout.writeln('PASS: tree · persistent worker accepts more than 12 nodes');
      }
      if (kind == 'linked_stack') {
        // A linked stack is LIFO, unlike the sorted linked-list example.
        Future<Map<String, dynamic>> call(String name, [List<Object?> args = const []]) async {
          process.stdin.writeln(jsonEncode({'action': 'run', 'method': name, 'arguments': args}));
          await process.stdin.flush();
          final reply = await next();
          if (reply['type'] != 'trace') throw StateError('$name failed: $reply');
          if ((reply['steps'] as List).last['ok'] != true) {
            throw StateError('$name failed reference check: $reply');
          }
          return reply;
        }
        await call('push', [6]);
        var reply = await call('peek');
        if ((reply['steps'] as List).last['value'] != 6) throw StateError('peek must see newest value');
        reply = await call('pop');
        if ((reply['steps'] as List).last['value'] != 6 ||
            (reply['values'] as List).join(',') != '25') throw StateError('Linked stack not LIFO');
        await call('pop');
        reply = await call('pop');
        if ((reply['steps'] as List).last['value'] != null) throw StateError('Empty pop must return null');
        reply = await call('isEmpty');
        if ((reply['steps'] as List).last['value'] != true) throw StateError('Stack must be empty');
        stdout.writeln('PASS: linked_stack · LIFO order · empty semantics · reference model');
      }
      if (kind == 'linked_queue') {
        Future<Map<String, dynamic>> call(String name, [List<Object?> args = const []]) async {
          process.stdin.writeln(jsonEncode({'action': 'run', 'method': name, 'arguments': args}));
          await process.stdin.flush();
          final reply = await next();
          if (reply['type'] != 'trace') throw StateError('$name failed: $reply');
          if ((reply['steps'] as List).last['ok'] != true) {
            throw StateError('$name failed reference/invariant check: $reply');
          }
          return reply;
        }
        await call('enqueue', [6]);
        await call('enqueue', [25]); // Duplicates and insertion order matter.
        var reply = await call('peek');
        if ((reply['steps'] as List).last['value'] != 25) throw StateError('Peek must read front');
        reply = await call('dequeue');
        if ((reply['steps'] as List).last['value'] != 25) throw StateError('Queue not FIFO');
        reply = await call('dequeue');
        if ((reply['steps'] as List).last['value'] != 6) throw StateError('Queue order incorrect');
        reply = await call('dequeue');
        if ((reply['steps'] as List).last['value'] != 25) throw StateError('Duplicate element lost');
        reply = await call('dequeue');
        if ((reply['steps'] as List).last['value'] != null ||
            (reply['steps'] as List).lastWhere((s)=>s['kind']=='snapshot')['tail'] != null) {
          throw StateError('Empty queue must have null head and tail');
        }
        reply = await call('isEmpty');
        if ((reply['steps'] as List).last['value'] != true) throw StateError('Queue must be empty');
        await call('enqueue', [99]);
        reply = await call('dequeue');
        if ((reply['steps'] as List).last['value'] != 99) throw StateError('Queue must be reusable after emptying');
        stdout.writeln('PASS: linked_queue · FIFO · duplicates · head/tail · empty/reuse');
      }
      stdout.writeln('PASS: $kind · discovered methods · instrumented source · worker reply');
    }finally{
      process.kill(ProcessSignal.sigkill);
      await lines.cancel();
    }
  }
}
