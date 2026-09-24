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
REFERENCE: QueueMemory and the queue contract

  memory is QueueMemory(8): eight fixed cells indexed from 0 to 7.
  memory.length           Cell count (int).
  memory[index]           Read a cell (int?; null means an empty cell).
  memory[index] = value;  Write an int to an existing cell.
  memory[index] = null;   Clear an existing cell.

  front, rear, and size are int properties provided above. Their accessors
  delegate to QueueMemory so the sandbox can observe changes.
  front identifies the next element to remove; rear identifies the next
  insertion position; size is the number of stored elements (initially 0).
  front and rear initially equal 0 and may coincide both when empty and full.
  This is a circular, fixed-capacity representation; cells do not move.

  enqueue returns false and leaves the queue unchanged if full; otherwise true.
  dequeue and peek return int? (null if empty). peek does not remove a value.
  isEmpty and isFull return bool. Duplicate values are permitted.
*/
