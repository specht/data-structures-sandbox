# Hash table · separate chaining

The example is a hash **set** of integers with separate chaining. **Both**
the number of buckets and the hash function are student choices, defined in
`my_hash_table.dart`. The example defaults to eight buckets and uses `key %
capacity`, but neither choice is imposed by the sandbox. In the example, edit
`MyHashTable([int bucketCount = 8])` to change the capacity used in the browser,
and edit `_hash(key, capacity)` to choose how keys map to buckets. For direct
Dart experiments you can also instantiate `MyHashTable(3)` or
`MyHashTable(11)` without changing the default. The sandbox passes the actual
capacity to the student hash function and rejects out-of-range indices.
Each bucket stores a nullable `ListNode` reference; collisions form chains.

Create an implementation in the **separate** student repository:

```sh
./new-structure example hash
```

Try `insert(7)`, `insert(15)`, `insert(23)`, `contains(15)`,
`remove(15)`, `contains(15)`, `insert(-1)`, `loadFactor()`.
With the **example** capacity and hash function, all four keys hash to
bucket 7. Try a capacity of 3 or 11 and repeat the sequence; bucket placements
and load factor will differ. Observe the bucket reference change on
head insertion/deletion and the `next` pointer change on interior deletion.
Each public operation is checked against a set reference model and a separate
physical audit (cycle/shared node, placement according to the student's hash
function, duplicates, stored size). The load factor is `size / capacity`,
not the fraction of nonempty buckets. A valid alternative hash formula or
capacity must not be marked incorrect just because it differs from the example.

The bucket count is fixed **for one instance** in this introductory example;
there is no automatic resizing. Choosing a different count before construction
is supported. The display frames the actual number of buckets as well as the
longest collision chain; use zoom/pan to inspect large tables.

Validate locally before students use it:

```sh
dart test/hash_model.dart
dart test/smoke.dart
for t in test/*.test.js; do node "$t"; done
```
