import '../../lib/sandbox.dart';

// Unsorted singly linked list with index-based operations and duplicates.
class MyUnsortedLinkedList {
  ListNode? head;

  bool insert(int index, int value) {
    if (index < 0) return false;
    if (index == 0) {
      final fresh = ListNode(value);
      fresh.next = head;
      head = fresh;
      return true;
    }
    ListNode? previous = head;
    for (var i = 0; i < index - 1 && previous != null; i++) {
      previous = previous.next;
    }
    if (previous == null) return false;
    final fresh = ListNode(value);
    fresh.next = previous.next;
    previous.next = fresh;
    return true;
  }

  int? get(int index) {
    if (index < 0) return null;
    ListNode? current = head;
    for (var i = 0; i < index && current != null; i++) {
      current = current.next;
    }
    return current?.value;
  }

  int? removeAt(int index) {
    if (index < 0 || head == null) return null;
    if (index == 0) {
      final removed = head!.value;
      head = head!.next;
      return removed;
    }
    ListNode? previous = head;
    for (var i = 0; i < index - 1 && previous != null; i++) {
      previous = previous.next;
    }
    if (previous?.next == null) return null;
    final removed = previous!.next!;
    previous.next = removed.next;
    return removed.value;
  }

  bool contains(int value) {
    ListNode? current = head;
    while (current != null) {
      if (current.value == value) return true;
      current = current.next;
    }
    return false;
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
}
