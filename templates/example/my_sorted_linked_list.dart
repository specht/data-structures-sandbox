import '../../lib/sandbox.dart';

// Sorted singly linked list. Change this file, not tool/generated/.
// Public methods with simple arguments appear automatically in the browser.
class MySortedLinkedList {
  ListNode? head;
  int size = 0; // Maintained by the student, not calculated by the recorder.

  bool insert(int value) {
    ListNode? current = head;
    ListNode? previous;
    while (current != null && current.value < value) {
      previous = current;
      current = current.next;
    }
    final fresh = ListNode(value);
    fresh.next = current;
    if (previous == null) {
      head = fresh;
    } else {
      previous.next = fresh;
    }
    size++;
    return true;
  }

  int length() => size;

  bool contains(int value) {
    ListNode? current = head;
    while (current != null) {
      if (current.value == value) return true;
      current = current.next;
    }
    return false;
  }

  bool remove(int value) {
    ListNode? current = head;
    ListNode? previous;
    while (current != null) {
      if (current.value == value) {
        if (previous == null) {
          head = current.next;
        } else {
          previous.next = current.next;
        }
        size--;
        return true;
      }
      previous = current;
      current = current.next;
    }
    return false;
  }
}
