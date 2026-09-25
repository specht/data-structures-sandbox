/*
Linked stack (LIFO).
Implement the public operations below.
*/

import '../../lib/sandbox.dart';

class MyLinkedStack {
  ListNode? head;

  bool push(int value) {
    // TODO: Add value to the stack and return true.
    return false;
  }

  int? pop() {
    // TODO: Remove and return the top value, or null if the stack is empty.
    return null;
  }

  int? peek() {
    // TODO: Return the top value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the stack contains no elements.
    return false;
  }
}

/*
Quick reference · ListNode
  ListNode(value)  Create a node
  node.value      Stored int
  node.next       Nullable successor reference
  head            Nullable top-node reference
  Details: docs/contracts.md, docs/storage-api.md
*/
