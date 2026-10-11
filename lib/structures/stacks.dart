// Stack (fixed array) and stack (linked list).
import '../sandbox.dart' as list_api;
import '../stack_sandbox.dart' as stack_api;
import '../worker/adapter.dart';

/// `MyArrayStack`: FixedMemory memory, student-owned `int top`.
class ArrayStackAdapter extends StructureAdapter {
  ArrayStackAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('stack');

  stack_api.FixedMemory get memory => s.memory;
  int get top => s.top;

  @override
  dynamic createRecorder(List<String> lines) => stack_api.StackRecorder(lines)
    ..memory = (() => s.memory)
    ..top = (() => s.top);

  @override
  void activate(dynamic recorder) =>
      stack_api.StackRecorder.active = recorder as stack_api.StackRecorder;

  @override
  int? get capacity => memory.length;

  @override
  Set<String> get standardMethods => const {'push', 'pop', 'peek', 'isEmpty'};

  @override
  Object? expectedReturn(String name, List<Object?> args) => switch (name) {
        'push' || 'insert' => reference.length < 8,
        'peek' => reference.isEmpty ? null : reference.last,
        _ => super.expectedReturn(name, args),
      };

  @override
  List<int> actualValues() {
    final values = <int>[];
    for (var i = 0; i <= top && i < memory.length; i++) {
      final v = memory[i];
      if (v != null) values.add(v);
    }
    return values;
  }

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    final stack = reference;
    switch (name) {
      case 'push' when value != null:
        final expected = stack.length < 8;
        if (expected) stack.add(value);
        return returned == expected;
      case 'pop':
        final expected = stack.isEmpty ? null : stack.removeLast();
        return returned == expected;
      case 'peek':
        return returned == (stack.isEmpty ? null : stack.last);
      case 'isEmpty':
        return returned == stack.isEmpty;
      default:
        stack
          ..clear()
          ..addAll(actualValues());
        return true;
    }
  }

  /// Every physical cell outside the occupied range must be empty.
  bool storageValid() {
    if (top < -1 || top >= memory.length) return false;
    for (var i = 0; i < memory.length; i++) {
      if ((i <= top) != (memory[i] != null)) return false;
    }
    return true;
  }

  @override
  List<String> executionProblems() =>
      storageValid() ? const [] : const ['stack cells or top index'];

  @override
  void structuralChecks(Check check) {
    check('Fixed capacity', 8, memory.length);
    check('Top index', reference.length - 1, top);
    check('Stack storage', true, storageValid());
  }
}

/// `MyLinkedStack`: `ListNode? head` is the top.
class LinkedStackAdapter extends StructureAdapter {
  LinkedStackAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('linked_stack');

  list_api.ListNode? get head => s.head;

  @override
  void resetIds() => list_api.Recorder.resetIds();

  @override
  dynamic createRecorder(List<String> lines) =>
      list_api.Recorder(lines)..root = (() => s.head);

  @override
  void activate(dynamic recorder) =>
      list_api.Recorder.active = recorder as list_api.Recorder;

  @override
  Set<String> get standardMethods => const {'push', 'pop', 'peek', 'isEmpty'};

  @override
  Object? expectedReturn(String name, List<Object?> args) => switch (name) {
        'push' || 'insert' => true,
        'pop' => reference.isEmpty ? null : reference.first,
        _ => super.expectedReturn(name, args),
      };

  @override
  List<int> actualValues() => chainValues(head);

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    switch (name) {
      case 'push' when value != null:
        reference.insert(0, value);
        return returned == true;
      case 'pop':
        final expected = reference.isEmpty ? null : reference.removeAt(0);
        return returned == expected;
      case 'peek':
        return returned == (reference.isEmpty ? null : reference.first);
      case 'isEmpty':
        return returned == reference.isEmpty;
      default:
        reference
          ..clear()
          ..addAll(actualValues());
        return true;
    }
  }

  @override
  void structuralChecks(Check check) {
    final seen = <int>{};
    var node = head;
    while (node != null && seen.add(node.id)) {
      node = node.next;
    }
    check('Acyclic stack chain', true, node == null);
  }
}
