// One adapter per data structure: everything the shared worker session needs
// to know about a structure's storage, recorder and reference model.
//
// The generated worker for a student's file passes in a constructor for the
// student's class and a dispatcher for its discovered methods. Adapters read
// the observable fields (memory, top, head, root, size, buckets, …) through
// `s`, so they do not depend on the generated student type.
import '../heap_sandbox.dart' as heap_api;
import '../list_sandbox.dart' as list_memory_api;
import '../queue_sandbox.dart' as queue_api;
import '../sandbox.dart' as list_api;
import '../stack_sandbox.dart' as stack_api;
import '../tree_sandbox.dart' as tree_api;

typedef StudentFactory = Object Function();
typedef StudentInvoker = Object? Function(
    Object instance, String name, List<Object?> args);

/// Records one detailed test aspect; `passed` overrides `expected == actual`.
typedef Check = void Function(String aspect, Object? expected, Object? actual,
    [bool? passed]);

/// A value that never occurs in student data and marks broken storage.
const invalidMarker = 10000000;

abstract class StructureAdapter {
  StructureAdapter(
    this.kind, {
    required StudentFactory create,
    required StudentInvoker invoke,
    required this.methodsJson,
  })  : _create = create,
        _invoke = invoke;

  /// The registry id, e.g. 'stack' or 'avl'.
  final String kind;
  final StudentFactory _create;
  final StudentInvoker _invoke;

  /// JSON produced by tool/instrument.dart: the student's public methods.
  final String methodsJson;

  late Object instance;

  /// The student's object; observable fields are read dynamically.
  dynamic get s => instance;

  /// The independent reference model: the values the structure should hold.
  final List<int> reference = [];

  /// Clears node id registries before a fresh instance is created.
  void resetIds() {}

  void reset() {
    reference.clear();
    resetIds();
    instance = _create();
  }

  /// A recorder bound to [instance] for one batch of calls.
  dynamic createRecorder(List<String> lines);

  /// Makes [recorder] the target of the instrumented student code.
  void activate(dynamic recorder);

  Object? invoke(String name, List<Object?> args) => _invoke(instance, name, args);

  /// Fixed capacity shown by the browser, or null for growing structures.
  int? get capacity => null;

  /// Compare contents as multisets (heaps, hash tables).
  bool get unorderedContents => false;

  /// Methods of the classroom contract that the sandbox can verify.
  Set<String> get standardMethods;

  /// The logical contents read from the student's storage.
  List<int> actualValues();

  /// Advances [reference] for one call; false if [returned] is wrong.
  bool updateReference(String name, List<Object?> args, Object? returned);

  /// Structural problems after a call (empty when the storage is valid), for
  /// example 'AVL: balance factor'. Any problem fails the call.
  List<String> executionProblems() => const [];

  /// Detailed structural checks for the separate test runner.
  void structuralChecks(Check check) {}

  bool returnMatches(String name, Object? expected, Object? returned) =>
      expected == returned;

  /// `insert` returns nothing for trees and heaps (duplicates are ignored).
  bool get insertReturnsVoid => false;

  /// `insert(int index, int value)` for the positional (unsorted) lists.
  bool get insertTakesIndex => false;

  /// The classroom contract fixes parameter types, arity and return type of
  /// each required method, not only its name.
  String requiredMethodSignature(String name) {
    final returns = switch (name) {
      'insert' when insertReturnsVoid => 'void',
      'insert' || 'push' || 'enqueue' || 'contains' || 'remove' || 'isEmpty' ||
      'isFull' =>
        'bool',
      'get' || 'removeAt' || 'pop' || 'peek' || 'dequeue' || 'removeMin' => 'int?',
      'length' => 'int',
      'loadFactor' => 'double',
      _ => throw StateError('No required signature for $kind.$name'),
    };
    final arguments = (name == 'insert' && insertTakesIndex)
        ? 'int, int'
        : const {'pop', 'peek', 'dequeue', 'removeMin', 'isEmpty', 'isFull',
                'length', 'loadFactor'}
                .contains(name)
            ? ''
            : 'int';
    return '$returns $name($arguments)';
  }

  /// The expected return, computed from [reference] BEFORE the student's
  /// method runs. In particular, an insert which changes storage but returns
  /// false is wrong. Adapters override the structure-specific cases
  /// (insert, push, enqueue, pop, peek, loadFactor) and defer to this.
  Object? expectedReturn(String name, List<Object?> args) {
    final value = args.isNotEmpty && args.last is int ? args.last as int : null;
    final index = insertTakesIndex && args.isNotEmpty ? args.first as int : null;
    switch (name) {
      case 'get':
      case 'removeAt':
        return index != null && index >= 0 && index < reference.length
            ? reference[index]
            : null;
      case 'pop':
        return reference.isEmpty ? null : reference.last;
      case 'peek':
      case 'dequeue':
        return reference.isEmpty ? null : reference.first;
      case 'removeMin':
        return reference.isEmpty ? null : (List<int>.of(reference)..sort()).first;
      case 'remove':
      case 'contains':
        return reference.contains(value);
      case 'length':
        return reference.length;
      case 'isEmpty':
        return reference.isEmpty;
      case 'isFull':
        return reference.length == 8;
    }
    throw StateError('No reference contract for $kind.$name');
  }

  /// Values of a singly linked chain, with [invalidMarker] for a cycle.
  List<int> chainValues(list_api.ListNode? head) {
    final values = <int>[];
    final seen = <int>{};
    var node = head;
    while (node != null && seen.add(node.id)) {
      values.add(node.value);
      node = node.next;
    }
    if (node != null) values.add(invalidMarker);
    return values;
  }
}

/// Instrumented student code reports to whichever recorder is active.
void deactivateRecorders() {
  list_api.Recorder.active = null;
  tree_api.TreeRecorder.active = null;
  stack_api.StackRecorder.active = null;
  queue_api.QueueRecorder.active = null;
  heap_api.HeapRecorder.active = null;
  list_memory_api.ListRecorder.active = null;
}
