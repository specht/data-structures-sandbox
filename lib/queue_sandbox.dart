import 'trace_budget.dart';

// A fixed physical array with independently observable circular-queue markers.
// 'rear' names the NEXT free slot, not the last occupied slot. When the queue
// is full front == rear; size distinguishes full from empty.
class QueueMemory {
  final List<int?> _slots;
  int _front = 0, _rear = 0, _size = 0;

  QueueMemory(int capacity)
      : assert(capacity > 0),
        _slots = List<int?>.filled(capacity, null) {
    if (capacity <= 0) throw ArgumentError.value(capacity, 'capacity');
  }

  int get length => _slots.length;
  int? operator [](int index) => _slots[index];
  void operator []=(int index, int? value) {
    final before = _slots[index];
    _slots[index] = value;
    QueueRecorder.active?.cellWrite(index, before, value);
  }
  List<int?> copy() => List<int?>.of(_slots);

  int get front => _front;
  set front(int value) {
    final before = _front;
    _front = value;
    QueueRecorder.active?.indexWrite('front', before, value);
  }
  int get rear => _rear;
  set rear(int value) {
    final before = _rear;
    _rear = value;
    QueueRecorder.active?.indexWrite('rear', before, value);
  }
  int get size => _size;
  set size(int value) {
    final before = _size;
    _size = value;
    QueueRecorder.active?.indexWrite('size', before, value);
  }
}

class QueueRecorder {
  static QueueRecorder? active;
  final List<Map<String, Object?>> steps = EventLog();
  QueueMemory Function()? memory;
  int sourceLine = 0;

  QueueRecorder(List<String> lines);
  void atLine(int line) {
    sourceLine = line;
    steps.add({'kind': 'line', 'line': line});
  }
  void begin(String name, List<Object?> args) {
    steps.add({'kind': 'operationStart', 'operation': '$name(${args.join(', ')})', 'line': 0});
  }
  void cellWrite(int index, int? oldValue, int? value) {
    steps.add({'kind': 'cellWrite', 'index': index, 'oldValue': oldValue,
      'value': value, 'line': sourceLine});
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
      'front': m?.front ?? 0, 'rear': m?.rear ?? 0, 'size': m?.size ?? 0};
  }
  void end(Object? value, bool ok, {bool returnedVoid = false, String? message}) {
    steps.add({'kind': 'operationEnd', 'value': value,
      'returnedVoid': returnedVoid, 'ok': ok,
      'result': message ?? 'Result: $value', 'line': 0});
  }
}
