#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp "$project/run" "$project/new-structure" "$work/"
mkdir -p "$work/templates/starter"
cp "$project/templates/starter/my_array_stack.dart" "$work/templates/starter/"
cd "$work"
if [[ -e structures ]]; then echo 'The test fixture is not empty!' >&2;exit 1;fi
# A stand-in for Dart tests startup filesystem behavior, without a Dart SDK.
mkdir -p bin
cat > bin/dart <<'DART'
#!/bin/sh
case "$1" in
  run) exit 0;;
  pub) exit 0;;
esac
exit 1
DART
chmod +x bin/dart
PATH="$work/bin:$PATH" ./run --no-open
if [[ -e structures ]]; then echo './run created a repository or example files!' >&2;exit 1;fi
./new-structure alice stack array
cmp templates/starter/my_array_stack.dart structures/alice/my_array_stack.dart
if [[ -e structures/example ]]; then echo 'Starter creation made an example user!' >&2;exit 1;fi
printf '%s\n' 'PASS: first run is empty; creating an array stack adds only its starter.'
