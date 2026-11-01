// Run from repo root: dart test/tree_traversal_model.dart
import '../lib/tree_sandbox.dart';
import '../lib/structures/trees.dart';

class _Example {
  TreeNode? root;
}

// Named like a student's queue: TreeNodeQueue accepts only those classes.
class MyLinkedQueue {
  final _contents = <int>[];
  bool enqueue(int value) { _contents.add(value); return true; }
  int? dequeue() => _contents.isEmpty ? null : _contents.removeAt(0);
  bool isEmpty() => _contents.isEmpty;
}

void check(bool value, String label) {
  if (!value) throw StateError(label);
}

void main() {
  final adapter = TreeAdapter.bst(
    create: () => _Example(),
    invoke: (instance, method, args) => null,
    methodsJson: '[]',
  );
  adapter.reset();
  final tree = adapter.instance as _Example;
  final n40 = TreeNode(40);
  final n20 = TreeNode(20);
  final n60 = TreeNode(60);
  final n10 = TreeNode(10);
  final n30 = TreeNode(30);
  final n50 = TreeNode(50);
  final n70 = TreeNode(70);
  n20.left = n10;
  n20.right = n30;
  n60.left = n50;
  n60.right = n70;
  n40.left = n20;
  n40.right = n60;
  tree.root = n40;

  void equal(String name, List<int> wanted) {
    final got = adapter.traversalOrder(name);
    check(got.join(',') == wanted.join(','), '$name: wanted $wanted, got $got');
    check(adapter.returnMatches(name, wanted, got), '$name: correct order rejected');
    check(!adapter.returnMatches(name, wanted, got.reversed.toList()),
        '$name: reversed order accepted');
  }

  equal('inorder', [10, 20, 30, 40, 50, 60, 70]);
  equal('preorder', [40, 20, 10, 30, 60, 50, 70]);
  equal('postorder', [10, 30, 20, 50, 70, 60, 40]);
  equal('breadthFirst', [40, 20, 60, 10, 30, 50, 70]);

  var rejected = false;
  try {
    TreeNodeQueue(<int>[]);
  } on ArgumentError {
    rejected = true;
  }
  check(rejected, 'A Dart List must not count as the student queue');
  TreeNodeQueue.enqueues = 0;
  final queue = TreeNodeQueue(MyLinkedQueue());
  queue.enqueue(n40);
  queue.enqueue(n20);
  check(identical(queue.dequeue(), n40), 'Queue lost FIFO order');
  queue.enqueue(n60);
  check(identical(queue.dequeue(), n20), 'Queue lost second node');
  check(identical(queue.dequeue(), n60), 'Queue lost third node');
  check(queue.dequeue() == null, 'Queue should be empty');
  check(queue.isEmpty, 'Queue isEmpty disagrees');
  check(TreeNodeQueue.enqueues == 3, 'Enqueues through the adapter are counted');
  print('PASS: reference traversals and student integer-queue bridge');
}
