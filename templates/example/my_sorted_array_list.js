import { ListMemory } from "sandbox";

// Fixed-capacity array list in nondecreasing order.
// Duplicate policy: allowed; every successful insert stores another occurrence.
export default class MySortedArrayList {
  constructor() {
    this.memory = new ListMemory(8);
    this.size = 0; // Number of occupied cells; maintained by student code.
  }

  insert(value) {
    if (this.size === this.memory.length) return false;
    let index = 0;
    while (index < this.size && this.memory[index] <= value) {
      index++;
    }
    for (let i = this.size; i > index; i--) {
      this.memory[i] = this.memory[i - 1];
    }
    this.memory[index] = value;
    this.size = this.size + 1;
    return true;
  }

  contains(value) {
    for (let i = 0; i < this.size; i++) {
      if (this.memory[i] === value) return true;
      if (this.memory[i] > value) return false;
    }
    return false;
  }

  remove(value) {
    let index = 0;
    while (index < this.size && this.memory[index] < value) {
      index++;
    }
    if (index === this.size || this.memory[index] !== value) return false;
    for (let i = index; i < this.size - 1; i++) {
      this.memory[i] = this.memory[i + 1];
    }
    this.memory[this.size - 1] = null;
    this.size = this.size - 1;
    return true;
  }

  length() {
    return this.size;
  }
}
