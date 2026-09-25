/*
Unsorted singly linked list: index-based access; duplicate values allowed.
*/
import '../../lib/sandbox.dart';

class MyUnsortedLinkedList {
  ListNode? head;

  bool insert(int index, int value) {
    // TODO: Return false for invalid indices without changing the list.
    // Insert a new node at index (0..length); index 0 updates head.
    return false;
  }

  int? get(int index) {
    // TODO: Traverse to the index, or return null if it is invalid.
    return null;
  }

  int? removeAt(int index) {
    // TODO: Unlink the node at index, update head if needed, and return
    // its value; return null without changes for invalid indices.
    return null;
  }

  bool contains(int value) {
    // TODO: Test whether any node contains value.
    return false;
  }

  int length() {
    // TODO: Count the reachable nodes by following next references.
    return 0;
  }
}

/*
REFERENCE: ListNode and unsorted-linked list contract
ListNode(value) creates a node; node.value is int; node.next is ListNode?;
head is the first node or null. The chain must be acyclic and end at null.
Duplicates are allowed and insertion does NOT sort values. insert(index,
value) accepts indices 0..length (inclusive); get and removeAt require
0..length-1. Invalid indices return false/null without modifying anything.
No fixed capacity. Use the same API as the unsorted array list.
*/
