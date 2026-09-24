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
  for(final kind in ['list','tree','avl','stack','linked_stack','linked_queue','array_queue']){
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
      final method=(kind=='linked_queue'||kind=='array_queue')?'enqueue':(kind=='stack'||kind=='linked_stack')?'push':'insert';
      process.stdin.writeln(jsonEncode({'action':'run','method':method,'arguments':[25]}));
      await process.stdin.flush();
      final trace=await next();
      if(trace['type']!='trace' || trace['steps'] is! List ||
          (trace['steps'] as List).isEmpty || trace['structure']!=kind){
        throw StateError('Unexpected trace for $kind: $trace');
      }
      final values=(trace['values'] as List).cast<int>();
      if(!values.contains(25)) throw StateError('$kind did not store the inserted value');
      if(kind=='avl'){
        // A second call must use the same worker and perform an LL rotation.
        for(final value in [15,5]){
          process.stdin.writeln(jsonEncode({'action':'run','method':'insert','arguments':[value]}));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace' || (reply['steps'] as List).last['ok']!=true){
            throw StateError('AVL worker rejected insert($value): $reply');
          }
          final snap=(reply['steps'] as List).lastWhere((s)=>s['kind']=='snapshot') as Map;
          final audit=snap['avl'] as Map;
          if(audit['acyclic']!=true||audit['ordered']!=true||audit['heights']!=true||audit['balanced']!=true){
            throw StateError('AVL reference model found invalid structure: $audit');
          }
        }
        stdout.writeln('PASS: AVL · 25,15,5 rotation via generated worker');
      }
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
      if (kind == 'array_queue') {
        // Every operation uses the SAME worker: wraparound, duplicate values,
        // full != empty when front == rear, and reusing all cells after drain.
        Future<Map<String, dynamic>> call(String name, [List<Object?> args = const []]) async {
          process.stdin.writeln(jsonEncode({'action':'run','method':name,'arguments':args}));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace') throw StateError('$name: $reply');
          if((reply['steps'] as List).last['ok']!=true) {
            throw StateError('$name reference/physical invariant failed: $reply');
          }
          return reply;
        }
        Map snapshot(Map reply) => (reply['steps'] as List).lastWhere((s)=>s['kind']=='snapshot') as Map;
        for (final n in [6,25,17,3,9,8,4]) await call('enqueue',[n]);
        var reply=await call('isFull');
        if((reply['steps'] as List).last['value']!=true) throw StateError('Queue should be full');
        var state=snapshot(reply);
        if(state['front']!=0||state['rear']!=0||state['size']!=8) {
          throw StateError('Full queue should have front == rear and size == capacity: $state');
        }
        reply=await call('enqueue',[99]);
        if((reply['steps'] as List).last['value']!=false ||
            (reply['values'] as List).length!=8) throw StateError('Full enqueue must be rejected');
        reply=await call('peek');
        if((reply['steps'] as List).last['value']!=25) throw StateError('peek is not FIFO');
        for (final n in [25,6,25]) {
          reply=await call('dequeue');
          if((reply['steps'] as List).last['value']!=n) throw StateError('Expected dequeue $n');
        }
        for (final n in [101,102,103]) await call('enqueue',[n]);
        reply=await call('isFull');
        state=snapshot(reply);
        if(state['front']!=3||state['rear']!=3||state['size']!=8 ||
            (reply['values'] as List).join(',')!='17,3,9,8,4,101,102,103') {
          throw StateError('Wrapped queue lost physical indices or FIFO order: $reply');
        }
        for (final n in [17,3,9,8,4,101,102,103]) {
          reply=await call('dequeue');
          if((reply['steps'] as List).last['value']!=n) throw StateError('Expected dequeue $n');
        }
        reply=await call('isEmpty');
        state=snapshot(reply);
        if((reply['steps'] as List).last['value']!=true ||
            state['front']!=state['rear']||state['size']!=0 ||
            !(state['cells'] as List).every((v)=>v==null)) {
          throw StateError('Drained queue must be empty with reusable storage: $reply');
        }
        await call('enqueue',[77]);
        reply=await call('dequeue');
        if((reply['steps'] as List).last['value']!=77) throw StateError('Queue not reusable');
        reply=await call('dequeue');
        if((reply['steps'] as List).last['value']!=null) throw StateError('Empty dequeue must return null');
        // Deterministic mixed FIFO workload with an independent reference list.
        final expected=<int>[];
        var seed=19;
        for(var i=0;i<72;i++){
          seed=(seed*1103515245+12345)&0x7fffffff;
          final action=seed%5;
          final int value=100+i;
          Object? expectedResult;
          if(action<=1){
            expectedResult=expected.length<8;
            if(expectedResult==true) expected.add(value);
            reply=await call('enqueue',[value]);
          }else if(action==2){
            expectedResult=expected.isEmpty?null:expected.removeAt(0);
            reply=await call('dequeue');
          }else if(action==3){
            expectedResult=expected.isEmpty?null:expected.first;
            reply=await call('peek');
          }else{
            expectedResult=expected.length==8;
            reply=await call('isFull');
          }
          if((reply['steps'] as List).last['value']!=expectedResult ||
              (reply['values'] as List).join(',')!=expected.join(',')) {
            throw StateError('Randomized FIFO mismatch at operation $i: $reply');
          }
        }
        stdout.writeln('PASS: array_queue · FIFO · duplicates · wraparound · full/empty · reuse · physical invariants');
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
