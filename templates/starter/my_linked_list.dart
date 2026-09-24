/*
Sorted singly linked list of integers.
Implement the public operations below.
*/

import '../../lib/sandbox.dart';

class MyLinkedList {
  ListNode? head;

  void insert(int value) {
    // TODO: Insert one occurrence of value, preserving ascending order.
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
REFERENCE: ListNode and the sorted-list contract

  ListNode(value)         Create a node containing an int.
  node.value             Read or write its int value.
  node.next              Read its successor (ListNode?; may be null).
  node.next = other;     Set its successor (other is ListNode?; may be null).
  head                   First node (ListNode?; initially null).

  The list is singly linked and ordered from smallest to largest; its
  references form a chain without cycles. Duplicate values are permitted.
  insert returns void and adds one occurrence.
  contains returns bool. remove returns bool and removes at most one occurrence.
*/
