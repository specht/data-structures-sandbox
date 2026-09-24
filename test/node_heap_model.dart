// Run from the repository root: dart test/node_heap_model.dart
import 'dart:math';
import '../lib/node_heap_sandbox.dart';
import '../lib/tree_sandbox.dart';
import '../templates/example/my_node_heap.dart';

void main() {
  final heap = MyNodeHeap();
  final recorder = NodeHeapRecorder(const [])
    ..root = (() => heap.root)
    ..count = (() => heap.size);
  TreeRecorder.resetIds();
  TreeRecorder.active = recorder;
  final reference = <int>[];
  final random = Random(624);
  try {
    for (var i = 0; i < 250; i++) {
      if (reference.isEmpty || (reference.length < 110 && random.nextBool())) {
        final v = random.nextInt(101) - 50;
        heap.insert(v);
        reference.add(v);
        reference.sort();
      } else {
        final expected = reference.removeAt(0);
        if (heap.removeMin() != expected) throw StateError('Wrong minimum at iteration $i');
      }
      final state = auditNodeHeap(heap.root, heap.size);
      if (state['acyclic'] != true || state['complete'] != true || state['ordered'] != true) {
        throw StateError('Invalid physical node heap at iteration $i: $state');
      }
      final values = (state['values'] as List).cast<int>()..sort();
      if (values.join(',') != reference.join(',')) {
        throw StateError('Wrong heap values at iteration $i: $values vs $reference');
      }
      if (heap.peek() != (reference.isEmpty ? null : reference.first)) {
        throw StateError('Wrong peek at iteration $i');
      }
      recorder.steps.clear();
    }
    while (reference.isNotEmpty) {
      if (heap.removeMin() != reference.removeAt(0)) throw StateError('Drain order');
      final state = auditNodeHeap(heap.root, heap.size);
      if (state['complete'] != true || state['ordered'] != true) throw StateError('Drain shape/order');
      recorder.steps.clear();
    }
    if (heap.removeMin() != null || !heap.isEmpty()) throw StateError('Empty contract');
    final a = TreeNode(4), b = TreeNode(2);
    a.left = b;
    if (auditNodeHeap(a, 2)['ordered'] != false) throw StateError('Invalid order undetected');
    a.left = null;
    a.right = b;
    if (auditNodeHeap(a, 2)['complete'] != false) throw StateError('Incomplete shape undetected');
    a.left = b;
    if (auditNodeHeap(a, 3)['acyclic'] != false) throw StateError('Shared child undetected');
    print('PASS: node heap · 250 randomized operations, duplicates, shape, order, shared pointers');
  } finally {
    TreeRecorder.active = null;
  }
}
