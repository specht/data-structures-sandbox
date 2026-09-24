// Standalone heap model/scenario test, no browser or child process required.
// Run in the repository root: dart test/heap_model.dart
import 'dart:math';
import '../lib/heap_sandbox.dart';
import '../templates/example/my_array_heap.dart';

void expectCondition(bool yes, String message) {
  if (!yes) throw StateError(message);
}

void main() {
  expectCondition(!heapOrderValid([9, 1]), 'Broken heap order must be rejected');
  expectCondition(heapOrderValid([1, 1, 2, 2]), 'Duplicates are valid');
  final heap = MyArrayHeap();
  final recorder = HeapRecorder(const [])..memory = (() => heap.memory);
  HeapRecorder.active = recorder;
  final sorted = <int>[];
  final random = Random(12345);
  try {
    for (var step = 0; step < 280; step++) {
      // Duplicates, negatives, empty-heap removal, repeated root swaps.
      if (sorted.isEmpty || (sorted.length < 100 && random.nextBool())) {
        final value = random.nextInt(101) - 50;
        heap.insert(value);
        sorted.add(value);
        sorted.sort();
      } else {
        final expected = sorted.removeAt(0);
        expectCondition(heap.removeMin() == expected, 'Wrong minimum at step $step');
      }
      final actual = heap.memory.copy();
      expectCondition(actual.length == sorted.length, 'Lost/extra cell at step $step');
      expectCondition(heapOrderValid(actual), 'Min-heap invariant failed at step $step');
      expectCondition((List<int>.of(actual)..sort()).join(',') == sorted.join(','),
        'Wrong multiset at step $step');
      expectCondition(heap.peek() == (sorted.isEmpty ? null : sorted.first),
        'Wrong peek at step $step');
      // Keep the log bounded for a long sequence; snapshots are individually
      // checked, rather than treating 280 calls as one browser submission.
      recorder.steps.clear();
    }
    while (sorted.isNotEmpty) {
      expectCondition(heap.removeMin() == sorted.removeAt(0), 'Drain not sorted');
      expectCondition(heapOrderValid(heap.memory.copy()), 'Invalid heap while draining');
      recorder.steps.clear();
    }
    expectCondition(heap.removeMin() == null && heap.isEmpty(), 'Empty-heap contract');
    heap.insert(8);heap.insert(3);heap.insert(5);
    expectCondition(recorder.steps.any((s) => s['kind'] == 'heapRead'),
      'Reads must be recorded');
    expectCondition(recorder.steps.any((s) => s['kind'] == 'heapSwap'),
      'Heap swaps must be recorded');
    expectCondition(recorder.steps.any((s) => s['kind'] == 'heapAppend'),
      'Array growth must be recorded');
    print('PASS: 280 deterministic randomized heap operations, duplicates, reads and swaps');
  } finally {
    HeapRecorder.active = null;
  }
}
