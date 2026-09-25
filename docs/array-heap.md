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

Run `./new-structure example heap array --example`. This adds
`structures/example/my_array_heap.dart` without overwriting existing student
files. If the example directory belongs to a separate Git repo, commit there
separately.

Try `insert(25)`, `insert(7)`, `insert(13)`, `insert(5)`, `insert(20)`, then
`peek()` and repeated `removeMin()`. Follow an indexed cell from the array to
its tree position, and observe how the *values* change indices during swaps;
there are no node identities to preserve. Repeat with duplicate values and
negative numbers. A temporarily invalid ordering during insert/removal is
expected; the worker checks the completed public method's min-heap invariant.

## Verify

```sh
dart test/heap_model.dart
dart test/validation_integration.dart
node test/heap_view.test.js
```

The model test includes deterministic randomized scenarios; integration
compiles and exercises the reference implementations in a temporary student
repository. The view test checks the array/tree projection and trace history.
`dart test/smoke.dart` is optional and needs a complete `structures/example`
for **all** registered structures; see [development guide](../DEVELOPMENT.md).
A separate worker with time and event limits is not OS-level security isolation.
