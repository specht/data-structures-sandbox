# Data Structure Sandbox · current development guide

Dart executes student implementations in separate worker processes. A persistent
Dart HTTP/WebSocket host serves the JavaScript/SVG frontend and selects an
implementation from the **separate** `structures/` student Git repository.
The original student source is displayed and edited in the browser; generated
instrumented copies and compiled workers live under ignored `tool/generated*`.
At startup the host prunes old content-addressed workers, keeping the newest
**two completed revisions per student/structure**. Revisions written in the
last ten minutes are protected, as are incomplete builds from that interval.
The cleanup removes each retired `.dill` together with its generated `.dart`
and instrumented metadata. It runs **only at startup**, not while students'
workers are running. To prune without launching the web app, stop `./run` and
run `dart run tool/cache_cleanup.dart`. Removing a cache never alters student
sources: if an older revision is selected again, it will simply be recompiled.
A fresh `./run` does **not** create `structures/` or a demo student. Create the
student repository separately. No student file is replaced by a template.

## Start and create implementations

Clone the class repository to `structures/` first (see [student setup](README.md)).
The app deliberately does not create this separate Git repository. From the
outer app repository, start the server and use another terminal for the CLI:

```sh
./run
# In the second terminal, still in the outer application repository:
./new-structure alice list unsorted-array
./new-structure alice list unsorted-nodes
./new-structure alice list sorted-array
./new-structure alice list sorted-nodes
# For a complete reference copy of an individual list implementation:
./new-structure example list unsorted-array --example
```

A student may keep several implementations of one structure, e.g. a recursive
and an iterative BST: `./new-structure alice tree bst --variant recursive`
creates `my_bst_recursive.dart` next to `my_bst.dart`. A variant keeps the
starter's class name; the Structure picker lists it separately and it has its
own worker, editor state and test results. Class progress shows the best of a
student's implementations per structure.

`./new-structure` without arguments lists all supported exercise choices.
`list` requires an explicit variant. All four list files and class names
follow the same naming scheme. See [list exercises](docs/list-exercises.md),
[contracts](docs/contracts.md) and [storage APIs](docs/storage-api.md).

## Browser and worker architecture

- `tool/registry.dart`: explicitly recognized exercises, class names and
  filenames. A filename alone does not make a new adapter runnable.
- `tool/instrument.dart`: Dart AST-based method discovery/instrumentation of a
  *copy* of student code. Supports public synchronous methods with supported
  scalar arguments; does not promise general debugger coverage of arbitrary
  Dart syntax, closures or user-defined data models.
- `lib/*_sandbox.dart`: observable storage APIs. Students maintain invariants;
  they do not write drawing or recorder calls.
- `lib/worker/session.dart`: the structure-independent worker (request
  parsing, tracing, verification, runtime errors, stdin/stdout protocol).
- `lib/structures/*.dart`: one adapter per structure (`lib/worker/adapter.dart`
  describes the hooks): its recorder, independent reference model, expected
  returns and structural checks.
- `tool/specialize_worker.dart`: generates the few lines of worker entry point
  that connect a student's instrumented class to its adapter. Adding a
  structure means a registry entry, an adapter and one line in
  `workerAdapters`. Source versions are cached by content fingerprint.
- `web/js/*.js` render indexed cells, linked nodes, trees, heaps and hash
  chains. They are plain scripts without a build step, loaded in the order
  listed in `web/index.html` (`main.js` last starts the connection); each
  file starts with a one-line summary. `test/helpers/browser.js` loads them
  the same way for the Node.js tests. Source editing uses bundled CodeMirror
  in `web/js/editor.js`, with
  Ctrl+S, Ctrl+Shift+K and Revert Unsaved Edits. Saving changes the file in
  `structures/STUDENT/` and refreshes the worker and its initially empty state.
  The UI does not create or commit files in the Git repository by itself.

## Verification

Run these from the outer application repository with the Dart SDK and Node.js
available. The integration test creates a **temporary** student repository;
it does not require `structures/example`:

```sh
bash test/new_structure.test.sh
bash test/first_run.test.sh
dart test/list_model.dart
dart test/stack_model.dart
dart test/heap_model.dart
dart test/node_heap_model.dart
dart test/hash_model.dart
dart test/avl_model.dart
dart test/student_validation.test.dart
dart test/implementation_variants.test.dart
dart test/specialized_worker_test.dart
dart test/validation_integration.dart
for t in test/*.test.js; do node "$t"; done   # includes runtime_hints.test.js
```

`dart test/smoke.dart` is an **optional** end-to-end check. It runs every kind
listed by the registry and requires `structures/example/` to contain a
complete reference file for **every** registered structure, not merely the
four lists or the structure being studied. Create any missing examples with
`./new-structure example TYPE [IMPLEMENTATION] --example` before running it.
Use `./run` separately for a manual browser check.

A pass establishes behavior in tested scenarios, not a proof for all inputs.
Interactive and separate validation runners should both check final physical
invariants: occupied memory prefix/student-owned size, sorted-array order,
acyclic linked chains whose reachable count equals student-owned size, the
BST/AVL invariants, complete heap shape, hash placement and
other structure-specific requirements.

## Operational limitations

Each browser connection has its own worker instance. Source changes reset that
instance's in-memory structure; they do not overwrite the edited student file.
After 10 minutes without a call, the host stops the worker of that tab to save
memory. The next call (or test run) starts it again and replays the successful
calls since the last reset, so students keep their structure's contents. If
the replay fails or there were more than 200 calls, the structure starts empty
as after a normal restart.
A hung student method is bounded by the worker deadline and event/response caps.
The host process remains available if a worker fails. The worker process and
its deadline are **not** OS-level isolation; run untrusted code on a shared
host only with separate filesystem, network and resource restrictions.

Some structures may exceed the comfortable size of an on-screen diagram. The
browser supports Fit/zoom/pan, but the 20-call cap per run remains independent of
the number of nodes and the worker's execution/trace limits. Source-level
instrumentation covers an intentional Dart subset, not the complete language.

See [architecture](docs/architecture.md) and the [curriculum/development
roadmap](docs/roadmap.md) for constraints and future work.

## Light theme

`web/light.css` is generated from `web/style.css`: every rule that sets a color
is repeated under `:root[data-theme="light"]` with the color mirrored in
lightness. After changing colors in `style.css`, run

```bash
node tool/light-theme.mjs web/style.css web/light.css
```

The choice of theme is stored in `.settings.yaml` (ignored by Git, see
`tool/settings.dart`) and written into `index.html` by the host. The same
script and mechanism are used by the CPU and the Sorting Sandbox.
