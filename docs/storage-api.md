# Observable storage APIs · student reference

The `lib/` files are **sandbox storage adapters**, not solutions. Students
implement the algorithms inside their own `My…` classes. No imports of a
recorder, animation API, or direct modification of `tool/generated/` are needed.

## Stack (fixed array): `FixedMemory`

Use `import '../../lib/stack_sandbox.dart';` and keep these fields in
`MyArrayStack`:

```dart
final FixedMemory memory = FixedMemory(8);
int top = -1;
```

`FixedMemory(capacity)` allocates a **fixed-length** collection of nullable
integers. Its public student API consists of:

| Expression | Meaning |
| --- | --- |
| `memory.length` | Number of physical cells; here, 8. |
| `memory[index]` | Read one cell; returns `int?`, including `null` for an empty cell. |
| `memory[index] = value` | Write an `int` into a cell; shows the write in the sandbox. |
| `memory[index] = null` | Clear a cell after removing its value. |

Valid indices range from `0` through `memory.length - 1`. Reading or writing
outside that range raises Dart's range error. There is **no** `add`, `removeLast`,
`push`, `pop`, or `top` operation on `FixedMemory`; those are tasks for the
student's stack implementation. The sandbox reads `MyArrayStack.top` to draw
the top pointer and automatically traces direct assignments such as
`top = top + 1` and `top--` in student methods. The stack is empty when `top == -1`.
The full condition is `top == memory.length - 1`.

Example student-owned storage and operation signature:

```dart
class MyArrayStack {
  final FixedMemory memory = FixedMemory(8);
  int top = -1;

  bool push(int value) {
    // TODO: check for full, update top, write memory[top], return a bool.
    return false;
  }
}
```

For the first exercise, implement `push` and inspect the trace after `push(5)`.
Then add `peek`, `pop` (clear the vacated slot), and `isEmpty`. A ninth push
must return `false` without changing the eight-cell stack.

## Stack (linked nodes): `ListNode`

Select `./new-structure alice stack nodes`. Import `../../lib/sandbox.dart`.
The starter owns `ListNode? head;`, pointing to the top node. Construct a new
node with `ListNode(value)`; `node.value` reads its integer; `node.next` holds
another `ListNode?`, and assigning to `next` updates an observable reference.
A linked stack does not use `FixedMemory` or an integer `top`; its `head` **is**
the top reference. See `templates/starter/my_linked_stack.dart`.

## Observable array-list storage: `ListMemory`

Both array-list variants use `import '../../lib/list_sandbox.dart';` and
declare `final ListMemory memory = ListMemory(8);` in the student class.
**All four list variants**, including linked lists, also declare `int size = 0`.
The student must update `size` after successful insertions and removals.

| Expression | Meaning |
| --- | --- |
| `memory.length` | Physical capacity (always 8 in these exercises). |
| `memory[index]` | Read a nullable cell. |
| `memory[index] = value` | Write a value or `null` into an existing cell; the write is visualized. |

The physical storage does **not** insert, remove or shift automatically.
Occupied values must form a contiguous prefix `0..size-1`, with all
remaining cells null. The sorted-array exercise also requires the occupied
prefix to be nondecreasing. The adapter observes student-owned `size` updates
but never performs them. Linked lists must maintain the same field; their
`length()` method returns `size` without traversing the chain.

## Other storage choices

The same principle applies to `QueueMemory` (observable fixed cells and
front/rear/size), `TreeNode` (value, left/right, height), `HeapMemory` (growable
indexed heap cells), and `HashBuckets` (indexed bucket heads). The bottom
comment of each starter explains the exact API needed for that exercise;
`lib/*_sandbox.dart` contains the adapter definitions. Student methods,
data-structure invariants, return values and pointer updates remain their
responsibility.
