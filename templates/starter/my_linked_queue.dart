/*
Linked queue (FIFO).
Implement the public operations below.
*/

import '../../lib/sandbox.dart';

class MyLinkedQueue {
  ListNode? head;
  ListNode? tail;

  bool enqueue(int value) {
    // TODO: Add value at the end of the queue and return true.
    return false;
  }

  int? dequeue() {
    // TODO: Remove and return the oldest value, or null if the queue is empty.
    return null;
  }

  int? peek() {
    // TODO: Return the oldest value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the queue contains no elements.
    return false;
  }
}

/*
Quick reference · ListNode
  ListNode(value)  Create a node
  node.value      Stored int
  node.next       Nullable successor reference
  head / tail     Oldest / newest node (null if empty)
  Details: docs/contracts.md, docs/storage-api.md
*/
