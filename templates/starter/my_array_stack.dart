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
REFERENCE: FixedMemory and the stack contract

  memory is FixedMemory(8): eight fixed cells indexed from 0 to 7.
  memory.length           Cell count (int).
  memory[index]           Read a cell (int?; null means an empty cell).
  memory[index] = value;  Write an int to an existing cell.
  memory[index] = null;   Clear an existing cell.

  top is an int maintained by this stack, not by FixedMemory.
  Initially top == -1; otherwise it identifies the occupied top cell.
  FixedMemory has no push, pop, add, removeLast, or top operation.
  The sandbox observes changes to top and memory; use this storage only.

  push returns false and leaves the stack unchanged if full; otherwise true.
  pop and peek return int? (null if empty). peek does not remove a value.
  isEmpty returns bool. Duplicate values are permitted.
*/
