import '../../lib/heap_sandbox.dart';

// Min-heap: the smallest key is at index 0. This is a DYNAMIC array, not
// linked nodes. Indices describe one contiguous, complete binary tree.
// Duplicates are allowed; every insertion adds another occurrence.
class MyArrayHeap {
  final HeapMemory memory = HeapMemory();

  void insert(int value) {
    memory.add(value);
    var i = memory.length - 1;
    while (i > 0) {
      final parent = (i - 1) ~/ 2;
      if (memory[parent] <= memory[i]) break;
      memory.swap(parent, i);
      i = parent;
    }
  }

  int? peek() {
    if (memory.isEmpty) return null;
    return memory[0];
  }

  int? removeMin() {
    if (memory.isEmpty) return null;
    final minimum = memory[0];
    final last = memory.removeLast();
    if (memory.isEmpty) return minimum;
    memory[0] = last;
    var i = 0;
    while (true) {
      final left = 2 * i + 1;
      if (left >= memory.length) break;
      final right = left + 1;
      var smaller = left;
      if (right < memory.length && memory[right] < memory[left]) {
        smaller = right;
      }
      if (memory[i] <= memory[smaller]) break;
      memory.swap(i, smaller);
      i = smaller;
    }
    return minimum;
  }

  bool isEmpty() => memory.isEmpty;
}
