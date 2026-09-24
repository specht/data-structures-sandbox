// Run with: dart test/avl_model.dart
// This model/recorder test does not modify structures/ or the student's files.
import '../lib/tree_sandbox.dart';
import '../templates/example/my_avl.dart';

void check(MyAVL tree, List<int> expected) {
  final audit = auditAvl(tree.root);
  for (final name in ['acyclic','ordered','heights','balanced']) {
    if (audit[name] != true) throw StateError('AVL $name violated: $audit');
  }
  final ordered = <int>[];
  final pending = <TreeNode>[];
  TreeNode? node = tree.root;
  while (node != null || pending.isNotEmpty) {
    while (node != null) { pending.add(node); node = node.left; }
    node = pending.removeLast();
    ordered.add(node.value);
    node = node.right;
  }
  final wanted = [...expected]..sort();
  if (ordered.join(',') != wanted.join(',')) {
    throw StateError('Expected $wanted but found $ordered');
  }
  for (final value in wanted) {
    if (!tree.contains(value)) throw StateError('contains($value) is false');
  }
}

void rotation(List<int> values, String scenario) {
  TreeRecorder.resetIds();
  final tree = MyAVL();
  final recorder = TreeRecorder(const [])..root = (() => tree.root)..avl = true;
  TreeRecorder.active = recorder;
  for (final value in values) tree.insert(value);
  TreeRecorder.active = null;
  check(tree, values);
  if (tree.root?.value != 20) throw StateError('$scenario: wrong root');
  // Rotations must RELINK the original nodes, not allocate replacements.
  final ids = recorder.steps.where((s)=>s['kind']=='createNode')
      .map((s)=>(s['node'] as Map)['id']).toSet();
  if (ids.length != 3) throw StateError('$scenario: node identities changed');
  if (!recorder.steps.any((s)=>s['kind']=='pointerWrite')) {
    throw StateError('$scenario: missing pointer event');
  }
  if (!recorder.steps.any((s)=>s['kind']=='heightWrite')) {
    throw StateError('$scenario: missing height event');
  }
  print('PASS: $scenario rotation, identity, pointer and height traces');
}

void main() {
  rotation([30,20,10], 'LL');
  rotation([10,20,30], 'RR');
  rotation([30,10,20], 'LR');
  rotation([10,30,20], 'RL');
  TreeRecorder.resetIds();
  final tree = MyAVL();
  final values = <int>[];
  var seed = 17;
  for (var i = 0; i < 160; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    final value = seed % 67;
    if (seed.isEven) {
      tree.insert(value);
      if (!values.contains(value)) values.add(value);
    } else {
      final removed = tree.remove(value);
      final expected = values.remove(value);
      if (removed != expected) throw StateError('remove($value) mismatch');
    }
    check(tree, values);
  }
  for (final v in [...values]) {
    if (!tree.remove(v)) throw StateError('remove($v) failed');
    values.remove(v);
    check(tree, values);
  }
  print('PASS: deterministic mixed operations, deletion, and empty-tree invariants');
}
