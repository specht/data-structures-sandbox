import '../tool/student_validation.dart';

void main() {
  const kinds = ['stack','linked_stack','array_queue','linked_queue','unsorted_array_list','unsorted_linked_list','sorted_array_list','sorted_linked_list',
    'tree','avl','array_heap','node_heap','hash'];
  for (final kind in kinds) {
    final scenarios = validationCases(kind);
    if (scenarios.length < 4) throw StateError('$kind: insufficient scenarios');
    for (final scenario in scenarios) {
      if (scenario.calls.isEmpty) throw StateError('$kind: empty scenario');
      for (final call in scenario.calls) {
        if (call.toRequest()['method'] != call.method) throw StateError('Bad request');
      }
    }
  }
  final full = validationCases('stack').firstWhere((s) => s.name.contains('capacity'));
  if (full.calls.where((c) => c.method == 'push').length < 9) throw StateError('Missing overflow check');
  final wrap = validationCases('array_queue').firstWhere((s) => s.name.contains('wraparound'));
  if (wrap.calls.where((c) => c.method == 'enqueue').length < 11) throw StateError('Missing wraparound check');
  print('PASS: deterministic test suites cover all 13 structures.');
}
