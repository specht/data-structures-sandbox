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
grep -q 'list        unsorted-array | unsorted-nodes | sorted-array | sorted-nodes' choices.txt
if grep -q -- '--example' choices.txt; then echo 'Student help advertises the reference solution!' >&2; exit 1; fi
./new-structure --help > help.txt
if grep -q -- '--example' help.txt; then echo '--help advertises the reference solution!' >&2; exit 1; fi
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
./new-structure eve list unsorted-array
cmp templates/starter/my_unsorted_array_list.dart structures/eve/my_unsorted_array_list.dart
./new-structure eve list unsorted-nodes
cmp templates/starter/my_unsorted_linked_list.dart structures/eve/my_unsorted_linked_list.dart
./new-structure eve list sorted-array
cmp templates/starter/my_sorted_array_list.dart structures/eve/my_sorted_array_list.dart
./new-structure eve list sorted-nodes
cmp templates/starter/my_sorted_linked_list.dart structures/eve/my_sorted_linked_list.dart
if ./new-structure frank list >/dev/null 2>&1; then echo 'Bare list must require an explicit variant!' >&2; exit 1; fi
if ./new-structure alice stack >/dev/null 2>&1; then echo 'Overwrote existing file!' >&2; exit 1; fi
if ./new-structure alice stack mystery >/dev/null 2>&1; then echo 'Accepted invalid variant!' >&2; exit 1; fi
if ./new-structure alice stack --starter >/dev/null 2>&1; then echo 'Accepted obsolete flag!' >&2; exit 1; fi
for starter in templates/starter/*.dart; do
  if ! head -n 1 "$starter" | grep -qx '/\*'; then echo "Missing starter introduction: $starter" >&2; exit 1; fi
  if ! grep -q 'REFERENCE:' "$starter"; then echo "Missing English starter API documentation: $starter" >&2; exit 1; fi
  if grep -Eq 'HILFE:|Aufgabe:|Prüfe selbst|Lies das Minimum' "$starter"; then echo "Non-English starter comment: $starter" >&2; exit 1; fi
  if ! tail -n 1 "$starter" | grep -qx '\*/'; then echo "Missing footer documentation: $starter" >&2; exit 1; fi
done
if grep -Eq 'bool isEmpty\(\)[[:space:]]*=>' templates/starter/*.dart; then
  echo 'A starter already implements isEmpty!' >&2; exit 1
fi
if grep -Eq 'bool isFull\(\)[[:space:]]*=>' templates/starter/*.dart; then
  echo 'A starter already implements isFull!' >&2; exit 1
fi
if grep -Eq 'int\? peek\(\)[[:space:]]*=>' templates/starter/*.dart; then
  echo 'A starter already implements peek!' >&2; exit 1
fi

printf '%s\n' 'PASS: command lists choices; defaults to starter; node variant, example and no-overwrite work.'
