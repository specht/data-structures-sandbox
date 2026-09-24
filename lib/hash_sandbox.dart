import 'sandbox.dart';

// Eight stationary buckets, with real ListNode references for collisions.
// Students can choose their own algorithm for traversing and updating chains.
class HashBuckets {
  final List<ListNode?> _cells;
  HashBuckets([int capacity = 8])
      : assert(capacity > 0), _cells = List<ListNode?>.filled(capacity, null);
  int get length => _cells.length;
  int indexFor(int value) => value % length; // Also nonnegative for negative keys.
  ListNode? operator [](int index) {
    RangeError.checkValidIndex(index, _cells);
    final value = _cells[index];
    final recorder = Recorder.active;
    if (recorder is HashRecorder) recorder.bucketRead(index, value);
    return value;
  }
  void operator []=(int index, ListNode? value) {
    RangeError.checkValidIndex(index, _cells);
    final before = _cells[index];
    _cells[index] = value;
    final recorder = Recorder.active;
    if (recorder is HashRecorder) recorder.bucketWrite(index, before, value);
  }
  // Read-only physical storage for the recorder and invariant checker.
  List<ListNode?> get heads => List<ListNode?>.unmodifiable(_cells);
}

class HashRecorder extends Recorder {
  HashRecorder(super.lines);
  HashBuckets Function()? memory;
  int Function()? count;

  void bucketRead(int index, ListNode? target) => steps.add({
    'kind':'bucketRead','index':index,'to':target?.id,'line':sourceLine,
  });
  void bucketWrite(int index, ListNode? before, ListNode? after) {
    steps.add({'kind':'bucketWrite','index':index,'oldTo':before?.id,
      'to':after?.id,'line':sourceLine});
    steps.add(snapshot());
  }

  @override
  Map<String, Object?> snapshot() {
    final base = super.snapshot();
    final buckets = memory?.call();
    return {...base,
      'buckets':[for (final head in buckets?.heads ?? <ListNode?>[]) head?.id],
      'size':count?.call() ?? 0,
      'capacity':buckets?.length ?? 0,
    };
  }

  @override
  void end(Object? result, bool ok, {bool returnedVoid=false, String? message}) {
    steps.add({'kind':'localsClear','line':sourceLine});
    // A bucket is an owning reference. Do not retire nodes that are reachable
    // from another bucket; only nodes detached from ALL buckets may disappear.
    final alive=<int>{};
    for (final start in memory?.call()?.heads ?? <ListNode?>[]) {
      var cursor=start;
      while(cursor!=null && alive.add(cursor.id)) cursor=cursor.next;
    }
    final retired=Recorder.registry.keys.where((id)=>!alive.contains(id)).toList();
    if (retired.isNotEmpty) {
      steps.add({'kind':'retire','ids':retired,'line':0});
      for (final id in retired) Recorder.registry.remove(id);
      steps.add(snapshot());
    }
    steps.add({'kind':'operationEnd','ok':ok,'value':result,
      'returnedVoid':returnedVoid,'result':message??'Result: $result',
      'line':sourceLine});
  }
}

// Independent physical audit. A cycle, shared node, incorrect bucket, or
// duplicate key is an error even when a public method happens to return true.
// Temporarily disable recording: an invariant check is NOT a student traversal.
Map<String,Object?> auditHash(HashBuckets buckets, int size) {
  final previous=Recorder.active;
  Recorder.active=null;
  try {
    final seen=<int>{},keys=<int>{},values=<int>[];
    var acyclic=true, placement=true, unique=true;
    final lengths=<int>[];
    final heads=buckets.heads;
    for (var i=0;i<heads.length;i++) {
      var cursor=heads[i],length=0;
      while(cursor!=null) {
        if(!seen.add(cursor.id)){acyclic=false;break;}
        final key=cursor.value;
        if(buckets.indexFor(key)!=i) placement=false;
        if(!keys.add(key)) unique=false;
        values.add(key);length++;
        cursor=cursor.next;
      }
      lengths.add(length);
    }
    return {'acyclic':acyclic,'placement':placement,'unique':unique,
      'sizeOk':size==values.length,'size':size,'capacity':buckets.length,
      'loadFactor':size/buckets.length,'lengths':lengths,'values':values};
  } finally { Recorder.active=previous; }
}
