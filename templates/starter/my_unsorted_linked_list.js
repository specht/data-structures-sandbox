// Unsorted singly linked list with index-based access.
// Duplicate policy: allowed; every successful insert stores another occurrence.

import { ListNode } from "sandbox";

export default class MyUnsortedLinkedList {
  constructor() {
    this.head = null;
    this.size = 0; // Number of reachable nodes; maintained by student code.
  }

  insert(index, value) {
    // TODO: Insert value at index; return false for an invalid index.
    return false;
  }

  get(index) {
    // TODO: Return the value at index, or null if invalid.
    return null;
  }

  removeAt(index) {
    // TODO: Remove and return the value at index, or null if invalid.
    return null;
  }

  contains(value) {
    // TODO: Test whether any node contains value.
    return false;
  }

  length() {
    // TODO: Return the size field; do not traverse the chain to count.
    return 0;
  }
}

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored integer
//   node.next             Successor node or null
//   this.head             First node or null
//   this.size             Student-maintained logical length
