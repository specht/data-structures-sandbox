// Fixed-capacity array stack (LIFO).
// Duplicate policy: allowed; every successful push stores another occurrence.
// Implement the public operations below.

import { FixedMemory } from "sandbox";

export default class MyArrayStack {
  constructor() {
    this.memory = new FixedMemory(8);
    // Student-owned logical state. -1 means no element is stored.
    this.top = -1;
  }

  push(value) {
    // TODO: Add value to the stack; return false without changing it if full.
    return false;
  }

  pop() {
    // TODO: Remove and return the top value, or null if the stack is empty.
    return null;
  }

  peek() {
    // TODO: Return the top value without removing it, or null if empty.
    return null;
  }

  isEmpty() {
    // TODO: Return true exactly when the stack contains no elements.
    return false;
  }
}

// Quick reference · FixedMemory
//   memory.length       Physical capacity (8)
//   memory[i]           Read a cell: an integer or null
//   memory[i] = value   Write an integer (null clears a cell)
//   this.top            Student-maintained top index (-1 if empty)
