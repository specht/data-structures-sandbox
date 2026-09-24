# Data Structure Sandbox · v1.2 foundation

Dart executes student implementations. A persistent Dart HTTP/WebSocket host serves the
JavaScript/SVG visualization and supervises **separate Dart worker processes**.
The browser application is never rebuilt when students edit code.

**Teaching materials:** Start with [the fixed-array stack exercise](docs/start-here.md)
and the [canonical interfaces and invariants](docs/contracts.md). The new
`templates/starter/` files are unfinished student tasks; `templates/example/`
remains a collection of complete reference implementations. The class files
live in their own `structures/` Git repository.

## Try it

```bash
cd ~/data-structure-sandbox-browser-v1.2
./run
```

The browser should open on port 8081. If necessary use `./run --no-open` and
open the Workspace's port-forwarded URL. Use `./run --port 8082` when 8081 is occupied.
The first launch installs the `analyzer` package; later launches reuse it.

If `structures/` does not exist, `./run` creates a **separate local Git repository**
containing a working `example/` implementation for each of the supported
structure types. The outer app `.gitignore` excludes `structures/` entirely.
To use your existing class repository instead, remove or move the local sample
`structures/` directory and clone the class repository **exactly** at that path:

```bash
cd ~/data-structure-sandbox-browser-v1.2
git clone <YOUR_CLASS_REPOSITORY_SSH_URL> structures
./run
```

Alternatively: `./run --students /path/to/your/existing/class/repository`.
There is also a separate, downloadable student-repository starter ZIP.

## Students and structure discovery

The class repository has a directory per student:

```text
structures/                         # its own Git repository
├── example/
│   ├── my_linked_list.dart          # list: MyLinkedList
│   ├── my_bst.dart                  # tree: MyBST
│   ├── my_array_stack.dart          # stack: MyArrayStack
│   ├── my_linked_stack.dart         # linked_stack: MyLinkedStack
│   ├── my_linked_queue.dart         # linked_queue: MyLinkedQueue
│   └── my_array_queue.dart          # array_queue: MyArrayQueue
├── alice/
│   ├── my_linked_list.dart
│   └── my_array_stack.dart
└── bob/
    └── my_bst.dart
```

Student folders and recognized filenames appear automatically in the browser,
including directories created while `./run` is open. The selected student and
structure are remembered in browser local storage and in `.runtime/selection.json`.
Each browser connection owns a separate runner, so selecting another student's
implementation does not change another browser session's in-memory structure.

Click example method calls or type `insert(20)`, `contains(13)`, `remove(13)`,
`push(5)`, `pop()` etc. Method signatures are discovered from the student's
Dart AST. The browser visualizes the **original source**, not the instrumented copy.
Use **Step**, **Play**, or **Show result**, and arrow keys to navigate the trace.

### What's implemented now

Visual adapters currently cover the sorted linked list, unbalanced BST, AVL
tree, fixed-array and linked stacks/queues, array and node min-heaps, and the
separate-chaining hash set. Method discovery works for synchronous public
methods with supported scalar parameters. The sorted list exposes only
`insert`, `contains` and `remove`. See [the contracts](docs/contracts.md)
before assigning an exercise. Directed graphs and traversal overlays are the
next roadmap stage; see [the roadmap](docs/roadmap.md).

## Circular array queue (roadmap stage 2)

For a student exercise, run `./new-structure alice queue circular`. To add a
reference queue to an existing `structures/example` folder, use
`cp -n templates/example/my_array_queue.dart structures/example/`.
This does not overwrite existing work. A fresh `./run` initialization
already includes the sample.

The queue uses eight **stationary** observable cells, with `front` pointing to
its next dequeue slot, `rear` to the next enqueue position (once space is available), and `size` distinguishing
full from empty even when both indices coincide. `enqueue(int)` returns false
when full; `dequeue()` and `peek()` return null when empty. The visualizer
shows front above, rear below, logical FIFO order numbered over occupied
cells, and intermediate writes during step-by-step playback. Check wraparound
by filling the queue, dequeuing three elements, then enqueuing three more.

