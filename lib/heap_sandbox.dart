import 'trace_budget.dart';

/// Contiguous, indexed storage. The logical binary tree is a projection of
/// these very same cells: children of index i live at 2*i+1 and 2*i+2.
/// No node objects or object-pointer edges exist in an array heap.
class HeapMemory {
  final List<int> _cells = [];
  int get length => _cells.length;
  bool get isEmpty => _cells.isEmpty;
  int operator [](int index) {
    final value = _cells[index];
    HeapRecorder.active?.read(index, value);
    return value;
  }
  void operator []=(int index, int value) {
    final before = _cells[index];
    _cells[index] = value;
    HeapRecorder.active?.write(index, before, value);
  }
  void add(int value) {
    _cells.add(value);
    HeapRecorder.active?.append(_cells.length - 1, value);
  }
  int removeLast() {
    final index = _cells.length - 1;
    final value = _cells.removeLast();
    HeapRecorder.active?.remove(index, value);
    return value;
  }
  void swap(int a, int b) {
    if (a == b) return;
    final oldA = _cells[a], oldB = _cells[b];
    _cells[a] = oldB;
    _cells[b] = oldA;
    HeapRecorder.active?.swap(a, b, oldA, oldB);
  }
  List<int> copy() => List<int>.of(_cells);
}

bool heapOrderValid(List<int> values) {
  for (var i = 1; i < values.length; i++) {
    if (values[(i - 1) ~/ 2] > values[i]) return false;
  }
  return true;
}

class HeapRecorder {
  static HeapRecorder? active;
  final List<Map<String, Object?>> steps = EventLog();
  HeapMemory Function()? memory;
  int sourceLine = 0;
  HeapRecorder(List<String> lines);
  void atLine(int line) {
    sourceLine = line;
    steps.add({'kind':'line','line':line});
  }
  void begin(String name, List<Object?> args) {
    steps.add({'kind':'operationStart','operation':'$name(${args.join(', ')})','line':0});
  }
  void read(int index, int value) {
    steps.add({'kind':'heapRead','index':index,'value':value,'line':sourceLine});
  }
  void change(String kind, Map<String, Object?> fields) {
    steps.add({'kind':kind, ...fields, 'line':sourceLine});
    steps.add(snapshot());
  }
  void write(int index, int before, int value) => change('heapWrite',
    {'index':index,'oldValue':before,'value':value});
  void append(int index, int value) => change('heapAppend',{'index':index,'value':value});
  void remove(int index, int value) => change('heapRemove',{'index':index,'value':value});
  void swap(int a, int b, int oldA, int oldB) => change('heapSwap',
    {'a':a,'b':b,'oldA':oldA,'oldB':oldB});
  Map<String,Object?> snapshot() {
    final cells = memory?.call()?.copy() ?? <int>[];
    return {'kind':'snapshot','cells':cells,'size':cells.length,
      'heapOrder':heapOrderValid(cells)};
  }
  void end(Object? value, bool ok, {bool returnedVoid=false,String? message}) {
    steps.add({'kind':'operationEnd','value':value,'returnedVoid':returnedVoid,
      'ok':ok,'result':message ?? 'Result: $value','line':0});
  }
}
