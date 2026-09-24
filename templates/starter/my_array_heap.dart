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
REFERENCE: HeapMemory and the min-heap contract

  memory is a growable, initially empty sequence of int cells.
  memory.length          Number of stored values (int).
  memory[index]          Read an existing value (int; not nullable).
  memory[index] = value; Replace a value at an existing index.
  memory.add(value);     Append an int cell.
  memory.removeLast();   Remove and return the last value (int).
  memory.swap(a, b);     Exchange the values at two existing indices.

  Valid indices are 0..memory.length - 1. Assignment does not grow memory.
  The minimum belongs at index 0. In the logical tree represented by this
  array, index i has children 2*i + 1 and 2*i + 2 when they exist.
  Every parent value must be <= its children's values.

  insert returns void. removeMin and peek return int? (null if empty).
  peek leaves the heap unchanged. isEmpty returns bool; duplicates are allowed.
*/
