// The four list exercises: (un)sorted × fixed array / singly linked nodes.
// All four keep a student-owned `int size`.
import '../list_sandbox.dart' as list_memory_api;
import '../sandbox.dart' as list_api;
import '../worker/adapter.dart';

/// Reference model shared by the unsorted lists and the sorted array list.
bool _updateListReference(List<int> reference, String name, List<Object?> args,
    Object? returned, {required bool positional, required bool capacityLimited}) {
  final value = args.length == 1 && args[0] is int ? args[0] as int : null;
  final index = positional && args.isNotEmpty ? args[0] as int : null;
  final item = positional && args.length == 2 ? args[1] as int : value;
  switch (name) {
    case 'insert':
      if (item == null) return false;
      final allowed = (!capacityLimited || reference.length < 8) &&
          (!positional || (index != null && index >= 0 && index <= reference.length));
      if (allowed) {
        if (positional) {
          reference.insert(index!, item);
        } else {
          var at = 0;
          while (at < reference.length && reference[at] <= item) {
            at++;
          }
          reference.insert(at, item);
        }
      }
      return returned == allowed;
    case 'get':
      if (index == null) return false;
      return returned == (index >= 0 && index < reference.length ? reference[index] : null);
    case 'removeAt':
      if (index == null) return false;
      final expected =
          index >= 0 && index < reference.length ? reference.removeAt(index) : null;
      return returned == expected;
    case 'remove':
      if (item == null) return false;
      final expected = reference.remove(item);
      return returned == expected;
    case 'contains':
      return item != null && returned == reference.contains(item);
    case 'length':
      return returned == reference.length;
    default:
      return false;
  }
}

const _unsortedMethods = {'insert', 'get', 'removeAt', 'contains', 'length'};
const _sortedMethods = {'insert', 'contains', 'remove', 'length'};

/// `MyUnsortedArrayList` / `MySortedArrayList`: ListMemory memory + size.
class ArrayListAdapter extends StructureAdapter {
  ArrayListAdapter.unsorted({required super.create, required super.invoke, required super.methodsJson})
      : sorted = false,
        super('unsorted_array_list');
  ArrayListAdapter.sorted({required super.create, required super.invoke, required super.methodsJson})
      : sorted = true,
        super('sorted_array_list');

  final bool sorted;

  list_memory_api.ListMemory get memory => s.memory;
  int get size => s.size;

  @override
  dynamic createRecorder(List<String> lines) => list_memory_api.ListRecorder(lines)
    ..memory = (() => s.memory)
    ..size = (() => s.size);

  @override
  void activate(dynamic recorder) => list_memory_api.ListRecorder.active =
      recorder as list_memory_api.ListRecorder;

  @override
  Set<String> get standardMethods => sorted ? _sortedMethods : _unsortedMethods;

  @override
  bool get insertTakesIndex => !sorted;

  @override
  Object? expectedReturn(String name, List<Object?> args) {
    if (name != 'insert') return super.expectedReturn(name, args);
    if (sorted) return reference.length < 8;
    final index = args.isNotEmpty ? args.first as int : null;
    return reference.length < 8 && index != null && index >= 0 && index <= reference.length;
  }

  @override
  List<int> actualValues() {
    final values = <int>[];
    final cells = memory.copy();
    if (size < 0 || size > cells.length) return [invalidMarker];
    for (var i = 0; i < size; i++) {
      final cell = cells[i];
      if (cell == null) return [invalidMarker];
      values.add(cell);
    }
    return values;
  }

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) =>
      _updateListReference(reference, name, args, returned,
          positional: !sorted, capacityLimited: true);

  /// A contiguous occupied prefix, nothing hidden after `size`, and for the
  /// sorted list ascending order.
  bool storageValid() {
    if (size < 0 || size > memory.length || size != reference.length) return false;
    final cells = memory.copy();
    for (var i = 0; i < cells.length; i++) {
      if ((i < size) != (cells[i] != null)) return false;
      if (sorted && i > 0 && i < size && cells[i - 1]! > cells[i]!) return false;
    }
    return true;
  }

  @override
  List<String> executionProblems() =>
      storageValid() ? const [] : const ['list storage, length or order'];

  @override
  void structuralChecks(Check check) {
    check('Logical size', reference.length, size);
    check('List storage and ordering', true, storageValid());
    check('Fixed capacity', 8, memory.length);
  }
}

/// `MyUnsortedLinkedList` / `MySortedLinkedList`: `ListNode? head` + size.
class LinkedListAdapter extends StructureAdapter {
  LinkedListAdapter.unsorted({required super.create, required super.invoke, required super.methodsJson})
      : sorted = false,
        super('unsorted_linked_list');
  LinkedListAdapter.sorted({required super.create, required super.invoke, required super.methodsJson})
      : sorted = true,
        super('sorted_linked_list');

  final bool sorted;

  list_api.ListNode? get head => s.head;
  int get size => s.size;

  @override
  void resetIds() => list_api.Recorder.resetIds();

  @override
  dynamic createRecorder(List<String> lines) => list_api.Recorder(lines)
    ..root = (() => s.head)
    ..size = (() => s.size);

  @override
  void activate(dynamic recorder) =>
      list_api.Recorder.active = recorder as list_api.Recorder;

  @override
  Set<String> get standardMethods => sorted ? _sortedMethods : _unsortedMethods;

  @override
  bool get insertTakesIndex => !sorted;

  @override
  Object? expectedReturn(String name, List<Object?> args) {
    if (name != 'insert') return super.expectedReturn(name, args);
    if (sorted) return true;
    final index = args.isNotEmpty ? args.first as int : null;
    return index != null && index >= 0 && index <= reference.length;
  }

  @override
  List<int> actualValues() => chainValues(head);

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    if (!sorted) {
      return _updateListReference(reference, name, args, returned,
          positional: true, capacityLimited: false);
    }
    if (name == 'length') return returned == reference.length;
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    if (value == null) {
      reference
        ..clear()
        ..addAll(actualValues());
      return true;
    }
    final present = reference.contains(value);
    switch (name) {
      case 'insert':
        final index = reference.indexWhere((v) => v >= value);
        reference.insert(index < 0 ? reference.length : index, value);
        return returned == true;
      case 'contains':
        return returned == present;
      case 'remove':
        reference.remove(value);
        return returned == present;
      default:
        reference
          ..clear()
          ..addAll(actualValues());
        return true;
    }
  }

  /// An acyclic chain whose reachable node count equals the student's size,
  /// ascending for the sorted list.
  bool storageValid() {
    final seen = <int>{};
    if (size < 0) return false;
    var node = head;
    int? previous;
    while (node != null) {
      if (!seen.add(node.id) || seen.length > size) return false;
      if (sorted && previous != null && node.value < previous) return false;
      previous = node.value;
      node = node.next;
    }
    return seen.length == size && size == reference.length;
  }

  @override
  List<String> executionProblems() =>
      storageValid() ? const [] : const ['list storage, length or order'];

  @override
  void structuralChecks(Check check) {
    check('Logical size', reference.length, size);
    check('List storage and ordering', true, storageValid());
  }
}
