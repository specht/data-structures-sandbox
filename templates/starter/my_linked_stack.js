// Linked stack (LIFO).
// Duplicate policy: allowed; every push stores another occurrence.
// Implement the public operations below.

import { ListNode } from "sandbox";

export default class MyLinkedStack {
  constructor() {
    this.head = null;
  }

  push(value) {
    // TODO: Add value to the stack and return true.
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

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored integer
//   node.next             Successor node or null
//   this.head             Top node or null
