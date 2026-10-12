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

  // Other languages keep their extension in the variant; Dart variants are unchanged.
  check(implementationFile(bst, '.py') == 'my_bst.py', 'Python base file');
  check(implementationFile(bst, 'recursive.java') == 'my_bst_recursive.java', 'Java variant file');
  check(implementationForFile('my_bst.js')?.variant == '.js', 'JavaScript base detected');
  final java = implementationForFile('my_sorted_linked_list_v2.java');
  check(java?.kind == 'sorted_linked_list' && java?.variant == 'v2.java', 'Java variant detected');
  check(implementationForFile('my_bst.json') == null && implementationForFile('my_bst_.py') == null,
      'other extensions ignored');
  check(implementationLabel('avl', '.py') == 'Tree (AVL) · Python', 'Python label');
  check(implementationLabel('avl', 'iterative.java') == 'Tree (AVL) · iterative · Java', 'Java label');
  check(languageNameOf('') == 'Dart' && languageNameOf('x.js') == 'JavaScript', 'language names');
  for (final unsafe in ['../x', 'x.py.py', '.dart', 'X.py', '.rb']) {
    var refused = false;
    try {
      implementationFile(bst, unsafe);
    } on FormatException {
      refused = true;
    }
    check(refused, 'unsafe variant $unsafe rejected');
  }
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
