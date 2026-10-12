// Sorted ascending array list with capacity 8.
// Duplicate policy: allowed; every successful insert stores another occurrence.

import { ListMemory } from "sandbox";

export default class MySortedArrayList {
  constructor() {
    this.memory = new ListMemory(8);
    this.size = 0; // Number of occupied cells; maintained by student code.
  }

  insert(value) {
    // TODO: Insert value in ascending order; return false if full.
    return false;
  }

  contains(value) {
    // TODO: Search for the value without changing the list.
    return false;
  }

  remove(value) {
    // TODO: Remove one matching value and report whether it existed.
    return false;
  }

  length() {
    // TODO: Return the current number of stored values.
    return 0;
  }
}

// Quick reference · ListMemory
//   memory.length       Physical capacity (8)
//   memory[i]           Read a cell: an integer or null
//   memory[i] = value   Write an integer (null clears a cell)
//   this.size           Student-maintained logical length