Run `dart test/smoke.dart` and the Node.js geometry/navigation tests before
introducing the example to students. The student repository and the
worker cache remain separate.

## Failure handling and limits

- A student method executes in a separate Dart process, never in the browser
  server. The HTTP server, method picker and previous trace remain responsive
  if a worker hangs or crashes.
- Each method call has a **4-second wall-clock deadline**. On timeout the runner
  is forcibly terminated; click **Retry** to create a new,
  initially empty instance. **Its partially mutated state is not reused.**
- Traces have a **4,000-event cap** and an 8 MB response cap. Exceeding either
  limit terminates the worker; the previous trace stays visible.
- When a source file changes, only the selected implementation is prepared and
  analyzed again. A syntax/compile error appears in the browser while the host
  continues running. The previous trace is **stale**, not an executable old
  implementation. Fix the source and save to retry.
- Because a new worker owns fresh in-memory objects, saving the source resets
  that implementation's data-structure state. This is intentional in v1.2.
- A subprocess and timeout are **reliability measures, not security isolation**.
  Do not execute untrusted arbitrary code on a shared production host without
  OS-level restrictions on process trees, CPU/memory, filesystem and network.

The current source instrumenter supports a deliberate Dart subset. It does not
instrument arbitrary closures, async functions, complex user-defined objects,
or every possible assignment expression. Unsupported code should produce a
compile or analyzer diagnostic rather than silently invent a visualization.

## Test in your Workspace

```bash
dart test/smoke.dart
# Optional: Node.js is not needed for the application, only for JS regression tests.
node test/browser_navigation.test.js
node test/browser_geometry.test.js
node test/tree_motion.test.js
node test/student_catalog.test.js
```

The end-to-end Dart worker test must be run in the Workspace. The ZIP was built
without a Dart SDK in the authoring environment, so **Dart compilation has not
been verified here**.

Create an unfinished starter without overwriting existing work:

```bash
./new-structure alice list
./new-structure alice stack
```

All currently implemented adapters are supported by this helper.

## Worker cache (patch after v1.2)

`./run` no longer deletes the generated files on each startup. A worker's
fingerprint includes the selected student's source (and relative imports),
the Dart SDK version, framework libraries, templates, generator, and dependency
lockfile. Only the selected implementation needs rebuilding when it changes;
other students and structures keep their cached workers.

The first preparation of a revision instruments the source and attempts to
compile a Dart kernel (`.dill`). Later selections and application restarts use
that same validated artifact; the browser/HTTP server are never recompiled.
Each browser session still has its **own** persistent worker process and
independent in-memory data structure. A worker is replaced only when its
source changes, its selection changes, it crashes, or it times out. On SDKs
without `dart compile kernel`, the cache reuses the validated generated Dart
source instead, but launching that source may still incur VM compilation.

`[build]` and `[cache]` messages in the terminal distinguish new preparations
from cache hits. A genuine code change does require recompilation; caching does
not make the first compile of a new revision instantaneous. A syntax error does
not replace the previously cached successful artifact or make the server exit.

To clear old artifacts, **stop** `./run` and execute:

```bash
rm -rf tool/generated tool/generated_worker_*.dart tool/generated_worker_*.dill
```

These are ignored scratch files, not student files. They are recreated on demand.
Run `dart test/smoke.dart` to check worker startup and calls in your Workspace.

## Roadmap milestone 1a · linked stack

The linked stack uses `ListNode` and an owning `head` pointer (the top), with
`push`, `pop`, `peek`, and `isEmpty` methods. Its contents appear in LIFO order,
not sorted order. The reference model checks successful push, empty and nonempty
pop/peek, and empty state against the actual reachable chain. There is no fixed
capacity. The trace-event and worker-time budgets still prevent runaway code.

