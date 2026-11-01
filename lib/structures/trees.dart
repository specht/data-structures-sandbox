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
  Set<String> get standardMethods => const {
    'insert', 'contains', 'remove',
    'inorder', 'preorder', 'postorder', 'breadthFirst', 'dfs', 'bfs',
  };

  static const traversals = {'inorder', 'preorder', 'postorder', 'breadthFirst'};

  @override
  bool get insertReturnsVoid => true;

  @override
  String requiredMethodSignature(String name) => traversals.contains(name)
      ? 'void $name(callback)' : super.requiredMethodSignature(name);

  // Independent reference traversal. In particular, this inspects the ACTUAL
  // BST/AVL shape; preorder and postorder cannot be inferred from its values.
  List<int> traversalOrder(String name) {
    final answer = <int>[];
    final seen = <int>{};
    if (name == 'breadthFirst') {
      final pending = <tree_api.TreeNode?>[root];
      for (var i = 0; i < pending.length; i++) {
        final node = pending[i];
        if (node == null) continue;
        if (!seen.add(node.id)) return [...answer, invalidMarker];
        answer.add(node.value);
        pending.add(node.left);
        pending.add(node.right);
      }
      return answer;
    }
    final pending = <({tree_api.TreeNode? node, bool emit})>[
      (node: root, emit: false),
    ];
    while (pending.isNotEmpty) {
      final item = pending.removeLast();
      final node = item.node;
      if (node == null) continue;
      if (item.emit) { answer.add(node.value); continue; }
      if (!seen.add(node.id)) return [...answer, invalidMarker];
      if (name == 'preorder') {
        pending.add((node: node.right, emit: false));
        pending.add((node: node.left, emit: false));
        pending.add((node: node, emit: true));
      } else if (name == 'postorder') {
        pending.add((node: node, emit: true));
        pending.add((node: node.right, emit: false));
        pending.add((node: node.left, emit: false));
      } else { // inorder
        pending.add((node: node.right, emit: false));
        pending.add((node: node, emit: true));
        pending.add((node: node.left, emit: false));
      }
    }
    return answer;
  }

  @override
  Object? expectedReturn(String name, List<Object?> args) {
    if (name == 'insert') return null;
    if (traversals.contains(name)) return traversalOrder(name);
    if (name == 'dfs' || name == 'bfs') return reference.contains(args.single);
    return super.expectedReturn(name, args);
  }

  @override
  bool returnMatches(String name, Object? expected, Object? returned) {
    if (traversals.contains(name)) {
      return expected is List<int> && returned is List<int> &&
          expected.length == returned.length &&
          expected.join(',') == returned.join(',');
    }
    return super.returnMatches(name, expected, returned);
  }

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
    if (traversals.contains(name)) {
      return returnMatches(name, traversalOrder(name), returned);
    }
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
      case 'dfs':
      case 'bfs':
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
