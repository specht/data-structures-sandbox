import { ListMemory } from "sandbox";

// Unsorted, fixed-capacity array list. The list owns its logical size.
// Values are stored contiguously in cells 0 … size-1.
// Duplicate policy: allowed; every successful insert stores another occurrence.
export default class MyUnsortedArrayList {
  constructor() {
    this.memory = new ListMemory(8);
    this.size = 0; // Number of occupied cells; maintained by student code.
  }

  insert(index, value) {
    if (index < 0 || index > this.size || this.size === this.memory.length) return false;
    for (let i = this.size; i > index; i--) {
      this.memory[i] = this.memory[i - 1];
    }
    this.memory[index] = value;
    this.size = this.size + 1;
    return true;
  }

  get(index) {
    if (index < 0 || index >= this.size) return null;
    return this.memory[index];
  }

  removeAt(index) {
    if (index < 0 || index >= this.size) return null;
    const removed = this.memory[index];
    for (let i = index; i < this.size - 1; i++) {
      this.memory[i] = this.memory[i + 1];
    }
    this.memory[this.size - 1] = null;
    this.size = this.size - 1;
    return removed;
  }

  contains(value) {
    for (let i = 0; i < this.size; i++) {
      if (this.memory[i] === value) return true;
    }
    return false;
  }

  length() {
    return this.size;
  }
}
