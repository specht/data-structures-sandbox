# Data Structure Sandbox · curriculum and development roadmap

This file tracks teaching plans, planned interfaces and development work.
The [registry](../tool/registry.dart) and [contracts](contracts.md) describe
**currently executable** exercises. Add a new exercise only after its starter,
example, observable adapter, worker validation, renderer and tests work end to end.

## Currently available

- Stack: fixed array and linked nodes; queue: circular array and linked nodes.
- Lists: unsorted array, unsorted linked nodes, sorted array and sorted
  linked nodes, each with its own explicit ID and CLI selection. All four
  explicitly maintain a student-owned size field; the worker verifies it
  against physical storage. See [list exercises](list-exercises.md).
- Integer-set BST and AVL; array and node-based min-heaps; integer hash set
  with separate chaining and student-selected bucket count/hash function.
- Student starters and complete reference examples; independent reference
  models and physical-state checks; separate workers; browser editor and
  playback of observable mutations. Read the [development guide](../DEVELOPMENT.md)
  for the current test and deployment limitations.

## Teaching order

1. Indexed storage, unsorted arrays and unsorted linked nodes. Compare access,
   insertion, removal and duplicate handling. Then teach array/linked stacks.
2. Linked and circular queues, followed by sorted array/linked lists.
3. General binary-tree vocabulary and traversal, ordinary BSTs, and the impact
   of insertion order on tree height. AVL rotations can be an extension.
4. **Priority queue** as an ADT, implemented using an unsorted array, a sorted
   array and a binary heap. Compare operation costs and examine duplicates.
5. Hash sets, collisions and load factor; contrast with sorted lists and BSTs.
6. Directed graphs: adjacency lists/matrices, DFS and BFS using the previously
   learned stacks and queues, reachability, cycles and disconnected components.
7. Weighted graphs and Dijkstra, reusing priority queues; AVL deletion and
   node-based heaps remain optional advanced comparisons.

## Next: dedicated priority-queue unit

A heap is one implementation of the priority-queue ADT, not the ADT itself.
Keep the current integer min-heaps as introductory exercises. Define a new
priority-queue contract with an explicit `(priority, payload)` entry and an
optional insertion sequence to settle ties FIFO. The current integer heaps do
not promise FIFO behavior for equal priorities. Offer unsorted-array,
sorted-array and heap implementations with a shared `enqueue`, `peek` and
`dequeue` contract. Display priority and payload separately and count comparisons
and memory accesses. Use a concrete scheduling/print-job task. The current
node-heap reference's repeated root-to-parent lookup can make insertion
O(log² n), unlike the array heap's O(log n); document this if comparing costs.

## Next: directed graphs

Start with integer vertex IDs, directed unweighted edges, no duplicate edges,
and deterministic neighbor iteration. Decide self-loop and missing-vertex
behavior in the contract first. Implement observable adjacency-list storage and
stable graph layout (small deterministic geometry and optional manual placement),
then vertex/edge operations and invariant checks. Add BFS/DFS as traversal
overlays showing current vertex, frontier, visited set, and traversal edges;
return a reproducible visit order. Only then add adjacency matrices and compare
O(V+E) with O(V²) storage. A later weighted-graph extension may implement
Dijkstra using entries `(distance, vertex)` in the priority queue and discard
outdated entries rather than requiring decrease-key initially. The graph
renderer cannot simply reuse tree reachability/layout rules: cycles, multiple
incoming edges and disconnected components are normal graph states.

## Further candidates — not yet scheduled

- An array-backed *dynamic-capacity* list, with visible reallocation, distinct
  from the current eight-cell fixed-capacity teaching exercise.
- Hash maps with separate keys and payloads, plus resizing/rehashing and
  exploration of the load-factor trade-off. Current hash table is a fixed-bucket
  integer **set**, not a general map.
- A general binary tree without the BST ordering invariant; a deque;
  disjoint-set/union-find for connected components and Kruskal; optional trie.
- Comparison view: execute the same valid calls on two implementations, show
  theoretical bounds and observed comparisons, traversals, shifts and allocation.
  Passing functional tests does not establish asymptotic complexity.
- Intermediate starter milestones (BST insertion before deletion; AVL single
  rotations before complete AVL deletion; heap insert before removeMin),
  source-mapped helper diagnostics, robustness of generic Dart instrumentation.
- OS-level process, CPU/memory, filesystem and network isolation before running
  arbitrary untrusted student code on a shared production server. A separate
  worker and a timeout are reliability features, **not** a security boundary.

## Release checklist for every new structure

- Specify observable semantics, duplicate policy, empty/full/invalid-index
  behavior, and allowable storage representation.
- Add registry + CLI choice, unfinished starter + complete reference example,
  instrumentable storage, trace snapshots and playback for forward/back steps.
- Extend worker dispatch, reference model, physical invariant checks, model
  scenarios and end-to-end tests; verify that student file paths remain isolated.
- Test in a Dart-equipped workspace (`dart test/list_model.dart`,
  `dart test/validation_integration.dart`, optional `dart test/smoke.dart`, and
  `node test/*.test.js` individually). Do not treat source inspection as a test run.
- Update contracts, student onboarding, storage API and this roadmap. Keep
  installation instructions in the [README](../README.md), technical testing
  instructions in the [development guide](../DEVELOPMENT.md) and proposed
  features here; remove claims about old releases and deleted scripts.
