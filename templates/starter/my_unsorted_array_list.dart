/*
Unsorted array list: index-based insert/get/remove, duplicate values allowed.
*/
import '../../lib/list_sandbox.dart';

class MyUnsortedArrayList {
  final ListMemory memory = ListMemory(8);
  int size = 0; // Number of occupied cells; maintained by student code.

  bool insert(int index, int value) {
    // TODO: Reject invalid indices or full storage without changing anything.
    // Shift occupied cells to the right before inserting; update size.
    return false;
  }

  int? get(int index) {
    // TODO: Return the indexed value, or null if the index is invalid.
    return null;
  }

  int? removeAt(int index) {
    // TODO: Remove one indexed value, shift the remaining cells left,
    // clear the last occupied cell and decrease size.
    return null;
  }

  bool contains(int value) {
    // TODO: Search only the occupied prefix of the array.
    return false;
  }

  int length() {
    // TODO: Return the student-maintained size, NOT memory.length.
    return 0;
  }
}

/*
REFERENCE: ListMemory and unsorted-array list contract
ListMemory(8) exposes memory.length (capacity), memory[index] (int?),
and memory[index] = value (int?; null clears a cell).
The class field `int size = 0` is YOUR responsibility; update it after every
successful insertion/removal. ListMemory does not track how many cells are full.
Occupied cells must form the prefix [0, size); all later cells are null.
insert(index, value) accepts 0..length, returns false for an invalid index or
when full, and otherwise inserts one occurrence at index. get and removeAt
return null for invalid indices; removeAt returns the removed value otherwise.
contains tests membership and length returns the current number of values.
*/
