# Data Structure Sandbox · student-facing contracts

This document defines the **current** executable contracts. A data structure's
abstract operations come first; its memory representation is a separate choice.
All keys/values in the current sandbox are Dart `int` values. Unless specified,
identical values are allowed. Methods work on one persistent instance, are
synchronous and do not print output to communicate their result.

## Canonical interfaces

| Choice in browser | Required public methods | Order, duplicates, empty/full behavior |
| --- | --- | --- |
| Stack (fixed array) | `bool push(int)`, `int? pop()`, `int? peek()`, `bool isEmpty()` | LIFO, duplicates allowed, capacity 8; `push` returns `false` without changes if full; empty pop/peek return `null`. |
| Stack (linked list) | Same stack interface | LIFO, duplicates allowed, no fixed capacity; successful `push` returns `true`, empty pop/peek return `null`. `head` is top. |
| Queue (circular array) | `bool enqueue(int)`, `int? dequeue()`, `int? peek()`, `bool isEmpty()`, `bool isFull()` | FIFO, duplicates allowed, capacity 8; full enqueue returns `false` without changes; empty dequeue/peek return `null`. `front` is next-to-dequeue; `rear` next-to-enqueue; `size` distinguishes full and empty. |
| Queue (linked list) | Same queue interface except `isFull()` | FIFO, duplicates allowed, no fixed capacity; successful enqueue returns `true`; both `head` and `tail` are null when empty. |
| List (unsorted, array) | `bool insert(int index,int value)`, `int? get(int index)`, `int? removeAt(int index)`, `bool contains(int)`, `int length()` | Integer sequence, duplicates allowed, capacity 8. Insert at indices 0..length, read/remove at 0..length-1. Invalid indices return `false`/`null` without changes; full insert returns `false`. |
| List (unsorted, singly linked) | Same unsorted list interface | Same sequence/invalid-index semantics; no fixed capacity; `head` owns an acyclic singly linked chain. |
| List (sorted, array) | `bool insert(int value)`, `bool contains(int)`, `bool remove(int)`, `int length()` | Ascending order, duplicates allowed, capacity 8. Full insert returns `false` without changes; remove deletes exactly one occurrence. |
| List (sorted, singly linked) | `bool insert(int)`, `bool contains(int)`, `bool remove(int)`, `int length()` | Ascending order, duplicates allowed, no fixed capacity; insert adds one occurrence and returns `true`, remove deletes one matching occurrence. |
| Tree (binary search) | `void insert(int)`, `bool contains(int)`, `bool remove(int)` | Integer set: duplicate inserts change nothing; left keys strictly smaller, right keys strictly greater; removal returns whether a key was present. No balancing guarantee. |
| Tree (AVL) | Same tree interface | Same set semantics, plus stored subtree heights and balance factor between −1 and +1 after each public call. |
| Heap (array) | `void insert(int)`, `int? removeMin()`, `int? peek()`, `bool isEmpty()` | Dynamic **min**-heap, duplicates allowed; minimum at root/index 0; empty peek/remove return `null`. |
| Heap (node-based) | Same heap interface | Same min-heap semantics but real nodes: complete binary tree; `size` equals reachable node count; node IDs remain stable when values sift. |
| Hash table (separate chaining) | `bool insert(int)`, `bool contains(int)`, `bool remove(int)`, `bool isEmpty()`, `double loadFactor()` | Integer **set**: duplicate insert returns `false`, missing remove returns `false`; fixed positive bucket count chosen by student; student's deterministic hash function returns a valid index even for negative keys; load factor is `size / bucketCount` (can exceed 1). |

### List variants

All four list classes declare a student-owned `int size = 0`. Students update it
on successful insertion/removal. Failed operations leave it unchanged, and
`length()` returns this field in O(1), without counting occupied cells or nodes.
`ListMemory.length` denotes *capacity*, not the list's logical size.
`ListMemory` does not own or update the student's size. After every public
operation the worker checks the field against the physically occupied array
prefix or the number of reachable linked nodes, as well as the reference model.

All four exercises have explicit IDs and require explicit CLI selections.
Both unsorted lists share `insert(index,value)`, `get(index)`, `removeAt(index)`,
`contains(value)` and `length()`; both sorted lists share `insert(value)`,
`contains(value)`, `remove(value)` and `length()`. Every list allows duplicates.
`insert` returns `bool`: the unbounded linked variant returns `true`, whereas
fixed arrays return `false` if full. Invalid indices leave unsorted lists
unchanged and return `false` or `null`, as applicable. Sorted insertions preserve
ascending order, and remove deletes exactly one occurrence.
See [list exercises](list-exercises.md).

### Worker, source, and representation

Keep the file name, class name, and public method signatures from the starter.
The worker recognizes *public* methods with scalar arguments; private helpers
may be implemented freely and remain outside the method picker. Keep the
observable storage fields specified in the starter (`memory`, `top`, `head`,
`tail`, `root`, `size`, `buckets`), because the framework uses them for snapshots.
Do **not** call any recorder or renderer from student code: the framework
instruments a separate copy while showing students their own source file.

For the fixed-array stack, `int top = -1` is **owned by the student**;
`FixedMemory` owns only observable cells. Assign to `top` in student code;
the sandbox instruments and visualizes the assignment automatically.
See [storage APIs](storage-api.md). Create a starter with
`./new-structure STUDENT stack array` or use `stack nodes` for the linked
implementation. Both commands create unfinished student exercises.

Returning a placeholder `false` or `null` in a starter is not a solution.
It is intentionally compilable but should fail the model check when the
operation is supposed to succeed. The `example/` templates remain **complete
working implementations**; `starter/` files are unfinished exercises.

## Planned interfaces

Priority queues and graphs are not currently selectable exercises. Their
proposed contracts and implementation sequence are recorded in the
[roadmap](roadmap.md); the registry defines what is runnable today.
