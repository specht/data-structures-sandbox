// Run from repo root: dart test/method_stubs_test.dart
import 'dart:io';

import '../tool/method_stubs.dart';

void check(bool value, String label) {
  if (!value) throw StateError(label);
}

void main() {
  // An existing student file from before the traversal extension.
  const old = '''
import '../../lib/tree_sandbox.dart';

class MyBST {
  TreeNode? root;

  void insert(int value) {
    root ??= TreeNode(value);
  }
}

// Trailing comment stays where it is.
''';
  final first = insertMethodStubs('tree', old);
  check(first.inserted.join(',') == 'preorder,inorder,postorder,breadthFirst',
      'All four traversals are inserted in teaching order: ${first.inserted}');
  check(first.existing.isEmpty, 'Nothing existed before');
  check(first.content.startsWith(old.substring(0, old.indexOf('\n}\n'))),
      'The student code before the stubs is unchanged');
  check(first.content.endsWith('  }\n}\n\n// Trailing comment stays where it is.\n'),
      'Stubs go inside the class, before its closing brace');
  check(first.content.contains('    root ??= TreeNode(value);\n  }\n\n  // Traversals:'),
      'One blank line separates the stubs from the previous member');
  check(!first.content.contains('\n\n\n'), 'No double blank lines');

  // Inserting again changes nothing: the names are declared now.
  final again = insertMethodStubs('tree', first.content);
  check(again.inserted.isEmpty && again.content == first.content, 'Insertion is idempotent');
  check(again.existing.length == 4, 'Every stub is reported as existing');

  // A method under the right name but another signature is never duplicated.
  final different = insertMethodStubs('avl', '''
class MyAVL {
    void inorder() {}
}
''');
  check(different.existing.join(',') == 'inorder', 'inorder exists: ${different.existing}');
  check(!different.inserted.contains('inorder'), 'inorder is not inserted twice');
  check(different.content.contains('\n    void preorder(void Function(int value) visit) {\n'
      '        // TODO: Node, left subtree, right subtree.\n    }\n'),
      'Stubs follow the class indentation (four spaces here)');
  check(stubSignatures['inorder'] == 'void inorder(void Function(int value) visit)',
      'The required signature is available for the hint');

  // An empty class body and a closing brace on a member's line.
  final empty = insertMethodStubs('tree', 'class MyBST {}\n');
  check(empty.content.startsWith('class MyBST {\n  // Traversals:'), 'Empty body: ${empty.content}');
  check(empty.content.endsWith('  }\n}\n'), 'Empty body keeps its brace last');

  for (final (label, source) in [
    ('syntax error', 'class MyBST {\n  void insert(int value) {\n}\n'),
    ('wrong class', 'class Tree {}\n'),
  ]) {
    var rejected = false;
    try {
      insertMethodStubs('tree', source);
    } on FormatException {
      rejected = true;
    }
    check(rejected, 'A draft with a $label is rejected, not changed');
  }
  var unsupported = false;
  try {
    insertMethodStubs('stack', 'class MyArrayStack {}');
  } on FormatException {
    unsupported = true;
  }
  check(unsupported, 'Structures without extension methods have no stubs');

  // New starters contain exactly the stubs that older files get inserted.
  for (final (kind, file) in [('tree', 'my_bst'), ('avl', 'my_avl')]) {
    final starter = File('templates/starter/$file.dart').readAsStringSync();
    for (final stub in methodStubs[kind]!.values) {
      check(starter.contains(stub), '$file starter lacks the stub:\n$stub');
    }
    check(insertMethodStubs(kind, starter).inserted.isEmpty, '$file starter is complete');
  }
  print('PASS: method stubs are inserted once, inside the class, matching the starters');
}
