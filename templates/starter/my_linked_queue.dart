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
REFERENCE: ListNode and the queue contract

  ListNode(value)         Create a node containing an int.
  node.value             Read or write its int value.
  node.next              Read its successor (ListNode?; may be null).
  node.next = other;     Set its successor (other is ListNode?; may be null).
  head                   Oldest node (ListNode?; initially null).
  tail                   Newest node (ListNode?; initially null).

  For an empty queue, both head and tail are null.
  For a nonempty queue, tail.next is null. Duplicate values are permitted;
  the queue has no fixed capacity.
  enqueue returns true. dequeue and peek return int? (null if empty).
  peek does not remove a value. isEmpty returns bool.
*/
