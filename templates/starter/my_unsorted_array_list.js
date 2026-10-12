// Unsorted array list with index-based insert/get/remove operations.
// Duplicate policy: allowed; every successful insert stores another occurrence.

import { ListMemory } from "sandbox";

export default class MyUnsortedArrayList {
  constructor() {
    this.memory = new ListMemory(8);
    this.size = 0; // Number of occupied cells; maintained by student code.
  }

  insert(index, value) {
    // TODO: Insert value at index; return false if invalid or full.
    return false;
  }

  get(index) {
    // TODO: Return the indexed value, or null if the index is invalid.
    return null;
  }

  removeAt(index) {
    // TODO: Remove and return the value at index, or null if invalid.
    return null;
  }

  contains(value) {
    // TODO: Return whether value is in the list.
    return false;
  }

  length() {
    // TODO: Return the student-maintained size, NOT this.memory.length.
    return 0;
  }
}

// Quick reference · ListMemory
//   memory.length       Physical capacity (8)
//   memory[i]           Read a cell: an integer or null
//   memory[i] = value   Write an integer (null clears a cell)
//   this.size           Student-maintained logical length
