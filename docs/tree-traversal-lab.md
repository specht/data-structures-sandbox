# Tree traversals, DFS and BFS (Dart)

This optional learning extension applies to existing BST and AVL implementations.
It does **not** change earlier required methods or the existing class-progress
checks. New starter files contain six new TODO methods; an existing student
file can copy the signatures below without recreating the tree.

## Student-facing interface

```dart
void inorder(void Function(int value) visit);
void preorder(void Function(int value) visit);
void postorder(void Function(int value) visit);
void breadthFirst(void Function(int value) visit);
bool dfs(int target);
bool bfs(int target);
```

The callback is supplied by the Sandbox automatically. In the method picker,
`inorder()` etc. have no arguments. Their result is shown as the values passed
to the callback; **the student method still returns `void`**. Each callback
call records a highlighted visit in the execution timeline. The Sandbox checks
order against an independent reference traversal of the **current** BST/AVL
shape. `dfs(int)` and `bfs(int)` are true/false searches; their return values
are checked against the tree's contents. Visiting the right child first instead
of the left is not yet detected for searches; it is detected for traversals.

## Use your own queue

Students may use any of their **Dart** `MyLinkedQueue` or `MyArrayQueue`
implementations (including filename variants) in the same student directory:

```dart
import 'my_linked_queue.dart'; // or 'my_array_queue.dart'
```

Both existing queues store `int`. The supplied `TreeNodeQueue` adapter uses
**those exact enqueue/dequeue/isEmpty methods** and maps integer node IDs back
to `TreeNode` references. It is not a replacement queue and doesn't implement
FIFO. Example showing only the queue handling, not a completed BFS solution:

```dart
final queue = TreeNodeQueue(MyLinkedQueue()); // or MyArrayQueue()
if (root != null) queue.enqueue(root!);
while (!queue.isEmpty) {
  final current = queue.dequeue()!;
  // TODO: Visit the node and enqueue its children in the chosen order.
}
```

If the queue implementation is incomplete, its own methods determine the
behavior; a rejected enqueue throws a helpful error. An array queue with
capacity 8 has that capacity during BFS too. The 7-node sample tree fits both.
An import for another `.dart` file in the same student folder is copied into
the generated worker without changing the student's original source.

## Try it

1. Select a BST or AVL and click **Build sample tree**. The tool resets the
   selected tree and calls the student's `insert` method seven times (40, 20,
   60, 10, 30, 50, 70); it never injects a completed tree.
2. Add the methods to `my_bst.dart` or `my_avl.dart`, save, and select `inorder()`
   from the method picker.
3. Step through the trace. **Traversal visits** shows actual callback calls.
   The method report indicates whether the callback sequence was correct.
4. Compare preorder, inorder, postorder and breadthFirst; then implement `dfs`
   and `bfs` and compare their node visits for present and absent keys.

For the sample tree, expected sequences are:

- Inorder: 10, 20, 30, 40, 50, 60, 70
- Preorder: 40, 20, 10, 30, 60, 50, 70
- Postorder: 10, 30, 20, 50, 70, 60, 40
- Breadth-first: 40, 20, 60, 10, 30, 50, 70

These sequences are the same for BST/AVL **for this particular insertion order**.
A different insertion order may trigger AVL rotations and produce a different
shape and different traversal orders.

## Scope and limitations

- Callback discovery and the optional `TreeNodeQueue` adapter are implemented
  for Dart BST/AVL. The other language runtimes continue to work but do not
  expose these callback methods yet.
- Existing Run tests/class-progress checks remain unchanged. Individual
  traversal invocations are independently checked and report a pass/fail.
- This patch is intended for the current `main` of `specht/data-structures-sandbox`.
