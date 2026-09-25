# Data Structure Sandbox · extension architecture

The browser owns only display state, not the student's data. Dart executes a
selected student implementation; the trace adapter sends immutable moments and
explicit changes with original source locations. The adapter/renderer differs
by structure while method discovery, command dispatch, playback, and the code
panel remain shared.

| Structure | Observable storage | Mutation events | Layout |
| --- | --- | --- | --- |
| Linked lists (sorted / unsorted) | `ListNode(id,value,next)` + student-owned `head` and `size` | `createNode`, `pointerWrite`, student `size` writes, local references | Horizontal reachable chain; detached nodes retire at method end |
| Array lists (sorted / unsorted) | `ListMemory` fixed cells + student-controlled `size` | `cellWrite`, `indexWrite` | Fixed indexed cells, occupied prefix and visible shifts |
| BST / AVL | `TreeNode(id,value,left,right)` + `root` | left/right/root writes and value writes | Hierarchical inorder layout; settle *after* pointer moves |
| Array stack | fixed indexed `FixedMemory` + `top` | `cellWrite`, `indexWrite` | Fixed cell row, top marker, no node pointers |
| Circular array queue | `QueueMemory` + front/rear/size | `cellWrite`, `indexWrite` | Fixed cells; front and rear arrows on opposite sides; numbered logical FIFO order |
| Array min-heap | dynamic contiguous `HeapMemory` + length | `heapRead`, `heapWrite`, `heapAppend`, `heapRemove`, `heapSwap` | One immutable snapshot drives synchronized physical array and index-derived tree projection |
| Hash table | buckets + collision chains | indexed writes + node/reference writes | Bucket columns with linked chains |
| General graphs (future) | registered nodes/edges | edge updates | Stable geometric layout; graph traversal overlay |

A BST does not have to be balanced. The implemented AVL adapter additionally
records heights, checks balance factors and visualizes rotations using stable
node IDs. Heap algorithms are different: their logical tree follows array
indices, not left/right object pointers. Do not force an array heap into the
reference graph model. Both array and linked lists maintain a student-owned
`size`; the worker checks that field against their physical contents.

Trace registries must not become the only reason for an educationally "live"
object to stay visible. During a method, local variables may refer to
unreachable nodes; at method exit, the *display registry* retires objects not
reachable through the owning structure. This is a reachability visualization,
not direct observation of actual Dart garbage collection. Historical trace
snapshots retain IDs for backwards stepping; current and subsequent executions
exclude retired objects.

General source instrumentation is its own hard problem. The current AST bridge
covers common block-bodied synchronous methods and node-typed locals, but does
not promise the coverage of a Dart debugger for closures, async, arbitrary
custom class models, dynamic reflection, or optimized compiler internals.
