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
  // Traversals are tested for Dart files only until the other workers support them.
  bool traverses(List<ValidationCase> cases) =>
      cases.any((s) => s.calls.any((c) => treeTraversals.contains(c.method)));
  for (final kind in ['tree', 'avl']) {
    for (final variant in ['', 'recursive']) {
      if (!traverses(validationCasesFor(kind, variant))) throw StateError('$kind: Dart lacks traversals');
    }
    for (final variant in ['.py', '.js', '.java', 'recursive.py']) {
      final cases = validationCasesFor(kind, variant);
      if (traverses(cases)) throw StateError('$kind$variant: traversals before the worker supports them');
      if (cases.length != validationCases(kind).length - traversalCases().length) {
        throw StateError('$kind$variant: lost a non-traversal scenario');
      }
    }
  }
  // One group per traversal: a finished method passes while another is a stub.
  for (final name in treeTraversals) {
    final groups = traversalCases()
        .where((s) => s.calls.any((c) => c.method == name)).toList();
    if (groups.length != 1) throw StateError('$name must have exactly one group');
    if (groups.single.calls.any((c) => treeTraversals.contains(c.method) && c.method != name)) {
      throw StateError('The $name group calls another traversal');
    }
    if (groups.single.calls.where((c) => c.method == name).length < 3) {
      throw StateError('$name: empty, complete and uneven tree');
    }
  }
  print('PASS: deterministic test suites cover all 13 structures.');
}
