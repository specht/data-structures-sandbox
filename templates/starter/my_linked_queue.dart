import '../../lib/sandbox.dart';

// Queue (linked list). head = oldest value; tail = newest value.
// Both references must be null for an empty queue. Duplicates are allowed.
class MyLinkedQueue {
  ListNode? head;
  ListNode? tail;

  bool enqueue(int value) {
    // TODO: Append a new node. Update both references when initially empty.
    return false;
  }

  int? dequeue() {
    // TODO: Remove head; make tail null as well if removing the last node.
    return null;
  }

  int? peek() {
    // TODO: Return null when empty; otherwise inspect head.
    return null;
  }

  bool isEmpty() => head == null;
}
