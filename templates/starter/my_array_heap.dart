import '../../lib/heap_sandbox.dart';

// Heap (array): dynamic MIN-heap. Duplicate keys are allowed.
// Children of index i are 2*i+1 and 2*i+2; use HeapMemory operations.
class MyArrayHeap {
  final HeapMemory memory = HeapMemory();

  void insert(int value) {
    // TODO: Append and sift the new value upward.
  }

  int? removeMin() {
    // TODO: Return null when empty; move last value to root and sift down.
    return null;
  }

  int? peek() {
    // TODO: Return smallest value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() => memory.isEmpty;
}
