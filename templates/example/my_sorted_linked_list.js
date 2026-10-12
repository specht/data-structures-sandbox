import { ListNode } from "sandbox";

// Sorted singly linked list.
// Public methods with simple arguments appear automatically in the browser.
// Duplicate policy: allowed; every insert stores another occurrence.
export default class MySortedLinkedList {
  constructor() {
    this.head = null;
    this.size = 0; // Maintained by the student, not calculated by the recorder.
  }

  insert(value) {
    let current = this.head;
    let previous = null;
    while (current !== null && current.value < value) {
      previous = current;
      current = current.next;
    }
    const fresh = new ListNode(value);
    fresh.next = current;
    if (previous === null) {
      this.head = fresh;
    } else {
      previous.next = fresh;
    }
    this.size++;
    return true;
  }

  length() {
    return this.size;
  }

  contains(value) {
    let current = this.head;
    while (current !== null) {
      if (current.value === value) return true;
      current = current.next;
    }
    return false;
  }

  remove(value) {
    let current = this.head;
    let previous = null;
    while (current !== null) {
      if (current.value === value) {
        if (previous === null) {
          this.head = current.next;
        } else {
          previous.next = current.next;
        }
        this.size--;
        return true;
      }
      previous = current;
      current = current.next;
    }
    return false;
  }
}
