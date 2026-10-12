import { HeapMemory } from "sandbox";

// Min-heap: the smallest key is at index 0. This is a DYNAMIC array, not
// linked nodes. Indices describe one contiguous, complete binary tree.
// Duplicate policy: allowed; every insert stores another occurrence.
export default class MyArrayHeap {
  constructor() {
    this.memory = new HeapMemory();
  }

  insert(value) {
    const memory = this.memory;
    memory.add(value);
    let i = memory.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (memory[parent] <= memory[i]) break;
      memory.swap(parent, i);
      i = parent;
    }
  }

  peek() {
    if (this.memory.length === 0) return null;
    return this.memory[0];
  }

  removeMin() {
    const memory = this.memory;
    if (memory.length === 0) return null;
    const minimum = memory[0];
    const last = memory.removeLast();
    if (memory.length === 0) return minimum;
    memory[0] = last;
    let i = 0;
    while (true) {
      const left = 2 * i + 1;
      if (left >= memory.length) break;
      const right = left + 1;
      let smaller = left;
      if (right < memory.length && memory[right] < memory[left]) smaller = right;
      if (memory[i] <= memory[smaller]) break;
      memory.swap(i, smaller);
      i = smaller;
    }
    return minimum;
  }

  isEmpty() {
    return this.memory.length === 0;
  }
}
