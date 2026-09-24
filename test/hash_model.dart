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
  if((table.loadFactor()-model.length/table.buckets.length).abs()>1e-12){
    throw StateError('Load factor wrong for ${table.buckets.length} buckets');
  }
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
    // The same student code works with non-default capacities. Check both
    // occupancy and load factor independently for each choice.
    for (final capacity in [1, 3, 11, 16]) {
      final other=MyHashTable(capacity), expected=<int>{};
      for (final key in [-17, -1, 0, 1, 3, 7, 15, 23, 42]) {
        if (!other.insert(key)) throw StateError('Insert failed at capacity $capacity');
        expected.add(key);
        check(other, expected);
      }
      if (other.buckets.length != capacity) throw StateError('Wrong capacity');
      for (final key in [-17, 0, 15, 42]) {
        if (!other.remove(key)) throw StateError('Removal failed at capacity $capacity');
        expected.remove(key);
        check(other, expected);
      }
    }
    // Another valid student hash maps key 5 to bucket 4 at capacity 7.
    final alternative=HashBuckets(7,(key,capacity)=>(key*5)%capacity);
    alternative[4]=ListNode(5);
    final customAudit=auditHash(alternative,1);
    if(customAudit['placement']!=true || customAudit['sizeOk']!=true){
      throw StateError('Audit rejected an alternative student hash: $customAudit');
    }
    final outOfRange=HashBuckets(3,(key,capacity)=>capacity);
    try {
      outOfRange.indexFor(5);
      throw StateError('An invalid student hash index was accepted');
    } on RangeError { /* Correctly rejected. */ }
    for (final capacity in [0, -1]) {
      try {
        HashBuckets(capacity,(key,cap)=>0);
        throw StateError('Invalid bucket count $capacity was accepted');
      } on RangeError { /* Correctly rejected. */ }
    }
    print('PASS: student-defined hash and capacity, collisions, negative keys and 250 randomized operations');
  } finally { Recorder.active=null; }
}
