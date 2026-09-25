/*
Array-based min-heap of integers.
Implement the public operations below.
*/

import '../../lib/heap_sandbox.dart';

class MyArrayHeap {
  final HeapMemory memory = HeapMemory();

  void insert(int value) {
    // TODO: Insert value while preserving the min-heap property.
  }

  int? removeMin() {
    // TODO: Remove and return the minimum value, or null if the heap is empty.
    return null;
  }

  int? peek() {
    // TODO: Return the minimum value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the heap contains no elements.
    return false;
  }
}

/*
Quick reference · HeapMemory
  memory.length         Number of stored values
  memory[i]             Read an int at index i
  memory[i] = value     Replace an existing value
  memory.add(value)     Append a value
  memory.removeLast()   Remove and return the last value
  memory.swap(i, j)     Exchange two indexed values
  Details: docs/array-heap.md
*/
