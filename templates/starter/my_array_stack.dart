/*
Fixed-capacity array stack (LIFO).
Implement the public operations below.
*/

import '../../lib/stack_sandbox.dart';

class MyArrayStack {
  final FixedMemory memory = FixedMemory(8);
  // Student-owned logical state. -1 means no element is stored.
  int top = -1;

  bool push(int value) {
    // TODO: Add value to the stack; return false without changing it if full.
    return false;
  }

  int? pop() {
    // TODO: Remove and return the top value, or null if the stack is empty.
    return null;
  }

  int? peek() {
    // TODO: Return the top value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the stack contains no elements.
    return false;
  }
}

/*
Quick reference · FixedMemory
  memory.length       Physical capacity (8)
  memory[i]           Read an int? cell
  memory[i] = value   Write an int? (null clears a cell)
  top                 Student-maintained top index (-1 if empty)
  Details: docs/contracts.md, docs/storage-api.md
*/
