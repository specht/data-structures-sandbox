# Extending the sandbox beyond v1.2

The public `StructureSpec` registry currently advertises only implementations
with working adapters. Adding a filename to the registry alone does **not**
make it visualizable. Each new structure requires an explicit execution adapter,
model snapshot/invariants and a renderer that can animate the relevant memory.

1. **Linked stack and linked queue:** reuse `ListNode`, track the list's owning
   `head`/`tail` and the abstract `push`/`pop`, `enqueue`/`dequeue` contracts.
   Avoid assuming sorted values: these abstractions have different semantics.
2. **Fixed-array queue (implemented):** observable cells and independent
   `front`, `rear`, `size` markers; circular wraparound with distinct full/empty
   states. Physical cells stay fixed while logical FIFO order is highlighted.
   Worker checks returned values, occupied slots, bounds, and next-free index.
   Existing student implementations are never overwritten by an example.
3. **AVL tree (adapter and example added; end-to-end Dart validation required):** reuse `TreeNode` and binary-tree layout, but add `height`
   writes, balance factors and invariants for every subtree. Animate pointer
   writes first and allow the settled layout to move the same node IDs through
   rotations. Invalid balance remains visible and is reported separately.
4. **Array heap (adapter and example added; Dart smoke test required):** synchronized array and tree projections of the **same**
   indexed storage; pointer arrows are not appropriate for array indices.
   Record reads/writes/swaps, check heap order and complete-tree property.
5. **Node heap:** heap semantics shared with array heap, but reference-based
   storage; share abstract scenarios, not the physical memory renderer.
6. **Hash tables:** indexed buckets plus either observable collision chains or
   probe sequences. Check collision/lookup/removal semantics and load factor.
7. **Graphs:** an explicit vertex/edge adapter supporting adjacency lists or
   matrices and separate traversal overlays; IDs and positions must remain
   stable across snapshots.

Before any of these should be called classroom-ready: improve the AST instrumenter
for generic local references and function-body patterns, add per-adapter
reference-model tests and randomized scenarios, source-mapped diagnostics,
worker reconstruction/journaling, and enforce OS-level resource isolation for
shared deployments. Add protocol-version checks when expanding event types.
