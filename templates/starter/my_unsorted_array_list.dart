/*
Unsorted array list: index-based insert/get/remove, duplicate values allowed.
*/
import '../../lib/list_sandbox.dart';

class MyUnsortedArrayList {
  final ListMemory memory = ListMemory(8);

  bool insert(int index, int value) {
    // TODO: Reject invalid indices or full storage without changing anything.
    // Shift occupied cells to the right before inserting; update memory.size.
    return false;
  }

  int? get(int index) {
    // TODO: Return the indexed value, or null if the index is invalid.
    return null;
  }

  int? removeAt(int index) {
    // TODO: Remove one indexed value, shift the remaining cells left,
    // clear the last occupied cell and decrease memory.size.
    return null;
  }

  bool contains(int value) {
    // TODO: Search only the occupied prefix of the array.
    return false;
  }

  int length() {
    // TODO: Return the logical number of values, NOT memory.length.
    return 0;
  }
}

/*
REFERENCE: ListMemory and unsorted-array list contract
ListMemory(8) exposes memory.length (capacity), memory.size (logical length),
memory[index] (int?), and memory[index] = value (int?; null clears a cell).
You manage memory.size; ListMemory does not insert, remove or shift values.
Occupied cells must form the prefix [0, memory.size); all later cells are null.
insert(index, value) accepts 0..length, returns false for an invalid index or
when full, and otherwise inserts one occurrence at index. get and removeAt
return null for invalid indices; removeAt returns the removed value otherwise.
contains tests membership and length returns the current number of values.
*/
