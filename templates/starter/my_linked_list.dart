import '../../lib/sandbox.dart';

// Sorted singly linked list of integers (current sandbox contract).
// insert keeps ascending order; duplicates are allowed; remove deletes ONE
// occurrence. Do not add append() to a sorted-list implementation.
class MyLinkedList {
  ListNode? head;

  void insert(int value) {
    // TODO: Find the insertion position, link a fresh ListNode(value).
  }

  bool contains(int value) {
    // TODO: Traverse the chain, return true if one node holds value.
    return false;
  }

  bool remove(int value) {
    // TODO: Unlink only the first matching node, return whether it existed.
    return false;
  }
}
