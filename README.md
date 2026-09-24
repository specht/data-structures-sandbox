# Data Structure Sandbox · v1.2 foundation

Dart executes student implementations. A persistent Dart HTTP/WebSocket host serves the
JavaScript/SVG visualization and supervises **separate Dart worker processes**.
The browser application is never rebuilt when students edit code.

## Try it

```bash
cd ~/data-structure-sandbox-browser-v1.2
./run
```

The browser should open on port 8081. If necessary use `./run --no-open` and
open the Workspace's port-forwarded URL. Use `./run --port 8082` when 8081 is occupied.
The first launch installs the `analyzer` package; later launches reuse it.

If `structures/` does not exist, `./run` creates a **separate local Git repository**
containing a working `example/` implementation for each of the three supported
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
│   └── my_array_stack.dart          # stack: MyArrayStack
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

The current visual adapters work for a sorted singly linked list, a regular
unbalanced binary search tree, and a **fixed-memory stack with eight cells**.
Dynamic method discovery works for synchronous public methods with supported
scalar parameters. `append(int value)` is picked up without editing the app.

**This is an infrastructure milestone, not the finished multi-structure course
platform.** Queues, linked stacks, AVL balancing, array/node heaps, hash tables,
Graph and custom object support need additional adapters and tests. See
`docs/architecture.md` and `docs/roadmap.md` before extending the registry.

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

Create a fresh student implementation without overwriting existing work:

```bash
./new-structure alice list
./new-structure alice stack
```

Only the three implemented adapters are offered by this helper so far.

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
