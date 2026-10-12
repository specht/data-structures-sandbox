// Fixed-capacity circular queue (FIFO).
// Duplicate policy: allowed; every successful enqueue stores another occurrence.
// Implement the public operations below.

import { QueueMemory } from "sandbox";

export default class MyArrayQueue {
  constructor() {
    this.memory = new QueueMemory(8);
  }

  enqueue(value) {
    // TODO: Add value at the end; return false without changing the queue if full.
    return false;
  }

  dequeue() {
    // TODO: Remove and return the oldest value, or null if the queue is empty.
    return null;
  }

  peek() {
    // TODO: Return the oldest value without removing it, or null if empty.
    return null;
  }

  isEmpty() {
    // TODO: Return true exactly when the queue contains no elements.
    return false;
  }

  isFull() {
    // TODO: Return true exactly when the queue has reached its capacity.
    return false;
  }
}

// Quick reference · QueueMemory
//   memory.length       Physical capacity (8)
//   memory[i]           Read a cell: an integer or null
//   memory[i] = value   Write an integer (null clears a cell)
//   memory.front        Index of the next value to dequeue
//   memory.rear         Index of the next free cell
//   memory.size         Current number of stored values
