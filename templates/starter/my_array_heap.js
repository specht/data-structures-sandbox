// Array-based min-heap of integers.
// Duplicate policy: allowed; every insert stores another occurrence.
// Implement the public operations below.

import { HeapMemory } from "sandbox";

export default class MyArrayHeap {
  constructor() {
    this.memory = new HeapMemory();
  }

  insert(value) {
    // TODO: Insert value while preserving the min-heap property.
  }

  removeMin() {
    // TODO: Remove and return the minimum value, or null if the heap is empty.
    return null;
  }

  peek() {
    // TODO: Return the minimum value without removing it, or null if empty.
    return null;
  }

  isEmpty() {
    // TODO: Return true exactly when the heap contains no elements.
    return false;
  }
}

// Quick reference · HeapMemory
//   memory.length         Number of stored values
//   memory[i]             Read the integer at index i
//   memory[i] = value     Replace an existing value
//   memory.add(value)     Append a value
//   memory.removeLast()   Remove and return the last value
//   memory.swap(i, j)     Exchange two indexed values
