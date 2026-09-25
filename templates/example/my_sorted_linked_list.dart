import '../../lib/sandbox.dart';

// Sorted singly linked list. Change this file, not tool/generated/.
// Public methods with simple arguments appear automatically in the browser.
class MySortedLinkedList {
  ListNode? head;

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
    return true;
  }

  int length() {
    var count = 0;
    ListNode? current = head;
    while (current != null) {
      count++;
      current = current.next;
    }
    return count;
  }

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
        return true;
      }
      previous = current;
      current = current.next;
    }
    return false;
  }
}
