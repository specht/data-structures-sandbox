import '../../lib/queue_sandbox.dart';

// Circular queue: cells stay at fixed indices, even when front/rear wrap.
// front = index of the next item to dequeue;
// rear  = index of the next empty cell to enqueue into.
// Both are 0 when the queue starts. size distinguishes full from empty.
class MyArrayQueue {
  final QueueMemory memory = QueueMemory(8);

  int get front => memory.front;
  set front(int value) => memory.front = value;
  int get rear => memory.rear;
  set rear(int value) => memory.rear = value;
  int get size => memory.size;
  set size(int value) => memory.size = value;

  bool enqueue(int value) {
    if (size == memory.length) return false;
    memory[rear] = value;
    rear = (rear + 1) % memory.length;
    size = size + 1;
    return true;
  }

  int? dequeue() {
    if (size == 0) return null;
    final value = memory[front];
    memory[front] = null;
    front = (front + 1) % memory.length;
    size = size - 1;
    return value;
  }

  int? peek() {
    if (size == 0) return null;
    return memory[front];
  }

  bool isEmpty() => size == 0;
  bool isFull() => size == memory.length;
}
