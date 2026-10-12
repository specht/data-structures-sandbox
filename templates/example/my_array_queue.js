import { QueueMemory } from "sandbox";

// Circular queue: cells stay at fixed indices, even when front/rear wrap.
// memory.front = index of the next item to dequeue;
// memory.rear  = index of the next empty cell to enqueue into.
// Both are 0 when the queue starts. size distinguishes full from empty.
// Duplicate policy: allowed; every successful enqueue stores another occurrence.
export default class MyArrayQueue {
  constructor() {
    this.memory = new QueueMemory(8);
  }

  enqueue(value) {
    const memory = this.memory;
    if (memory.size === memory.length) return false;
    memory[memory.rear] = value;
    memory.rear = (memory.rear + 1) % memory.length;
    memory.size = memory.size + 1;
    return true;
  }

  dequeue() {
    const memory = this.memory;
    if (memory.size === 0) return null;
    const value = memory[memory.front];
    memory[memory.front] = null;
    memory.front = (memory.front + 1) % memory.length;
    memory.size = memory.size - 1;
    return value;
  }

  peek() {
    if (this.memory.size === 0) return null;
    return this.memory[this.memory.front];
  }

  isEmpty() {
    return this.memory.size === 0;
  }

  isFull() {
    return this.memory.size === this.memory.length;
  }
}
