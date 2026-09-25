import '../../lib/list_sandbox.dart';

// Fixed-capacity array list in nondecreasing order. Duplicates are retained.
class MySortedArrayList {
  final ListMemory memory = ListMemory(8);
  int size = 0; // Number of occupied cells; maintained by student code.

  bool insert(int value) {
    if (size == memory.length) return false;
    var index = 0;
    while (index < size && memory[index]! <= value) {
      index++;
    }
    for (var i = size; i > index; i--) {
      memory[i] = memory[i - 1];
    }
    memory[index] = value;
    size = size + 1;
    return true;
  }

  bool contains(int value) {
    for (var i = 0; i < size; i++) {
      if (memory[i] == value) return true;
      if (memory[i]! > value) return false;
    }
    return false;
  }

  bool remove(int value) {
    var index = 0;
    while (index < size && memory[index]! < value) index++;
    if (index == size || memory[index] != value) return false;
    for (var i = index; i < size - 1; i++) {
      memory[i] = memory[i + 1];
    }
    memory[size - 1] = null;
    size = size - 1;
    return true;
  }

  int length() => size;
}
