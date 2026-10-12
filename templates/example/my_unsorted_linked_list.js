import { ListNode } from "sandbox";

// Unsorted singly linked list with index-based operations.
// Duplicate policy: allowed; every successful insert stores another occurrence.
export default class MyUnsortedLinkedList {
  constructor() {
    this.head = null;
    this.size = 0; // Number of reachable nodes; maintained by student code.
  }

  insert(index, value) {
    if (index < 0) return false;
    if (index === 0) {
      const fresh = new ListNode(value);
      fresh.next = this.head;
      this.head = fresh;
      this.size++;
      return true;
    }
    let previous = this.head;
    let i = 0;
    while (i < index - 1 && previous !== null) {
      previous = previous.next;
      i++;
    }
    if (previous === null) return false;
    const fresh = new ListNode(value);
    fresh.next = previous.next;
    previous.next = fresh;
    this.size++;
    return true;
  }

  get(index) {
    if (index < 0) return null;
    let current = this.head;
    let i = 0;
    while (i < index && current !== null) {
      current = current.next;
      i++;
    }
    return current === null ? null : current.value;
  }

  removeAt(index) {
    if (index < 0 || this.head === null) return null;
    if (index === 0) {
      const removed = this.head.value;
      this.head = this.head.next;
      this.size--;
      return removed;
    }
    let previous = this.head;
    let i = 0;
    while (i < index - 1 && previous !== null) {
      previous = previous.next;
      i++;
    }
    if (previous === null || previous.next === null) return null;
    const removedNode = previous.next;
    previous.next = removedNode.next;
    this.size--;
    return removedNode.value;
  }

  contains(value) {
    let current = this.head;
    while (current !== null) {
      if (current.value === value) return true;
      current = current.next;
    }
    return false;
  }

  length() {
    return this.size;
  }
}
