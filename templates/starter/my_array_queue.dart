import '../../lib/queue_sandbox.dart';

// Queue (fixed circular array). front = next dequeue; rear = next enqueue.
// front and rear may coincide in both empty and full states: use size.
class MyArrayQueue {
  final QueueMemory memory = QueueMemory(8);
  int get front => memory.front;
  set front(int index) => memory.front = index;
  int get rear => memory.rear;
  set rear(int index) => memory.rear = index;
  int get size => memory.size;
  set size(int value) => memory.size = value;

  bool enqueue(int value) {
    // TODO: Return false when full; write at rear and advance modulo capacity.
    return false;
  }

  int? dequeue() {
    // TODO: Return null when empty; clear front, advance, decrease size.
    return null;
  }

  int? peek() {
    // TODO: Inspect the front item, or return null when empty.
    return null;
  }

  bool isEmpty() => size == 0;
  bool isFull() => size == memory.length;
}
