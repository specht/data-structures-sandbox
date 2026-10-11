// Min-heaps: a growing array (HeapMemory) and linked TreeNodes.
import '../heap_sandbox.dart' as heap_api;
import '../node_heap_sandbox.dart' as node_heap_api;
import '../tree_sandbox.dart' as tree_api;
import '../worker/adapter.dart';

/// Shared reference model: the multiset of values, kept sorted.
abstract class _HeapAdapter extends StructureAdapter {
  _HeapAdapter(super.kind, {required super.create, required super.invoke, required super.methodsJson});

  @override
  bool get unorderedContents => true;

  @override
  Set<String> get standardMethods => const {'insert', 'removeMin', 'peek', 'isEmpty'};

  @override
  bool get insertReturnsVoid => true;

  @override
  Object? expectedReturn(String name, List<Object?> args) => switch (name) {
        'insert' => null,
        'peek' => reference.isEmpty ? null : (List<int>.of(reference)..sort()).first,
        _ => super.expectedReturn(name, args),
      };

  /// The values to resynchronise with after an unknown method.
  List<int> resyncValues();

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    switch (name) {
      case 'insert' when value != null:
        reference
          ..add(value)
          ..sort();
        return true;
      case 'removeMin':
        final expected = reference.isEmpty ? null : reference.removeAt(0);
        return returned == expected;
      case 'peek':
        return returned == (reference.isEmpty ? null : reference.first);
      case 'isEmpty':
        return returned == reference.isEmpty;
      default:
        reference
          ..clear()
          ..addAll(resyncValues()..sort());
        return true;
    }
  }
}

/// `MyArrayHeap`: a dynamically growing HeapMemory (no fixed capacity).
class ArrayHeapAdapter extends _HeapAdapter {
  ArrayHeapAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('array_heap');

  heap_api.HeapMemory get memory => s.memory;

  @override
  dynamic createRecorder(List<String> lines) =>
      heap_api.HeapRecorder(lines)..memory = (() => s.memory);

  @override
  void activate(dynamic recorder) =>
      heap_api.HeapRecorder.active = recorder as heap_api.HeapRecorder;

  @override
  List<int> actualValues() => memory.copy();

  @override
  List<int> resyncValues() => memory.copy();

  /// A contiguous array (no gaps) obeying the min-heap parent/child order
  /// after each completed public method.
  bool storageValid() => heap_api.heapOrderValid(memory.copy());

  @override
  List<String> executionProblems() =>
      storageValid() ? const [] : const ['min-heap order'];

  @override
  void structuralChecks(Check check) =>
      check('Min-heap ordering', true, storageValid());
}

/// `MyNodeHeap`: TreeNode root plus a student-owned `int size`.
class NodeHeapAdapter extends _HeapAdapter {
  NodeHeapAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('node_heap');

  tree_api.TreeNode? get root => s.root;
  int get size => s.size;

  Map<String, Object?> audit() => node_heap_api.auditNodeHeap(root, size);

  @override
  void resetIds() => tree_api.TreeRecorder.resetIds();

  @override
  dynamic createRecorder(List<String> lines) => node_heap_api.NodeHeapRecorder(lines)
    ..root = (() => s.root)
    ..count = (() => s.size);

  @override
  void activate(dynamic recorder) =>
      tree_api.TreeRecorder.active = recorder as tree_api.TreeRecorder;

  @override
  List<int> actualValues() {
    final result = audit();
    if (result['acyclic'] != true || result['complete'] != true) return [invalidMarker];
    return (result['values'] as List).cast<int>();
  }

  @override
  List<int> resyncValues() => actualValues();

  @override
  List<String> executionProblems() {
    final result = audit();
    final faults = [
      if (result['acyclic'] != true) 'cycle/shared child',
      if (result['complete'] != true) 'complete-tree shape / size',
      if (result['ordered'] != true) 'min-heap order',
    ];
    return faults.isEmpty ? const [] : ['node heap: ${faults.join(', ')}'];
  }

  @override
  void structuralChecks(Check check) {
    final result = audit();
    check('Acyclic node heap', true, result['acyclic']);
    check('Complete tree and size', true, result['complete']);
    check('Min-heap ordering', true, result['ordered']);
    check('Logical size', reference.length, size);
  }
}
