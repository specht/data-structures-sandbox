# Tree traversals: depth-first and breadth-first (Dart)

BST and AVL trees have four traversal methods. They belong to the exercise:
**Run tests** and **Class progress** check them along with `insert`,
`contains` and `remove`.

## Student-facing interface

```dart
void preorder(void Function(int value) visit);     // depth-first: node, left, right
void inorder(void Function(int value) visit);      // depth-first: left, node, right
void postorder(void Function(int value) visit);    // depth-first: left, right, node
void breadthFirst(void Function(int value) visit); // level by level, left to right
```

The Sandbox supplies the `visit` callback. In the method picker,
`inorder()` and the others take no arguments. Their result is the sequence of
values passed to the callback; **the student's method still returns `void`**.
Each callback call is a highlighted visit in the execution timeline. The order
is checked against an independent reference traversal of the tree's
**current** shape, so AVL rotations are taken into account.

## Files written before the traversals existed

Student files are never changed by the Sandbox. When the selected Dart BST/AVL
lacks one of the four methods (or declares it with another signature):

- A notice above the editor lists the missing methods.
- **Insert method stubs** adds TODO stubs to the editor *draft*, inside the
  class before its closing brace, with the class's own indentation. The student
  reviews and saves (Ctrl+S); Ctrl+Z undoes the insertion. A method that exists
  under the right name with another signature is not duplicated; the status
  line shows the required signature instead. A draft with syntax errors is
  refused unchanged.
- In **Run tests**, the traversal groups fail with "not implemented yet"
  instead of stopping the run; the earlier groups are unaffected.

The stubs are defined in `tool/method_stubs.dart`; new starters contain the
same text (`test/method_stubs_test.dart` keeps them in sync).

## Breadth-first traversal uses the student's own queue

`breadthFirst` must use one of the student's **Dart** `MyLinkedQueue` or
`MyArrayQueue` implementations (filename variants included) from the same
student directory:

```dart
import 'my_linked_queue.dart'; // or 'my_array_queue.dart'
```

Both queues store `int`. The supplied `TreeNodeQueue` adapter uses
**those exact enqueue/dequeue/isEmpty methods** and maps integer node IDs back
to `TreeNode` references. It is not a replacement queue and does not implement
FIFO itself. It accepts only `MyLinkedQueue` and `MyArrayQueue`, and
Run tests fails a breadth-first traversal of a non-empty tree that did not
enqueue through it ("Uses your own queue"), even if the order is right.
Example showing only the queue handling, not a completed traversal:

```dart
final queue = TreeNodeQueue(MyLinkedQueue()); // or MyArrayQueue()
if (root != null) queue.enqueue(root!);
while (!queue.isEmpty) {
  final current = queue.dequeue()!;
  // TODO: Visit the node and enqueue its children, left before right.
}
```

If the queue implementation is incomplete, its own methods determine the
behavior; a rejected enqueue throws a helpful error. An array queue with
capacity 8 has that capacity during the traversal too; every tested tree fits.
An import of another `.dart` queue file in the same student folder is copied
into the generated worker without changing the student's original source.
`./new-structure STUDENT tree --example` also copies the example linked queue
if the student has none, because the example's `breadthFirst` uses it.

## Try it

1. Select a BST or AVL and click **Build example**. The tool resets the
   selected tree and calls the student's `insert` method seven times (40, 20,
   60, 10, 30, 50, 70); it never injects a completed tree.
2. Implement the traversals, save, and select `inorder()` from the method picker.
3. Step through the trace. **Traversal visits** shows the actual callback calls,
   and each visited node gets a badge with its position in the visit order (a
   node visited twice shows both numbers);
   the method report says whether the sequence was correct.
4. Compare preorder, inorder, postorder and breadthFirst on the same tree.

For the sample tree, the expected sequences are:

- Preorder: 40, 20, 10, 30, 60, 50, 70
- Inorder: 10, 20, 30, 40, 50, 60, 70
- Postorder: 10, 30, 20, 50, 70, 60, 40
- Breadth-first: 40, 20, 60, 10, 30, 50, 70

These sequences are the same for BST/AVL **for this particular insertion order**.
Another insertion order may trigger AVL rotations and produce another shape and
other traversal orders.

## Tests

Run tests adds one group per traversal for Dart BST/AVL files, so a finished
traversal passes while another one is still a stub. Each group calls its
method on an empty tree, on the complete sample tree, and again after inserting
35, 45, 75 and 80 (an uneven tree; an AVL rotates on the way). The trees are
built with the student's own `insert`.

## Scope and limitations

- Callback discovery, stubs and the `TreeNodeQueue` adapter exist for Dart
  only. Python, JavaScript and Java BST/AVL files keep working; their Run tests
  and class progress do not include traversals until their workers support
  them (see the [roadmap](roadmap.md)).
