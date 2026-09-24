import 'dart:collection';

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
    if(_events.length>=maxEvents) throw StateError('Trace limit reached ($maxEvents events).');
    _events.add(value);
  }
}
