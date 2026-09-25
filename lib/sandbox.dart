import 'trace_budget.dart';
// Tiny observable nodes and trace collector for the browser prototype.
// Only Dart core libraries; the visualizer does not change student node IDs.
class ListNode {
  final int id;
  int _value;
  ListNode? _next;

  int get value {
    // Reads performed by student code are meaningful traversal events.
    Recorder.active?.visit(this);
    return _value;
  }
  set value(int newValue) { _value = newValue; }


  ListNode(int value) : _value = value, id = Recorder.allocateId() {
    Recorder.active?.createNode(this);
  }

  ListNode? get next => _next;
  set next(ListNode? target) {
    final before = _next;
    _next = target;
    Recorder.active?.pointerWrite('node:$id.next', before, target);
  }
}

class Recorder {
  static Recorder? active;
  static int _nextId = 0;
  static final Map<int, ListNode> registry = {};

  static int allocateId() => ++_nextId;
  static void resetIds() {
    _nextId = 0;
    registry.clear();
  }

  final List<String> lines;
  final List<Map<String, Object?>> steps = EventLog();
  ListNode? Function()? root;
  // A linked queue has a second owning reference. The ordinary list and linked
  // stack leave this null, so their trace format does not change.
  ListNode? Function()? tail;
  // Only list variants provide this; other linked structures retain their trace shape.
  int Function()? size;
  String method = '';
  int sourceLine = 0;

  Recorder(this.lines);

  int locate(String fragment) {
    final methodStart = lines.indexWhere((line) =>
        line.contains(' $method(') && line.contains('{'));
    final start = methodStart < 0 ? 0 : methodStart;
    for (var i = start; i < lines.length; i++) {
      // Highlight the student's executable statement, not the preceding
      // trace.at('...') hook that happens to contain the same source text.
      final candidate = lines[i].trimLeft();
      if (!candidate.startsWith('trace.at(') &&
          !candidate.startsWith('//') && lines[i].contains(fragment)) {
        return i + 1;
      }
    }
    throw StateError('Source line not found in $method: $fragment');
  }

  void atLine(int line) {
    sourceLine = line;
    steps.add({'kind': 'line', 'line': line});
  }

  void at(String fragment) {
    sourceLine = locate(fragment);
    steps.add({'kind': 'line', 'line': sourceLine});
  }

  void begin(String name, List<Object?> args) {
    method = name;
    sourceLine = locate(' $method(');
    steps.add({
      'kind': 'operationStart', 'operation': '$name(${args.join(', ')})',
      'description': 'Executing the student Dart method.',
      'line': sourceLine,
    });
  }

  void reference(String name, ListNode? node) {
    steps.add({
      'kind': 'variableWrite', 'name': name, 'to': node?.id,
      'line': sourceLine,
    });
  }

  // Student-owned list size updates are instrumented on the copied source.
  void indexWrite(String name, int before, int after) {
    steps.add({'kind': 'indexWrite', 'name': name,
      'oldValue': before, 'value': after, 'line': sourceLine});
    steps.add(snapshot());
  }

  void visit(ListNode node) {
    steps.add({'kind': 'visit', 'id': node.id, 'line': sourceLine});
  }

  void compare(ListNode node, int target) {
    steps.add({'kind': 'compare', 'id': node.id,
      'target': target, 'equal': node.value == target,
      'line': sourceLine});
  }

  void createNode(ListNode node) {
    registry[node.id] = node;
    steps.add({
      'kind': 'createNode',
      'node': {'id': node.id, 'value': node._value, 'next': null},
      'line': sourceLine,
    });
  }

  void pointerWrite(String from, ListNode? before, ListNode? after) {
    steps.add({
      'kind': 'pointerWrite', 'from': from,
      'oldTo': before?.id, 'to': after?.id,
      'line': sourceLine,
    });
    // The pointer event is always followed by the resulting reference graph.
    steps.add(snapshot());
  }

  Map<String, Object?> snapshot() => {
    'kind': 'snapshot', 'head': root?.call()?.id,
    if (tail != null) 'tail': tail!.call()?.id,
    if (size != null) 'size': size!.call(),
    'nodes': [for (final node in registry.values)
      {'id': node.id, 'value': node._value, 'next': node.next?.id}],
  };

  void end(Object? result, bool ok, {bool returnedVoid=false, String? message}) {
    steps.add({
      'kind': 'localsClear', 'line': sourceLine,
    });
    // The trace registry is an observer, not an owner of the student's nodes.
    // At method exit, local references have gone out of scope. Retire objects
    // no longer reachable from head, retaining their IDs in earlier frames.
    final reachable = <int>{};
    var cursor = root?.call();
    while (cursor != null && reachable.add(cursor.id)) { cursor = cursor._next; }
    final retired = registry.keys.where((id) => !reachable.contains(id)).toList();
    if (retired.isNotEmpty) {
      steps.add({'kind':'retire', 'ids':retired, 'line':0});
      for (final id in retired) { registry.remove(id); }
      steps.add(snapshot());
    }
    steps.add({
      'kind': 'operationEnd', 'ok': ok, 'value':result, 'returnedVoid':returnedVoid,
      'result': message ?? '${ok ? '✓' : '✗'} Result: $result',
      'line': sourceLine,
    });
  }
}
