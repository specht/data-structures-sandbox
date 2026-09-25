/*
Integer hash set with separate chaining.
Choose a hash function and implement the public operations below.
*/

import '../../lib/hash_sandbox.dart';
import '../../lib/sandbox.dart';

class MyHashTable {
  late final HashBuckets buckets;
  int size = 0;

  MyHashTable([int bucketCount = 8]) {
    buckets = HashBuckets(bucketCount, _hash);
  }

  int _hash(int key, int capacity) {
    // TODO: Return a deterministic bucket index in 0..capacity - 1 for any int key.
    throw UnimplementedError('Implement the student hash function');
  }

  bool insert(int key) {
    // TODO: Insert key if absent; return true if a key was added.
    return false;
  }

  bool contains(int key) {
    // TODO: Return true if key is present; otherwise return false.
    return false;
  }

  bool remove(int key) {
    // TODO: Remove key if present; return true if a key was removed.
    return false;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the set contains no keys.
    return false;
  }

  double loadFactor() {
    // TODO: Return the number of stored keys divided by the number of buckets.
    return 0.0;
  }
}

/*
Quick reference · HashBuckets / ListNode
  buckets.length         Number of buckets
  buckets.indexFor(key)  Validated bucket index
  buckets[i]             Read/write a ListNode? bucket head
  ListNode(key)          Create a node; .next is ListNode?
  size                   Number of stored keys
  _hash(key, capacity)   Return an index in 0..capacity - 1
  Details: docs/hash-table.md
*/
