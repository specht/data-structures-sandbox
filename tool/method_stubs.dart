// Stubs for methods added to an exercise after students began it. Inserted
// into the editor DRAFT on request; the student reviews and saves it. The
// starter templates contain the same stubs (test/method_stubs_test.dart).
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';

import 'registry.dart';

const _traversalComment = '''
  // Traversals: the Sandbox supplies visit and checks the order of your
  // visit(value) calls. Private recursive helper methods are welcome.
''';

const _treeStubs = <String, String>{
  'preorder': '''
  void preorder(void Function(int value) visit) {
    // TODO: Node, left subtree, right subtree.
  }
''',
  'inorder': '''
  void inorder(void Function(int value) visit) {
    // TODO: Left subtree, node, right subtree.
  }
''',
  'postorder': '''
  void postorder(void Function(int value) visit) {
    // TODO: Left subtree, right subtree, node.
  }
''',
  'breadthFirst': '''
  void breadthFirst(void Function(int value) visit) {
    // TODO: Visit level by level, left to right, with one of your own queues:
    // import 'my_linked_queue.dart'; (or 'my_array_queue.dart') at the top,
    // then use TreeNodeQueue(MyLinkedQueue()) (or MyArrayQueue()).
  }
''',
};

/// Per structure: the stub of every extension method, in insertion order.
const methodStubs = <String, Map<String, String>>{'tree': _treeStubs, 'avl': _treeStubs};

/// Required signatures shown when a method exists with another signature.
const stubSignatures = <String, String>{
  'preorder': 'void preorder(void Function(int value) visit)',
  'inorder': 'void inorder(void Function(int value) visit)',
  'postorder': 'void postorder(void Function(int value) visit)',
  'breadthFirst': 'void breadthFirst(void Function(int value) visit)',
};

/// [content] with the stubs of [kind] that its class does not declare yet,
/// inserted before the class's closing brace. Names that the class already
/// declares (with any signature) are never duplicated; they are returned in
/// `existing` so the student can compare their signature.
({String content, List<String> inserted, List<String> existing}) insertMethodStubs(
    String kind, String content) {
  final stubs = methodStubs[kind] ??
      (throw FormatException('${specFor(kind).label} has no new methods to insert.'));
  final parsed = parseString(content: content, throwIfDiagnostics: false);
  if (parsed.errors.isNotEmpty) {
    throw const FormatException(
        'Fix the compilation errors in the draft first, then insert the method stubs.');
  }
  final className = specFor(kind).className;
  final classes = parsed.unit.declarations
      .whereType<ClassDeclaration>()
      .where((declaration) => declaration.name.lexeme == className)
      .toList();
  if (classes.length != 1) throw FormatException('Expected one class named $className.');
  final declaration = classes.single;
  final declared = <String>{
    for (final member in declaration.members)
      if (member is MethodDeclaration)
        member.name.lexeme
      else if (member is FieldDeclaration)
        for (final variable in member.fields.variables) variable.name.lexeme,
  };
  final inserted = [for (final name in stubs.keys) if (!declared.contains(name)) name];
  final existing = [for (final name in stubs.keys) if (declared.contains(name)) name];
  if (inserted.isEmpty) return (content: content, inserted: inserted, existing: existing);

  // Indent like the class's own members (two spaces in every template).
  final firstMember = declaration.members.firstOrNull;
  var indent = '  ';
  if (firstMember != null) {
    final lineStart = content.lastIndexOf('\n', firstMember.offset - 1) + 1;
    final prefix = content.substring(lineStart, firstMember.offset);
    if (prefix.trim().isEmpty && prefix.isNotEmpty) indent = prefix;
  }
  String reindent(String text) => text.replaceAllMapped(RegExp(r'^((?:  )+)', multiLine: true),
      (match) => indent * (match.group(1)!.length ~/ 2));
  final block = StringBuffer(reindent(_traversalComment));
  for (final name in inserted) {
    if (name != inserted.first) block.writeln();
    block.write(reindent(stubs[name]!));
  }

  final brace = declaration.rightBracket.offset;
  final lineStart = content.lastIndexOf('\n', brace - 1) + 1;
  final braceOnOwnLine = content.substring(lineStart, brace).trim().isEmpty;
  final at = braceOnOwnLine ? lineStart : brace;
  final before = content.substring(0, at);
  // One blank line after the previous member; none after an empty class body.
  final opening = before.trimRight().endsWith('{') ||
          RegExp(r'\n[ \t]*\n$').hasMatch(before)
      ? ''
      : '\n';
  final text = '${braceOnOwnLine ? '' : '\n'}$opening$block';
  return (
    content: before + text + content.substring(at),
    inserted: inserted,
    existing: existing,
  );
}
