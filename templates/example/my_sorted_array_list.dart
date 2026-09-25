import '../../lib/list_sandbox.dart';

// Fixed-capacity array list in nondecreasing order. Duplicates are retained.
class MySortedArrayList {
  final ListMemory memory = ListMemory(8);

  bool insert(int value) {
    if (memory.size == memory.length) return false;
    var index = 0;
    while (index < memory.size && memory[index]! <= value) {
      index++;
    }
    for (var i = memory.size; i > index; i--) {
      memory[i] = memory[i - 1];
    }
    memory[index] = value;
    memory.size = memory.size + 1;
    return true;
  }

  bool contains(int value) {
    for (var i = 0; i < memory.size; i++) {
      if (memory[i] == value) return true;
      if (memory[i]! > value) return false;
    }
    return false;
  }

  bool remove(int value) {
    var index = 0;
    while (index < memory.size && memory[index]! < value) index++;
    if (index == memory.size || memory[index] != value) return false;
    for (var i = index; i < memory.size - 1; i++) {
      memory[i] = memory[i + 1];
    }
    memory[memory.size - 1] = null;
    memory.size = memory.size - 1;
    return true;
  }

  int length() => memory.size;
}
