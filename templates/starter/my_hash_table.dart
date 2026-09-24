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
REFERENCE: HashBuckets, ListNode, and the hash-set contract

  MyHashTable([bucketCount]) selects the bucket count (default 8).
  buckets is HashBuckets(bucketCount, _hash), an observable storage adapter.
  buckets.length          Bucket count (int; at least 1).
  buckets.indexFor(key)    Calls _hash(key, capacity) and validates its index.
  buckets[index]           Read a bucket head (ListNode?; may be null).
  buckets[index] = node;   Set a bucket head (ListNode?; may be null).
  ListNode(value)          Create a node containing an int.
  node.value              Read or write its int value.
  node.next               Read a successor (ListNode?; may be null).
  node.next = other;      Set a successor (ListNode?; may be null).

  _hash returns a deterministic index from 0 to capacity - 1 for any
  int key, including negative keys. Collisions use linked bucket chains.
  size is the total number of stored keys (int; initially 0).
  This is a set: duplicate keys are not stored. Bucket count stays fixed.

  insert, contains, remove, and isEmpty return bool.
  loadFactor returns double: stored key count divided by bucket count.
*/
