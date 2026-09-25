/*
Sorted ascending array list: duplicates allowed, capacity 8.
*/
import '../../lib/list_sandbox.dart';

class MySortedArrayList {
  final ListMemory memory = ListMemory(8);
  int size = 0; // Number of occupied cells; maintained by student code.

  bool insert(int value) {
    // TODO: Insert value in ascending order; return false if full.
    return false;
  }

  bool contains(int value) {
    // TODO: Search for the value without changing the list.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove one matching value and report whether it existed.
    return false;
  }

  int length() {
    // TODO: Return the current number of stored values.
    return 0;
  }
}

/*
Quick reference · ListMemory
  memory.length       Physical capacity (8)
  memory[i]           Read an int? cell
  memory[i] = value   Write an int? (null clears a cell)
  size                Student-maintained logical length
  Details: docs/list-exercises.md, docs/storage-api.md
*/
