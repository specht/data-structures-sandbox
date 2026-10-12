// Linked queue (FIFO).
// Duplicate policy: allowed; every enqueue stores another occurrence.
// Implement the public operations below.

import { ListNode } from "sandbox";

export default class MyLinkedQueue {
  constructor() {
    this.head = null;
    this.tail = null;
  }

  enqueue(value) {
    // TODO: Add value at the end of the queue and return true.
    return false;
  }

  dequeue() {
    // TODO: Remove and return the oldest value, or null if the queue is empty.
    return null;
  }

  peek() {
    // TODO: Return the oldest value without removing it, or null if empty.
    return null;
  }

  isEmpty() {
    // TODO: Return true exactly when the queue contains no elements.
    return false;
  }
}

// Quick reference · ListNode
//   new ListNode(value)     Create a node
//   node.value              Stored integer
//   node.next               Successor node or null
//   this.head / this.tail   Oldest / newest node (null if empty)
