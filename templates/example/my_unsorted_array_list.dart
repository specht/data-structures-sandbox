import '../../lib/list_sandbox.dart';

// Unsorted, fixed-capacity array list. The list owns its logical size.
// Values are stored contiguously in cells 0..size-1.
class MyUnsortedArrayList {
  final ListMemory memory = ListMemory(8);
  int size = 0; // Number of occupied cells; maintained by student code.

  bool insert(int index, int value) {
    if (index < 0 || index > size || size == memory.length) {
      return false;
    }
    for (var i = size; i > index; i--) {
      memory[i] = memory[i - 1];
    }
    memory[index] = value;
    size = size + 1;
    return true;
  }

  int? get(int index) {
    if (index < 0 || index >= size) return null;
    return memory[index];
  }

  int? removeAt(int index) {
    if (index < 0 || index >= size) return null;
    final removed = memory[index];
    for (var i = index; i < size - 1; i++) {
      memory[i] = memory[i + 1];
    }
    memory[size - 1] = null;
    size = size - 1;
    return removed;
  }

  bool contains(int value) {
    for (var i = 0; i < size; i++) {
      if (memory[i] == value) return true;
    }
    return false;
  }

  int length() => size;
}
