# Student quick start · Stack (fixed array)

Your files live in a **separate `structures/` Git repository**, with one folder
per student. Start the sandbox from the *outer* application directory:

```sh
./run
```

In another terminal, in the same outer directory, create your own **unfinished**
stack implementation (replace `alice` with your own folder name):

```sh
./new-structure alice stack --starter
```

This creates `structures/alice/my_array_stack.dart`. It never overwrites an
existing implementation. If your teacher has already created the file for you,
**edit that existing file** rather than running the command again. Use the
**Student** picker to select `alice`, then **Structure → Stack (fixed array)**.
On save the sandbox checks the file and prepares a fresh Dart worker. An empty
state is expected after code changes; stored values do not survive a rebuild.

### Implement and test one behavior at a time

Read `docs/contracts.md` and open your `my_array_stack.dart`. The starter
already provides `FixedMemory(8)` and the observable `top` getter/setter.
You write the logic, **not** the drawing code. `top == -1` means empty, and
`memory[0]` through `memory[7]` are fixed cells. No `List.add()` or
`List.removeLast()` is needed.

1. Implement `push(int value)`: if full, return `false` without changing the
   stack. Otherwise increase `top`, write `value` into `memory[top]`, return
   `true`. In the browser run `push(5)`, `push(7)` and inspect the snapshots.
2. Implement `peek()`: return the value at the top without removing it;
   return `null` if empty. Verify that `peek()` leaves the diagram unchanged.
3. Implement `pop()`: return `null` when empty. Otherwise read the old top,
   clear that cell by writing `null`, decrease `top`, return the saved value.
   Try `pop()` twice, then a third time on the empty stack.
4. Test the boundary: push nine values; only eight may be stored. Use duplicate
   values too. Compare the results and highlighted source lines with the
   **example** student's working stack.

The method-call box accepts only methods exposed by your selected class.
Use Step and the arrow keys to inspect writes; Home/End jump through the
trace when focus is outside a text editor or slider. The source display
highlights your Dart file; the instrumented worker lives outside your student
repository. Commit your file in the **separate** `structures/` repository when
your implementation passes its checks.

For another structure use `./new-structure alice KIND --starter` with one of:
`list`, `tree`, `avl`, `stack`, `linked_stack`, `linked_queue`, `array_queue`,
`array_heap`, `node_heap`, `hash`. The same command **without** `--starter`
continues to copy a complete example. Do not run either on an existing file.
