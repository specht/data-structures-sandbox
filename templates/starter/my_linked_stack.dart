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
REFERENCE: ListNode and the stack contract

  ListNode(value)         Create a node containing an int.
  node.value             Read or write its int value.
  node.next              Read its successor (ListNode?; may be null).
  node.next = other;     Set its successor (other is ListNode?; may be null).
  head                   Top reference (ListNode?; initially null).

  There is no FixedMemory or integer top in this representation.
  The nodes reachable from head form the stack; duplicates are permitted.
  push returns true. pop and peek return int? (null if empty).
  peek does not remove a value. isEmpty returns bool.
*/
