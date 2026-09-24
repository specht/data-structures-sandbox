# Hash table · separate chaining

The example is a fixed-size hash **set** of integers, with eight physical
buckets. `indexFor(key)` calculates `key % 8`, including negative keys.
Each bucket stores a nullable `ListNode` reference; collisions form chains.

Create an implementation in the **separate** student repository:

```sh
./new-structure example hash
```

Try `insert(7)`, `insert(15)`, `insert(23)`, `contains(15)`,
`remove(15)`, `contains(15)`, `insert(-1)`, `loadFactor()`.
All four keys hash to bucket 7. Observe the bucket reference change on
head insertion/deletion and the `next` pointer change on interior deletion.
Each public operation is checked against a set reference model and a separate
physical audit (cycle/shared node, wrong bucket, duplicates, stored size).
The load factor is `size / capacity`, not the fraction of nonempty buckets.

This example does not resize automatically: growing the set illustrates how
collision chains lengthen even when the bucket count stays fixed. The display
zooms out at method boundaries if the longest chain becomes too tall.

Validate locally before students use it:

```sh
dart test/hash_model.dart
dart test/smoke.dart
for t in test/*.test.js; do node "$t"; done
```
