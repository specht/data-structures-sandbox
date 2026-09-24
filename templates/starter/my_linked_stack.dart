import '../../lib/sandbox.dart';

// Stack (linked list). head points to the top; duplicates are allowed.
class MyLinkedStack {
  ListNode? head;

  bool push(int value) {
    // TODO: Allocate ListNode(value), link it to head, update head.
    return false;
  }

  int? pop() {
    // TODO: Return null if empty; otherwise return and unlink the head value.
    return null;
  }

  int? peek() {
    // TODO: Inspect the head without unlinking it.
    return null;
  }

  bool isEmpty() => head == null;
}
