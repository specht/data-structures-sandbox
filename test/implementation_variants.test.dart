// Several implementations of one structure: dart test/implementation_variants.test.dart
import '../tool/registry.dart';

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

void main() {
  final bst = specFor('tree');
  check(implementationFile(bst, '') == 'my_bst.dart', 'base file');
  check(implementationFile(bst, 'recursive') == 'my_bst_recursive.dart', 'variant file');

  final base = implementationForFile('my_bst.dart');
  check(base?.kind == 'tree' && base?.variant == '', 'base detected');
  final recursive = implementationForFile('my_bst_recursive.dart');
  check(recursive?.kind == 'tree' && recursive?.variant == 'recursive', 'variant detected');
  final linked = implementationForFile('my_sorted_linked_list_v2.dart');
  check(linked?.kind == 'sorted_linked_list' && linked?.variant == 'v2', 'list variant');
  // The array stack's file name is not mistaken for a variant of anything else.
  check(implementationForFile('my_array_stack.dart')?.kind == 'stack', 'array stack');
  for (final ignored in ['notes.dart', 'my_bst_.dart', 'my_bst_Recursive.dart', 'my_bst.txt']) {
    check(implementationForFile(ignored) == null, 'ignored $ignored');
  }
  // No starter file name may be a variant of another one.
  for (final spec in structures) {
    final found = implementationForFile(spec.filename);
    check(found?.kind == spec.id && found?.variant == '', 'unique ${spec.filename}');
  }
  check(implementationLabel('tree', 'recursive') == 'Tree (binary search) · recursive', 'label');
  check(studentFolder.hasMatch('liu.kashiwabara') && !studentFolder.hasMatch('..') &&
      !studentFolder.hasMatch('.hidden'), 'student folders');
  var rejected = false;
  try {
    implementationFile(bst, '../x');
  } on FormatException {
    rejected = true;
  }
  check(rejected, 'unsafe variant rejected');
  print('PASS: implementation variants and student folder names.');
}
