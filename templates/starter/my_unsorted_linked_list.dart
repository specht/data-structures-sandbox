/*
Unsorted singly linked list: index-based access; duplicate values allowed.
*/
import '../../lib/sandbox.dart';

class MyUnsortedLinkedList {
  ListNode? head;
  int size = 0; // Number of reachable nodes; maintained by student code.

  bool insert(int index, int value) {
    // TODO: Insert value at index; return false for an invalid index.
    return false;
  }

  int? get(int index) {
    // TODO: Return the value at index, or null if invalid.
    return null;
  }

  int? removeAt(int index) {
    // TODO: Remove and return the value at index, or null if invalid.
    return null;
  }

  bool contains(int value) {
    // TODO: Test whether any node contains value.
    return false;
  }

  int length() {
    // TODO: Return the size field; do not traverse the chain to count.
    return 0;
  }
}

/*
Quick reference · ListNode
  ListNode(value)  Create a node
  node.value      Stored int
  node.next       Nullable successor reference
  head            Nullable first-node reference
  size            Student-maintained logical length
  Details: docs/list-exercises.md
*/
