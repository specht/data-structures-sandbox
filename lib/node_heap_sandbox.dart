import 'tree_sandbox.dart';

// Physical, reference-based min-heap adapter. Unlike the array heap, these
// positions are actual TreeNode objects connected by observable left/right
// references. Values may swap while node identities remain unchanged.
class NodeHeapRecorder extends TreeRecorder {
  NodeHeapRecorder(List<String> lines) : super(lines);

  int Function()? count;

  @override
  Map<String, Object?> snapshot() => {
    ...super.snapshot(),
    'nodeHeap': auditNodeHeap(root?.call(), count?.call() ?? 0),
  };
}

// Breadth-first auditing checks every reachable object, not just the root.
// Logical indices come from the *shape*, never from an array backing store.
// Indices must be 1..size in BFS order to form a complete binary tree.
Map<String, Object?> auditNodeHeap(TreeNode? root, int size) {
  // Auditing is observation, not a student method read. Avoid recording a
  // `visit` event for each node whenever a snapshot is taken.
  final active = TreeRecorder.active;
  TreeRecorder.active = null;
  try {
  return _auditNodeHeap(root, size);
  } finally {
    TreeRecorder.active = active;
  }
}

Map<String, Object?> _auditNodeHeap(TreeNode? root, int size) {
  final seen = <int>{};
  final values = <int>[];
  final details = <String, Map<String, Object?>>{};
  final pending = <({TreeNode node, int index})>[
    if (root != null) (node: root, index: 1),
  ];
  var acyclic = true, complete = true, ordered = true;
  var cursor = 0;
  while (cursor < pending.length) {
    final entry = pending[cursor++], node = entry.node;
    if (!seen.add(node.id)) {
      acyclic = false;
      continue;
    }
    if (entry.index != seen.length || entry.index > size) complete = false;
    final value = node.value;
    values.add(value);
    var ok = true;
    for (final child in [node.left, node.right]) {
      if (child == null) continue;
      if (value > child.value) {
        ordered = false;
        ok = false;
      }
    }
    details['${node.id}'] = {'index': entry.index, 'orderOk': ok};
    if (node.left != null) pending.add((node: node.left!, index: entry.index * 2));
    if (node.right != null) pending.add((node: node.right!, index: entry.index * 2 + 1));
    // A cyclic/shared child is visited only once, so traversal terminates.
  }
  if (size < 0 || seen.length != size || (root == null) != (size == 0)) {
    complete = false;
  }
  return {
    'acyclic': acyclic,
    'complete': complete,
    'ordered': ordered,
    'size': size,
    'reachable': seen.length,
    'values': values,
    'nodes': details,
  };
}
