import { ListNode } from "sandbox";

// FIFO queue: head is the next element to leave; tail is the newest element.
// Empty iff BOTH references are null.
// Duplicate policy: allowed; every enqueue stores another occurrence.
export default class MyLinkedQueue {
  constructor() {
    this.head = null;
    this.tail = null;
  }

  enqueue(value) {
    const fresh = new ListNode(value);
    if (this.tail === null) {
      this.head = fresh;
    } else {
      this.tail.next = fresh;
    }
    this.tail = fresh;
    return true;
  }

  dequeue() {
    if (this.head === null) return null;
    const value = this.head.value;
    this.head = this.head.next;
    if (this.head === null) this.tail = null;
    return value;
  }

  peek() {
    if (this.head === null) return null;
    return this.head.value;
  }

  isEmpty() {
    return this.head === null;
  }
}
