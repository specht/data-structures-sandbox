import '../../lib/list_sandbox.dart';

// Unsorted, fixed-capacity array list. The list owns its logical size.
// Values are stored contiguously in cells 0..memory.size-1.
class MyUnsortedArrayList {
  final ListMemory memory = ListMemory(8);

  bool insert(int index, int value) {
    if (index < 0 || index > memory.size || memory.size == memory.length) {
      return false;
    }
    for (var i = memory.size; i > index; i--) {
      memory[i] = memory[i - 1];
    }
    memory[index] = value;
    memory.size = memory.size + 1;
    return true;
  }

  int? get(int index) {
    if (index < 0 || index >= memory.size) return null;
    return memory[index];
  }

  int? removeAt(int index) {
    if (index < 0 || index >= memory.size) return null;
    final removed = memory[index];
    for (var i = index; i < memory.size - 1; i++) {
      memory[i] = memory[i + 1];
    }
    memory[memory.size - 1] = null;
    memory.size = memory.size - 1;
    return removed;
  }

  bool contains(int value) {
    for (var i = 0; i < memory.size; i++) {
      if (memory[i] == value) return true;
    }
    return false;
  }

  int length() => memory.size;
}
