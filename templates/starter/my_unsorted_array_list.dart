/*
Unsorted array list: index-based insert/get/remove, duplicate values allowed.
*/
import '../../lib/list_sandbox.dart';

class MyUnsortedArrayList {
  final ListMemory memory = ListMemory(8);
  int size = 0; // Number of occupied cells; maintained by student code.

  bool insert(int index, int value) {
    // TODO: Insert value at index; return false if invalid or full.
    return false;
  }

  int? get(int index) {
    // TODO: Return the indexed value, or null if the index is invalid.
    return null;
  }

  int? removeAt(int index) {
    // TODO: Remove and return the value at index, or null if invalid.
    return null;
  }

  bool contains(int value) {
    // TODO: Return whether value is in the list.
    return false;
  }

  int length() {
    // TODO: Return the student-maintained size, NOT memory.length.
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
