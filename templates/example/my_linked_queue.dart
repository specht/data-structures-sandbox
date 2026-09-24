import '../../lib/sandbox.dart';

// FIFO queue: head is the next element to leave; tail is the newest element.
// Empty iff BOTH references are null. Duplicate values are allowed.
class MyLinkedQueue {
  ListNode? head;
  ListNode? tail;

  bool enqueue(int value) {
    final fresh = ListNode(value);
    if (tail == null) {
      head = fresh;
    } else {
      tail!.next = fresh;
    }
    tail = fresh;
    return true;
  }

  int? dequeue() {
    if (head == null) return null;
    final value = head!.value;
    head = head!.next;
    if (head == null) tail = null;
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
