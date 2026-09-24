# Array min-heap · classroom introduction

This adapter represents a **dynamic array**, not linked objects. The two
visual projections refer to exactly the same storage index `i`:

- Parent: `(i - 1) ~/ 2`, for `i > 0`.
- Children: `2 * i + 1` and `2 * i + 2`, when those indices exist.
- Root / minimum: `memory[0]`, when nonempty.
- The contiguous array has no holes, so its index-derived binary tree is
  complete. Duplicate keys occupy separate indices.

A student's `MyArrayHeap` declares `final HeapMemory memory = HeapMemory();`
from `../../lib/heap_sandbox.dart`, then implements public methods with the
same signatures as the example: `insert(int)`, `removeMin()`, `peek()`,
`isEmpty()`. The adapter exposes `memory.length`, `memory.isEmpty`, indexed
reads and writes, `memory.add`, `memory.removeLast`, and `memory.swap`.
Array reads, writes, additions, removals, and swaps are recorded by Dart;
methods themselves are discovered from the student's unmodified source.

`HeapMemory` is a **teaching API**, not a generic Dart List implementation.
Avoid working around it with an unobservable local `List<int>`. This example
is a *min*-heap; max-heaps have a different ordering contract and need a
separate adapter rather than silently changing these invariants.

## Try it

Run `./new-structure example heap array --example` after applying the patch. This adds
`structures/example/my_array_heap.dart` without overwriting existing student
files. If the example directory belongs to a separate Git repo, commit there
separately.

Try `insert(25)`, `insert(7)`, `insert(13)`, `insert(5)`, `insert(20)`, then
`peek()` and repeated `removeMin()`. Follow an indexed cell from the array to
its tree position, and observe how the *values* change indices during swaps;
there are no node identities to preserve. Repeat with duplicate values and
negative numbers. A temporarily invalid ordering during insert/removal is
expected; the worker checks the completed public method's min-heap invariant.

## Verify before using with students

```
dart test/heap_model.dart
dart test/smoke.dart
for t in test/*.test.js; do node "$t"; done
./run
```

`dart test/heap_model.dart` includes deterministic randomized scenarios and
checks duplicates, sorted removal, the multiset and min-heap invariant.
`dart test/smoke.dart` compiles and executes a real generated worker; JS tests
exercise historical array/tree projection, index highlighting and auto-framing.
A separately running student worker still has the existing event-size and
wall-clock limits. No unverified claim of OS-level isolation is made.
