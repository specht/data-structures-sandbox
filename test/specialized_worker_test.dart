// Run from the repository root: dart test/specialized_worker_test.dart
import 'dart:io';

import '../tool/registry.dart';
import '../tool/specialize_worker.dart';

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

void main() {
  for (final spec in structures) {
    final id = 'specialization_${spec.id}';
    const source = '/student/source.dart';
    final worker = generateWorker(selected: spec, id: id, sourcePath: source);
    final adapter = workerAdapters[spec.id]!;
    final generatedImports =
        RegExp(r"^import 'generated/", multiLine: true).allMatches(worker).length;
    check(generatedImports == 2,
        '${spec.id}: expected exactly one student and one method import');
    check(worker.contains("import 'generated/$id/${spec.filename}' as student;"),
        '${spec.id}: selected student file is not imported');
    check(worker.contains("import 'generated/$id/${spec.id}_methods.dart' as methods;"),
        '${spec.id}: selected dispatcher is not imported');
    check(worker.contains('create: () => student.${spec.className}()'),
        '${spec.id}: wrong class in worker constructor');
    check(worker.contains("sourcePath: r'$source'"),
        '${spec.id}: worker does not use selected student source');
    check(worker.contains("generatedFile: r'${spec.filename}'"),
        '${spec.id}: stack frames would not be matched');
    final library = File('lib/structures/${adapter.library}.dart');
    check(library.existsSync(), '${spec.id}: missing ${library.path}');
    final className = adapter.constructor.split('.').first;
    check(library.readAsStringSync().contains('class $className '),
        '${spec.id}: $className is not defined in ${library.path}');
    check(library.readAsStringSync().contains("'${spec.id}'"),
        '${spec.id}: adapter does not report its registry id');
    print('PASS: ${spec.id} — ${adapter.constructor} with the selected file only');
  }
  check(workerAdapters.length == structures.length, 'unregistered adapter entries');
}
