import '../../lib/stack_sandbox.dart';

// Stack (fixed array). Begin here: implement push(), then pop(), then peek().
// Cells stay at fixed indices; top == -1 means empty. Never use List.add().
// Required contract: push false if full, pop/peek null if empty, duplicates OK.
class MyArrayStack {
  final FixedMemory memory = FixedMemory(8);
  // Student-owned logical state. -1 means no element is stored.
  int top = -1;

  bool push(int value) {
    // TODO: Check capacity, move top, write value into memory[top].
    return false;
  }

  int? pop() {
    // TODO: Return null when empty. Clear the old cell and move top down.
    return null;
  }

  int? peek() {
    // TODO: Return the current top value without removing it.
    return null;
  }

  bool isEmpty() => top == -1;
}
