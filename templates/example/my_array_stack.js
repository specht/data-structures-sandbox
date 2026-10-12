import { FixedMemory } from "sandbox";

// Fixed-capacity stack: no push() or pop() on a JavaScript array.
// The fixed array indices stay stable; only values and top change.
// Duplicate policy: allowed; every successful push stores another occurrence.
export default class MyArrayStack {
  constructor() {
    this.memory = new FixedMemory(8);
    // The stack owns its logical top; FixedMemory contains only its cells.
    this.top = -1;
  }

  push(value) {
    if (this.top + 1 === this.memory.length) return false;
    this.top = this.top + 1;
    this.memory[this.top] = value;
    return true;
  }

  pop() {
    if (this.top < 0) return null;
    const value = this.memory[this.top];
    this.memory[this.top] = null;
    this.top = this.top - 1;
    return value;
  }

  peek() {
    if (this.top < 0) return null;
    return this.memory[this.top];
  }

  isEmpty() {
    return this.top === -1;
  }
}
