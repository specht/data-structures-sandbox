// Queue (circular array) and queue (linked list).
import '../queue_sandbox.dart' as queue_api;
import '../sandbox.dart' as list_api;
import '../worker/adapter.dart';

/// `MyArrayQueue`: QueueMemory memory with front, rear and size.
class ArrayQueueAdapter extends StructureAdapter {
  ArrayQueueAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('array_queue');

  queue_api.QueueMemory get memory => s.memory;
  int get front => s.front;
  int get rear => s.rear;
  int get size => s.size;

  @override
  dynamic createRecorder(List<String> lines) =>
      queue_api.QueueRecorder(lines)..memory = (() => s.memory);

  @override
  void activate(dynamic recorder) =>
      queue_api.QueueRecorder.active = recorder as queue_api.QueueRecorder;

  @override
  int? get capacity => memory.length;

  @override
  Set<String> get standardMethods =>
      const {'enqueue', 'dequeue', 'peek', 'isEmpty', 'isFull'};

  @override
  Object? expectedReturn(String name, List<Object?> args) => switch (name) {
        'enqueue' || 'insert' => reference.length < 8,
        _ => super.expectedReturn(name, args),
      };

  @override
  List<int> actualValues() {
    final values = <int>[];
    final n = memory.length;
    // An invalid index or size is reported by storageValid(); never crash
    // the worker while trying to display the logical values.
    if (n <= 0 || front < 0 || front >= n || size < 0 || size > n) {
      return [invalidMarker];
    }
    for (var i = 0; i < size; i++) {
      final v = memory[(front + i) % n];
      if (v == null) return [invalidMarker];
      values.add(v);
    }
    return values;
  }

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    final values = reference;
    switch (name) {
      case 'enqueue' when value != null:
        final expected = values.length < memory.length;
        if (expected) values.add(value);
        return returned == expected;
      case 'dequeue':
        final expected = values.isEmpty ? null : values.removeAt(0);
        return returned == expected;
      case 'peek':
        return returned == (values.isEmpty ? null : values.first);
      case 'isEmpty':
        return returned == values.isEmpty;
      case 'isFull':
        return returned == (values.length == memory.length);
      default:
        values
          ..clear()
          ..addAll(actualValues());
        return true;
    }
  }

  /// Indices are in range; size identifies exactly the occupied circular
  /// slots; rear is the next free slot. Full and empty both have
  /// front == rear, but a different size.
  bool storageValid() {
    final m = memory, n = m.length;
    if (n <= 0 || front < 0 || front >= n || rear < 0 || rear >= n ||
        size < 0 || size > n || rear != (front + size) % n) {
      return false;
    }
    for (var i = 0; i < n; i++) {
      final occupied = ((i - front + n) % n) < size;
      if (occupied != (m[i] != null)) return false;
    }
    return true;
  }

  @override
  List<String> executionProblems() =>
      storageValid() ? const [] : const ['circular queue storage'];

  @override
  void structuralChecks(Check check) {
    check('Fixed capacity', 8, memory.length);
    check('Logical size', reference.length, size);
    check('Circular queue storage', true, storageValid());
  }
}

/// `MyLinkedQueue`: `head` is the front, `tail` the rear.
class LinkedQueueAdapter extends StructureAdapter {
  LinkedQueueAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('linked_queue');

  list_api.ListNode? get head => s.head;
  list_api.ListNode? get tail => s.tail;

  @override
  void resetIds() => list_api.Recorder.resetIds();

  @override
  dynamic createRecorder(List<String> lines) => list_api.Recorder(lines)
    ..root = (() => s.head)
    ..tail = (() => s.tail);

  @override
  void activate(dynamic recorder) =>
      list_api.Recorder.active = recorder as list_api.Recorder;

  @override
  Set<String> get standardMethods => const {'enqueue', 'dequeue', 'peek', 'isEmpty'};

  @override
  Object? expectedReturn(String name, List<Object?> args) => switch (name) {
        'enqueue' || 'insert' => true,
        _ => super.expectedReturn(name, args),
      };

  @override
  List<int> actualValues() => chainValues(head);

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    switch (name) {
      case 'enqueue' when value != null:
        reference.add(value);
        return returned == true;
      case 'dequeue':
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

  /// A cycle, a dangling tail or tail.next != null is a physical queue error
  /// even when the displayed values happen to match.
  bool pointersValid() {
    final h = head, t = tail;
    if (h == null) return t == null;
    if (t == null) return false;
    final visited = <int>{};
    list_api.ListNode? last, cursor = h;
    while (cursor != null && visited.add(cursor.id)) {
      last = cursor;
      cursor = cursor.next;
    }
    return cursor == null && identical(last, t) && t.next == null;
  }

  @override
  List<String> executionProblems() =>
      pointersValid() ? const [] : const ['head/tail pointers'];

  @override
  void structuralChecks(Check check) =>
      check('Head/tail and acyclic chain', true, pointersValid());
}
