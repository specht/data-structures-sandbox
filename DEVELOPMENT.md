# Data Structure Sandbox · current development guide

Dart executes student implementations in separate worker processes. A persistent
Dart HTTP/WebSocket host serves the JavaScript/SVG frontend and selects an
implementation from the **separate** `structures/` student Git repository.
The original student source is displayed and edited in the browser; generated
instrumented copies and compiled workers live under ignored `tool/generated*`.
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
- `tool/worker_template.txt` and `tool/specialize_worker.dart`: create a
  per-kind runner with an independent reference model, structural checks and
  immutable snapshots. Source versions are cached by content fingerprint.
- `web/app.js` renders indexed cells, linked nodes, trees, heaps and hash
  chains. Source editing uses bundled CodeMirror in `web/editor.js`, with
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
dart test/specialized_worker_test.dart
dart test/validation_integration.dart
for t in test/*.test.js; do node "$t"; done
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
A hung student method is bounded by the worker deadline and event/response caps.
The host process remains available if a worker fails. The worker process and
its deadline are **not** OS-level isolation; run untrusted code on a shared
host only with separate filesystem, network and resource restrictions.

Some structures may exceed the comfortable size of an on-screen diagram. The
browser supports Fit/zoom/pan, but the 12-call batch cap remains independent of
the number of nodes and the worker's execution/trace limits. Source-level
instrumentation covers an intentional Dart subset, not the complete language.

See [architecture](docs/architecture.md) and the [curriculum/development
roadmap](docs/roadmap.md) for constraints and future work.
