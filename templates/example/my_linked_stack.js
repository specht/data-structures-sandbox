import { ListNode } from "sandbox";

// LIFO linked stack: head is the TOP. No fixed capacity or sorted ordering.
// Duplicate policy: allowed; every push stores another occurrence.
export default class MyLinkedStack {
  constructor() {
    this.head = null;
  }

  push(value) {
    const fresh = new ListNode(value);
    fresh.next = this.head;
    this.head = fresh;
    return true;
  }

  pop() {
    if (this.head === null) return null;
    const value = this.head.value;
    this.head = this.head.next;
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
