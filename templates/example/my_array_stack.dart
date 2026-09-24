import '../../lib/stack_sandbox.dart';

// Fixed-capacity stack: no List.add(), no List.removeLast().
// The fixed array indices stay stable; only values and top change.
class MyArrayStack {
  final FixedMemory memory = FixedMemory(8);
  // The stack owns its logical top; FixedMemory contains only its cells.
  // The sandbox instruments top assignments in a separate copy of this file.
  int top = -1;

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
