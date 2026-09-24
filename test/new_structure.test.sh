#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp "$project/new-structure" "$work/new-structure"
mkdir -p "$work/templates"
cp -R "$project/templates/example" "$project/templates/starter" "$work/templates/"
cd "$work"
./new-structure > choices.txt
grep -q 'stack       array | nodes' choices.txt
grep -q 'queue       circular | nodes' choices.txt
./new-structure alice stack
cmp templates/starter/my_array_stack.dart structures/alice/my_array_stack.dart
./new-structure alice stack nodes
cmp templates/starter/my_linked_stack.dart structures/alice/my_linked_stack.dart
./new-structure bob stack nodes --example
cmp templates/example/my_linked_stack.dart structures/bob/my_linked_stack.dart
./new-structure carol queue nodes
cmp templates/starter/my_linked_queue.dart structures/carol/my_linked_queue.dart
./new-structure dave tree avl
cmp templates/starter/my_avl.dart structures/dave/my_avl.dart
if ./new-structure alice stack >/dev/null 2>&1; then echo 'Overwrote existing file!' >&2; exit 1; fi
if ./new-structure alice stack mystery >/dev/null 2>&1; then echo 'Accepted invalid variant!' >&2; exit 1; fi
if ./new-structure alice stack --starter >/dev/null 2>&1; then echo 'Accepted obsolete flag!' >&2; exit 1; fi
printf '%s\n' 'PASS: command lists choices; defaults to starter; node variant, example and no-overwrite work.'
