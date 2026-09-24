import '../../lib/sandbox.dart';

// LIFO linked stack: head is the TOP. No fixed capacity or sorted ordering.
// The example is intentionally small enough for students to implement afresh.
class MyLinkedStack {
  ListNode? head;

  bool push(int value) {
    final fresh = ListNode(value);
    fresh.next = head;
    head = fresh;
    return true;
  }

  int? pop() {
    if (head == null) return null;
    final value = head!.value;
    head = head!.next;
    return value;
  }

  int? peek() {
    if (head == null) return null;
    return head!.value;
  }

  bool isEmpty() {
    return head == null;
  }
}
