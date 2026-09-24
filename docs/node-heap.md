# Node min-heap · classroom example

This implementation uses **TreeNode references**, not a hidden array. Each
insertion allocates a node and connects it to the next available child slot
in breadth-first order. Each removal disconnects the last node. During sift-up
and sift-down, **node IDs and pointers stay the same, but their values swap**.

Compare with the array min-heap: both structures implement `insert`, `peek`,
`removeMin` and `isEmpty`, and allow duplicates. In the array version, an
index determines a tree position; in the node version, the left/right object
references determine the tree, while the binary representation of a 1-based
position helps locate a parent or the last node.

To make a new example in the *separate* student repository:

```sh
./new-structure example node_heap
```

Try `insert(25)`, `insert(7)`, `insert(13)`, `insert(5)`, then `removeMin()`.
Use Step to see node creation, reference writes, value changes, and removal.
A complete heap has no gaps at any level except possibly the right of the
bottom level; unlike a BST, its values are **not** ordered by in-order traversal.

The adapter checks the reachable nodes, their unique identities, the complete
shape and `parent <= child` after each public method. Intermediate snapshots
may temporarily violate min-heap order during a sift; the returned state may
not. The reference model independently checks duplicates and minimum removal.

For a local check before giving the example to students:

```sh
dart test/node_heap_model.dart
dart test/smoke.dart
for t in test/*.test.js; do node "$t"; done
```
