# Lists: four comparable implementations

A *list* stores a sequence in which occurrences matter. Every list exercise
here allows duplicate integer values. **Storage** (array versus nodes) and
**ordering policy** (unsorted versus sorted ascending) are independent choices.
An ADT describes public behavior; an implementation supplies memory and code.
**Each list class declares its own `int size = 0`.** Students increment it after
successful inserts and decrement it after successful removals, including for
linked lists. `length()` returns `size` in O(1); it must not count nodes or
occupied cells each time. The visualizer observes the field but never maintains
it. Tests independently check it against the number of physically stored values.
`ListMemory.length` means array **capacity**, not the list's logical size.

| Exercise | CLI | Public behavior | Representation |
| --- | --- | --- | --- |
| Unsorted array | `./new-structure NAME list unsorted-array` | `insert(index,value)`, `get(index)`, `removeAt(index)`, `contains(value)`, `length()` | Eight fixed cells; student-owned `size` field; shift on indexed insertion/removal. |
| Unsorted linked nodes | `./new-structure NAME list unsorted-nodes` | Same unsorted interface and invalid-index rules | Singly linked acyclic chain; `head` and student-owned `size`; no fixed capacity. |
| Sorted array | `./new-structure NAME list sorted-array` | `insert(value)`, `contains(value)`, `remove(value)`, `length()` | Eight fixed cells; student-owned `size`; nondecreasing occupied prefix, duplicates retained. |
| Sorted linked nodes | `./new-structure NAME list sorted-nodes` | Same sorted interface, including `bool insert` and `length()` | Unbounded, acyclic singly linked chain with ascending values and student-owned `size`. |

`./new-structure NAME list` without a variant is intentionally rejected.
Start with `./new-structure NAME list unsorted-array`. Starters are unfinished;
`--example` copies a complete reference implementation to the selected student
folder without overwriting existing work. The `structures/` directory must
already be set up as a separate Git repository; `./run` does not create it.

## Classroom sequence

1. **Unsorted array.** Insert at index 0, the current length, and between two
   values. Observe how many cells must move. Test `get`, `removeAt`, invalid
   indices, duplicates, full capacity and reuse after deletion.
2. **Unsorted linked nodes.** Repeat exactly the same calls. Observe `head`,
   predecessor/next references, traversal and the empty-list case. Compare
   direct array access with linked traversal and the cost of insertion at the
   beginning versus at an arbitrary index.
3. **Sorted array.** Insert `8, 2, 5, 2, -3`; compare the final sequence with
   the order of method calls. Observe that sorted insertion may shift a suffix.
4. **Sorted linked nodes.** Apply the same values and compare pointer updates
   against array shifts. The sorted linked list completes the four-way comparison.

### Contracts and boundary cases

Unsorted lists accept insertion indices `0..length` inclusive, and access /
removal indices `0..length-1`. Invalid inserts return `false`; invalid `get`
and `removeAt` calls return `null` without changing state. `removeAt` returns
the removed value. The two array lists reject insertion when eight cells are
occupied. The sorted-array list's `insert` returns `false` when full; the
sorted linked list has a `bool` insert (always successful) and no fixed capacity.
`remove(value)` on sorted lists removes **one** matching occurrence and returns
whether one existed. No list is a set: duplicates are always retained.

### Complexity discussion

| Operation | Unsorted array | Unsorted linked nodes |
| --- | --- | --- |
| `get(index)` | O(1) | O(n) |
| Insert at front | O(n) | O(1) |
| Insert at an arbitrary index | O(n) | O(n) to find predecessor |
| Remove at front | O(n) | O(1) |
| `contains(value)` | O(n) | O(n) |

The sorted array has O(n) insertion/removal due to shifts, and the sorted
linked list has O(n) insertion/removal due to traversal. Sorted data does not
make linked-list indexed access constant-time. The capacities here are eight,
so these bounds describe the algorithms when considered as a family with
variable capacity/length; the fixed eight-cell exercise itself is bounded.

## Run reference checks

```sh
dart test/list_model.dart
dart test/validation_integration.dart
node test/list_view.test.js
```

`validation_integration.dart` copies the bundled examples to a temporary
student repository. The optional `dart test/smoke.dart` instead requires a
complete `structures/example` containing **every** registered reference
implementation, not just the four lists; see the
[development guide](../DEVELOPMENT.md). Passing tests verifies the scenarios
run, not asymptotic performance or every possible student implementation.
