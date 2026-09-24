import '../../lib/stack_sandbox.dart';

// Fixed-capacity stack: no List.add(), no List.removeLast().
// The fixed array indices stay stable; only values and top change.
class MyArrayStack {
  final FixedMemory memory = FixedMemory(8);
  // The observable fixed-memory object owns the top index too. No tracing
  // or visualization calls belong in student implementations.
  int get top => memory.top;
  set top(int value) => memory.top = value;

  bool push(int value) {
    if (top + 1 == memory.length) return false;
    top = top + 1;
    memory[top] = value;
    return true;
  }

  int? pop() {
    if (top < 0) return null;
    final value = memory[top];
    memory[top] = null;
    top = top - 1;
    return value;
  }

  int? peek() {
    if (top < 0) return null;
    return memory[top];
  }

  bool isEmpty() => top == -1;
}
