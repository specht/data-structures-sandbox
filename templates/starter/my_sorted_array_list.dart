/*
Sorted ascending array list: duplicates allowed, capacity 8.
*/
import '../../lib/list_sandbox.dart';

class MySortedArrayList {
  final ListMemory memory = ListMemory(8);
  int size = 0; // Number of occupied cells; maintained by student code.

  bool insert(int value) {
    // TODO: Reject when full; find the sorted insertion position,
    // shift cells right, insert one occurrence and increase size.
    return false;
  }

  bool contains(int value) {
    // TODO: Search for the value without changing the list.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove exactly one occurrence if present, shift the suffix
    // to the left, clear the vacated cell and decrease size.
    return false;
  }

  int length() {
    // TODO: Return the current number of stored values.
    return 0;
  }
}

/*
REFERENCE: ListMemory and sorted-array list contract
ListMemory is observable indexed storage with nullable cells and capacity
memory.length. The class field `int size = 0` belongs to your implementation.
All occupied cells are the contiguous prefix 0..size-1; remaining
cells are null. Values in that prefix must be in ascending (nondecreasing)
order, including duplicates. insert returns false with no changes when full;
otherwise inserts one value and returns true. remove deletes one occurrence
and returns true, or false if absent. contains tests membership.
*/
