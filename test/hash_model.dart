// Run from the repo root: dart test/hash_model.dart
import 'dart:math';
import '../lib/hash_sandbox.dart';
import '../lib/sandbox.dart';
import '../templates/example/my_hash_table.dart';

void check(MyHashTable table, Set<int> model) {
  final audit=auditHash(table.buckets,table.size);
  for(final name in ['acyclic','placement','unique','sizeOk']) {
    if(audit[name]!=true)throw StateError('Hash invariant $name: $audit');
  }
  final values=(audit['values'] as List).cast<int>();
  if(values.length!=model.length || values.toSet().difference(model).isNotEmpty){
    throw StateError('Wrong key set: $values vs $model');
  }
  if((table.loadFactor()-model.length/8).abs()>1e-12)throw StateError('Load factor wrong');
}
void main(){
  final table=MyHashTable(),model=<int>{};
  Recorder.resetIds();
  final record=HashRecorder(const [])
    ..memory=(()=>table.buckets)..count=(()=>table.size);
  Recorder.active=record;
  try {
    // 7,15,23,-1 all map to bucket 7; remove interior, head and tail.
    for(final key in [7,15,23,-1]){
      if(!table.insert(key))throw StateError('Missing collision insertion');
      model.add(key);check(table,model);
    }
    if(table.insert(15))throw StateError('Duplicate insertion');
    if(!table.contains(15)||table.contains(16))throw StateError('Collision lookup');
    for(final key in [15,-1,7,23]){
      if(!table.remove(key))throw StateError('Missing key removal');
      model.remove(key);check(table,model);
    }
    if(table.remove(15)||!table.isEmpty())throw StateError('Empty contract');
    final random=Random(20260924);
    for(var i=0;i<250;i++){
      final value=random.nextInt(161)-80;
      switch(random.nextInt(3)){
        case 0:
          final expected=model.add(value);
          if(table.insert(value)!=expected)throw StateError('insert($value) at $i');
          break;
        case 1:
          final expected=model.remove(value);
          if(table.remove(value)!=expected)throw StateError('remove($value) at $i');
          break;
        case 2:
          if(table.contains(value)!=model.contains(value))throw StateError('contains($value) at $i');
          break;
      }
      check(table,model);
      record.steps.clear(); // Each call is independently checked, not one huge trace.
    }
    if(!record.steps.isEmpty)record.steps.clear();
    final a=ListNode(1),b=ListNode(9);
    a.next=b;b.next=a;
    table.buckets[1]=a;
    if(auditHash(table.buckets,table.size)['acyclic']!=false){
      throw StateError('Cycle not detected');
    }
    b.next=null;
    print('PASS: hash table · collisions, negative keys, removal and 250 randomized operations');
  } finally { Recorder.active=null; }
}