After `./run` initializes `structures/example`, copy
`templates/example/my_linked_stack.dart` into `structures/example/` if the
student repository already existed before this milestone. Run
`./new-structure alice stack nodes` for a new student file.

## Roadmap milestone 1b · linked queue

The linked queue uses `ListNode` with separate `head` (front) and `tail`
(rear) owning references. Its `enqueue`, `dequeue`, `peek`, and `isEmpty`
methods are FIFO; duplicates are preserved. The reference model checks
returned results, logical order, and physical head/tail consistency, including
last.next == null and the empty-to-nonempty transition. The renderer shows the
head and tail pointers independently alongside the same node-link animations.

If your student repo predates this milestone, add the example without
overwriting existing work:

```bash
cp templates/example/my_linked_queue.dart structures/example/
./new-structure alice queue nodes
```

Run `dart test/smoke.dart` in the Workspace after adding example files.

## Larger structures and diagram navigation

Trees, linked lists, linked stacks, and linked queues no longer stop at 12
reachable nodes. The 12-call **batch** limit remains separate; students can
submit more calls subsequently, with state retained in the same worker. The
fixed-array stack still has eight physical cells by design.

Use **+**, **−**, the mouse wheel, or **Fit** to inspect large diagrams; drag
the diagram to pan. The viewport is never automatically resized during trace
playback. Run Fit again after making a tree much larger. Very large or
strongly unbalanced trees can still become crowded, and execution remains
subject to the worker deadline, the 4,000-event trace cap, and the response
size budget.

## AVL tree (roadmap item 3)

The AVL adapter reuses the existing tree renderer with stable node IDs. It
shows each node's **stored height** (`h`) and **calculated balance factor**
(`b = left-subtree height − right-subtree height`). A red outline indicates a
height mismatch or a subtree with `|b| > 1`. Red outlines in **intermediate
rotation frames** are expected; the worker checks all subtree heights, balance,
BST order, and shared/cyclic pointers **after each public operation** and
reports the failures separately from the abstract set-value check.

```
cp -n templates/example/my_avl.dart structures/example/
./run
```

Try `insert(30)`, `insert(20)`, `insert(10)` (LL rotation), then reset and
try RR (`10,20,30`), LR (`30,10,20`), RL (`10,30,20`) and removal. Rotation
helpers in the example are private methods: their observable pointer/height
writes are recorded, while the current AST source-line stepping concentrates
on public method bodies (helper source mapping remains future work).

Run `dart test/avl_model.dart`, `dart test/smoke.dart`, and
`node test/avl_view.test.js` in your Workspace.
The worker smoke test needs the `example` AVL file in the separate
`structures/` repository; it never creates or overwrites a student's work.
The standalone model test runs directly against the bundled example.

## Creating student starters

Run `./new-structure` to list interface/implementation choices. For example,
`./new-structure alice stack array` creates an unfinished eight-cell stack;
`./new-structure alice stack nodes` creates a linked-node stack. The default
is always an unfinished starter. Files are never overwritten, and
`structures/` remains a separate Git repository.
See `docs/contracts.md`, `docs/start-here.md` and `docs/storage-api.md`.

## Check an implementation in the browser

After selecting a student and data structure, click **Test my implementation**
above the source/visualizer workspace. A progress bar and individual status
icons appear as predefined test groups run. Failed groups show the first failing
method call and the worker's diagnostic; other groups continue to run.

Tests use a separate Dart worker and reset the structure for every group, so
running them does not change the interactive visualization. The same reference
model and representation checks used during normal method calls validate the
student's implementation. Editing the student file or changing the selection
invalidates previous test results. A timeout is reported as a failed group.
Passing every test means that the tested scenarios passed, **not** that all
possible inputs or implementations have been formally verified.

Run `node test/validation_ui.test.js` to check the test-interface controls and
`dart test/student_validation.test.dart` to check suite definitions. Run
`dart test/validation_integration.dart` after initializing `structures/example`
to execute every scenario against the bundled reference implementations.
The Dart tests require the Dart SDK.
