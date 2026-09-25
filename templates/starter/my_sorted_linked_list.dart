/*
Sorted singly linked list of integers.
Implement the public operations below.
*/

import '../../lib/sandbox.dart';

class MySortedLinkedList {
  ListNode? head;
  int size = 0; // Number of nodes; update this field yourself.

  bool insert(int value) {
    // TODO: Insert one occurrence in ascending order and return true.
    return false;
  }

  int length() {
    // TODO: Return the student-maintained size field (no traversal).
    return 0;
  }

  bool contains(int value) {
    // TODO: Return true if the list contains value; otherwise return false.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove one occurrence of value; return true if it was present.
    return false;
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
