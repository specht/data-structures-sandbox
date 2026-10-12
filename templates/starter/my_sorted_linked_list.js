// Sorted singly linked list of integers.
// Duplicate policy: allowed; every insert stores another occurrence.
// Implement the public operations below.

import { ListNode } from "sandbox";

export default class MySortedLinkedList {
  constructor() {
    this.head = null;
    this.size = 0; // Number of nodes; update this field yourself.
  }

  insert(value) {
    // TODO: Insert one occurrence in ascending order and return true.
    return false;
  }

  length() {
    // TODO: Return the student-maintained size field (no traversal).
    return 0;
  }

  contains(value) {
    // TODO: Return true if the list contains value; otherwise return false.
    return false;
  }

  remove(value) {
    // TODO: Remove one occurrence of value; return true if it was present.
    return false;
  }
}

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored integer
//   node.next             Successor node or null
//   this.head             First node or null
//   this.size             Student-maintained logical length
