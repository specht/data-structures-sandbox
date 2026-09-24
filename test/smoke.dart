// Run after explicitly creating an optional reference student in structures/:
//   dart test/smoke.dart
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/prepare.dart';
import '../tool/host.dart' as host;

Future<void> main() async {
  final found=host.catalog();
  if(!found.any((s)=>s['id']=='example')) {
    throw StateError('Missing reference student; populate structures/example explicitly before running smoke.dart.');
  }
  for(final kind in ['list','tree','avl','stack','linked_stack','linked_queue','array_queue','array_heap','node_heap','hash']){
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
      if(kind=='stack'){
        final events=(trace['steps'] as List).cast<Map>();
        if(!events.any((e)=>e['kind']=='indexWrite'&&e['name']=='top'&&
            e['oldValue']==-1&&e['value']==0)){
          throw StateError('Array stack must trace student-owned top: ${trace['steps']}');
        }
        final snap=events.lastWhere((e)=>e['kind']=='snapshot');
        if(snap['top']!=0)throw StateError('Student-owned top not in snapshot: $snap');
        process.stdin.writeln(jsonEncode({'action':'run','method':'pop','arguments':[]}));
        await process.stdin.flush();
        final popped=await next();
        final popSteps=(popped['steps'] as List).cast<Map>();
        if(popSteps.last['ok']!=true || popSteps.last['value']!=25 ||
            !popSteps.any((e)=>e['kind']=='indexWrite'&&e['name']=='top'&&
              e['oldValue']==0&&e['value']==-1)){
          throw StateError('Array stack pop must trace 0→-1: ${popped['steps']}');
        }
        stdout.writeln('PASS: stack · student-owned top traced on push and pop');
      }
      if(kind=='hash'){
        Future<Map<String,dynamic>> hashCall(String name,[List<Object?> args=const []]) async {
          process.stdin.writeln(jsonEncode({'action':'run','method':name,'arguments':args}));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace'||(reply['steps'] as List).last['ok']!=true){
            throw StateError('Hash worker failed $name($args): $reply');
          }
          final snap=(reply['steps'] as List).lastWhere((s)=>s['kind']=='snapshot') as Map;
          final audit=snap['buckets'] as List;
          if(audit.length!=8)throw StateError('Expected eight physical hash buckets');
          return reply;
        }
        for(final key in [7,15,23,-1])await hashCall('insert',[key]);
        var reply=await hashCall('contains',[15]);
        if((reply['steps'] as List).last['value']!=true)throw StateError('Hash collision lookup failed');
        reply=await hashCall('insert',[15]);
        if((reply['steps'] as List).last['value']!=false)throw StateError('Hash duplicate key accepted');
        reply=await hashCall('remove',[15]);
        if((reply['steps'] as List).last['value']!=true)throw StateError('Hash interior removal failed');
        reply=await hashCall('contains',[15]);
        if((reply['steps'] as List).last['value']!=false)throw StateError('Hash deleted key still present');
        reply=await hashCall('loadFactor');
        if(((reply['steps'] as List).last['value'] as num)-0.5 != 0){
          throw StateError('Hash load factor is not 4/8');
        }
        stdout.writeln('PASS: hash · generated worker, collisions, duplicate, remove, load factor');
      }
      if(kind=='node_heap'){
        Future<Map<String,dynamic>> call(String name, [List<Object?> args=const []]) async {
          process.stdin.writeln(jsonEncode({'action':'run','method':name,'arguments':args}));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace'||(reply['steps'] as List).last['ok']!=true){
            throw StateError('Node heap worker failed $name($args): $reply');
          }
          final snap=(reply['steps'] as List).lastWhere((s)=>s['kind']=='snapshot') as Map;
          final audit=snap['nodeHeap'] as Map;
          if(audit['acyclic']!=true||audit['complete']!=true||audit['ordered']!=true){
            throw StateError('Invalid node heap: $audit');
          }
          return reply;
        }
        for(final v in [5,17,5,-3,42,0,99,1,20,8,5])await call('insert',[v]);
        final peek=await call('peek');
        if((peek['steps'] as List).last['value']!=-3)throw StateError('Node heap peek wrong');
        for(final value in [-3,0,1,5,5,5,8,17,20,25,42,99]){
          final reply=await call('removeMin');
          if((reply['steps'] as List).last['value']!=value)throw StateError('Node heap removal wrong: $value');
        }
        final empty=await call('removeMin');
        if((empty['steps'] as List).last['value']!=null)throw StateError('Empty node heap should return null');
        stdout.writeln('PASS: node heap · persistent worker, duplicates, complete shape, sorted removal');
      }
      if(kind=='array_heap'){
        Future<Map<String,dynamic>> heapCall(String method, [List<Object?> args=const []]) async {
          process.stdin.writeln(jsonEncode({'action':'run','method':method,'arguments':args}));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace'||(reply['steps'] as List).last['ok']!=true){
            throw StateError('Heap worker failed $method($args): $reply');
          }
          final steps=(reply['steps'] as List);
          final snap=steps.lastWhere((step)=>step['kind']=='snapshot') as Map;
          if(snap['heapOrder']!=true)throw StateError('Invalid completed min heap: $snap');
          return reply;
        }
        for(final v in [5,17,5,-3,42,0,99,1,20,8,5])await heapCall('insert',[v]);
        final peek=await heapCall('peek');
        if((peek['steps'] as List).last['value']!=-3)throw StateError('Heap peek wrong');
        for(final value in [-3,0,1,5,5,5,8,17,20,25,42,99]){
          final reply=await heapCall('removeMin');
          if((reply['steps'] as List).last['value']!=value)throw StateError('Heap removal wrong: $value');
        }
        final empty=await heapCall('removeMin');
        if((empty['steps'] as List).last['value']!=null)throw StateError('Empty heap should return null');
        stdout.writeln('PASS: array heap · persistent worker, duplicates and sorted removal');
      }
      if(kind=='avl'){
        // A second call must use the same worker and perform an LL rotation.
        for(final value in [15,5]){
          process.stdin.writeln(jsonEncode({'action':'run','method':'insert','arguments':[value]}));
          await process.stdin.flush();
          final reply=await next();
          if(reply['type']!='trace' || (reply['steps'] as List).last['ok']!=true){
            throw StateError('AVL worker rejected insert($value): $reply');
          }
          // The recorder must follow calls into private recursive methods;
          // otherwise the source highlight remains on public insert().
          final original=(reply['source'] as Map)['lines'] as List;
          for(final helper in [
            'TreeNode _insert(',
            if(value==5) 'TreeNode _rotateRight(',
          ]){
            final helperLine=original.indexWhere((line)=>line.toString().contains(helper))+1;
            if(helperLine==0 || !(reply['steps'] as List).any((step)=>
                step['kind']=='line' && step['line']==helperLine)){
              throw StateError('AVL trace did not enter $helper for insert($value)');
            }
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
