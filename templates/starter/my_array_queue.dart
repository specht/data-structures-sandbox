/*
Fixed-capacity circular queue (FIFO).
Implement the public operations below.
*/

import '../../lib/queue_sandbox.dart';

class MyArrayQueue {
  final QueueMemory memory = QueueMemory(8);
  int get front => memory.front;
  set front(int index) => memory.front = index;
  int get rear => memory.rear;
  set rear(int index) => memory.rear = index;
  int get size => memory.size;
  set size(int value) => memory.size = value;

  bool enqueue(int value) {
    // TODO: Add value at the end; return false without changing the queue if full.
    return false;
  }

  int? dequeue() {
    // TODO: Remove and return the oldest value, or null if the queue is empty.
    return null;
  }

  int? peek() {
    // TODO: Return the oldest value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the queue contains no elements.
    return false;
  }

  bool isFull() {
    // TODO: Return true exactly when the queue has reached its capacity.
    return false;
  }
}

/*
Quick reference · QueueMemory
  memory.length       Physical capacity (8)
  memory[i]           Read an int? cell
  memory[i] = value   Write an int? (null clears a cell)
  front / rear        Next removal / insertion positions
  size                Current number of stored values
  Details: docs/contracts.md, docs/storage-api.md
*/
