// Binary search tree and AVL tree: `TreeNode? root`, duplicates ignored.
import '../tree_sandbox.dart' as tree_api;
import '../worker/adapter.dart';

class TreeAdapter extends StructureAdapter {
  TreeAdapter.bst({required super.create, required super.invoke, required super.methodsJson})
      : avl = false,
        super('tree');
  TreeAdapter.avl({required super.create, required super.invoke, required super.methodsJson})
      : avl = true,
        super('avl');

  final bool avl;

  tree_api.TreeNode? get root => s.root;

  @override
  void resetIds() => tree_api.TreeRecorder.resetIds();

  @override
  dynamic createRecorder(List<String> lines) => tree_api.TreeRecorder(lines)
    ..root = (() => s.root)
    ..avl = avl;

  @override
  void activate(dynamic recorder) =>
      tree_api.TreeRecorder.active = recorder as tree_api.TreeRecorder;

  @override
  Set<String> get standardMethods => const {'insert', 'contains', 'remove'};

  @override
  bool get insertReturnsVoid => true;

  @override
  Object? expectedReturn(String name, List<Object?> args) =>
      name == 'insert' ? null : super.expectedReturn(name, args);

  /// Iterative inorder traversal: a deliberately skewed student BST must not
  /// exhaust the worker's call stack. A cycle or shared child is an invalid
  /// tree, not a reason to hang.
  @override
  List<int> actualValues() {
    final values = <int>[];
    final seen = <int>{};
    final pending = <tree_api.TreeNode>[];
    var current = root;
    while (current != null || pending.isNotEmpty) {
      while (current != null) {
        if (!seen.add(current.id)) {
          values.add(invalidMarker);
          return values;
        }
        pending.add(current);
        current = current.left;
      }
      final node = pending.removeLast();
      values.add(node.value);
      current = node.right;
    }
    return values;
  }

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    if (value == null) {
      reference
        ..clear()
        ..addAll(actualValues());
      return true;
    }
    final present = reference.contains(value);
    switch (name) {
      case 'insert':
        if (!present) {
          reference
            ..add(value)
            ..sort();
        }
        return true;
      case 'contains':
        return returned == present;
      case 'remove':
        reference.remove(value);
        return returned == present;
      default:
        reference
          ..clear()
          ..addAll(actualValues());
        return true;
    }
  }

  /// AVL violations are reported independently of the abstract set values.
  /// Intermediate rotation snapshots may be unbalanced: only the state after
  /// the public method returns has to be valid.
  @override
  List<String> executionProblems() {
    if (!avl) return const [];
    final audit = tree_api.auditAvl(root);
    final faults = [
      if (audit['acyclic'] != true) 'cycle/shared child',
      if (audit['ordered'] != true) 'BST order',
      if (audit['heights'] != true) 'stored heights',
      if (audit['balanced'] != true) 'balance factor',
    ];
    return faults.isEmpty ? const [] : ['AVL: ${faults.join(', ')}'];
  }

  @override
  void structuralChecks(Check check) {
    final audit = tree_api.auditAvl(root);
    check('Acyclic tree', true, audit['acyclic']);
    check('BST ordering', true, audit['ordered']);
    if (avl) {
      check('Stored subtree heights', true, audit['heights']);
      check('AVL balance', true, audit['balanced']);
    }
  }
}
