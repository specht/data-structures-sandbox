// Run from the repository root: dart test/specialized_worker_test.dart
import 'dart:io';

import '../tool/registry.dart';
import '../tool/specialize_worker.dart';

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

void main() {
  final template = File('tool/worker_template.txt').readAsStringSync();
  for (final spec in structures) {
    final id = 'specialization_${spec.id}';
    const source = '/student/source.dart';
    final worker = specializeWorkerTemplate(
      template, selected: spec, id: id, sourcePath: source,
    );
    final generatedImports = RegExp(
      r"^import 'generated/[^']+' as selected_(?:student|methods);$",
      multiLine: true,
    ).allMatches(worker).length;
    check(generatedImports == 2,
      '${spec.id}: expected exactly one student and one method import');
    check(worker.contains("import 'generated/$id/${spec.filename}' as selected_student;"),
      '${spec.id}: selected student file is not imported');
    check(worker.contains("import 'generated/$id/${spec.id}_methods.dart' as selected_methods;"),
      '${spec.id}: selected dispatcher is not imported');
    check(worker.contains('instance=selected_student.${spec.className}()'),
      '${spec.id}: wrong class in worker constructor');
    check(worker.contains("'${spec.id}': '$source'"),
      '${spec.id}: worker does not use selected student source');
    check(!worker.contains('templates/example/'),
      '${spec.id}: worker still refers to unrelated examples');
    check(!worker.contains('@@'), '${spec.id}: unresolved template token');
    print('PASS: ${spec.id} — selected imports, constructor and source only');
  }
}
