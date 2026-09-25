import 'trace_budget.dart';

/// Observable fixed cells for the list exercises, not a list implementation.
/// Student code owns `int size` in the list class and shifts cells explicitly.
class ListMemory {
  final List<int?> _cells;

  ListMemory(int capacity) : _cells = List<int?>.filled(capacity, null) {
    if (capacity <= 0) throw ArgumentError.value(capacity, 'capacity');
  }

  int get length => _cells.length;

  int? operator [](int index) => _cells[index];
  void operator []=(int index, int? value) {
    final previous = _cells[index];
    _cells[index] = value;
    ListRecorder.active?.cellWrite(index, previous, value);
  }

  List<int?> copy() => List<int?>.of(_cells);
}

class ListRecorder {
  static ListRecorder? active;
  final List<Map<String, Object?>> steps = EventLog();
  ListMemory Function()? memory;
  int Function()? size;
  int sourceLine = 0;

  ListRecorder(List<String> lines);
  void atLine(int line) {
    sourceLine = line;
    steps.add({'kind': 'line', 'line': line});
  }
  void begin(String name, List<Object?> args) {
    steps.add({'kind': 'operationStart',
      'operation': '$name(${args.join(', ')})', 'line': 0});
  }
  void cellWrite(int index, int? before, int? after) {
    steps.add({'kind': 'cellWrite', 'index': index, 'oldValue': before,
      'value': after, 'line': sourceLine});
    steps.add(snapshot());
  }
  void indexWrite(String name, int before, int after) {
    steps.add({'kind': 'indexWrite', 'name': name, 'oldValue': before,
      'value': after, 'line': sourceLine});
    steps.add(snapshot());
  }
  Map<String, Object?> snapshot() {
    final m = memory?.call();
    return {'kind': 'snapshot', 'cells': m?.copy() ?? <int?>[],
      'size': size?.call() ?? 0};
  }
  void end(Object? value, bool ok,
      {bool returnedVoid = false, String? message}) {
    steps.add({'kind': 'operationEnd', 'value': value,
      'returnedVoid': returnedVoid, 'ok': ok,
      'result': message ?? 'Result: $value', 'line': 0});
  }
}
