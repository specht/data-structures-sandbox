import 'dart:collection';

/// Lightweight diagnostics shared by every recorder in an isolated student
/// worker. The worker installs listeners; the data-structure libraries merely
/// report the source line and trace position they are already recording.
class ExecutionDiagnostics {
  static int? currentLine;
  static int? currentTraceIndex;
  static void Function(int line, int traceIndex)? onLine;

  static void reset() {
    currentLine = null;
    currentTraceIndex = null;
  }

  static void atLine(int line, int traceIndex) {
    currentLine = line;
    currentTraceIndex = traceIndex;
    onLine?.call(line, traceIndex);
  }
}

/// A predictable upper bound for traces produced by student code. A
/// nonterminating loop that keeps emitting visits cannot exhaust the browser.
class EventLog extends ListBase<Map<String,Object?>> {
  static const maxEvents = 4000;
  final List<Map<String,Object?>> _events = [];
  @override int get length => _events.length;
  @override set length(int value) {
    if(value > maxEvents) throw StateError('Trace limit reached ($maxEvents events).');
    _events.length = value;
  }
  @override Map<String,Object?> operator [](int index) => _events[index];
  @override void operator []=(int index,Map<String,Object?> value) => _events[index]=value;
  @override void add(Map<String,Object?> value) {
    final line=value['kind']=='line'?value['line']:null;
    if(line is int)ExecutionDiagnostics.atLine(line,_events.length);
    if(_events.length>=maxEvents) throw StateError('Trace limit reached ($maxEvents events).');
    _events.add(value);
  }
}
