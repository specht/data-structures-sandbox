// Integer hash set with separate chaining.
// Duplicate policy: not allowed; inserting an existing key returns false.
// Choose a hash function and implement the public operations below.

import { HashBuckets, ListNode } from "sandbox";

export default class MyHashTable {
  constructor(bucketCount = 8) {
    this.buckets = new HashBuckets(bucketCount, (key, capacity) => this._hash(key, capacity));
    this.size = 0;
  }

  _hash(key, capacity) {
    // TODO: Return a deterministic bucket index in 0 … capacity - 1 for any integer key.
    throw new Error("Implement the student hash function");
  }

  insert(key) {
    // TODO: Insert key if absent; return true if a key was added.
    return false;
  }

  contains(key) {
    // TODO: Return true if key is present; otherwise return false.
    return false;
  }

  remove(key) {
    // TODO: Remove key if present; return true if a key was removed.
    return false;
  }

  isEmpty() {
    // TODO: Return true exactly when the set contains no keys.
    return false;
  }

  loadFactor() {
    // TODO: Return the number of stored keys divided by the number of buckets.
    return 0.0;
  }
}

// Quick reference · HashBuckets / ListNode
//   buckets.length          Number of buckets
//   buckets.indexFor(key)   Validated bucket index (uses _hash)
//   buckets[i]              Read or write a bucket's first node (or null)
//   new ListNode(key)       Create a node; node.next is a ListNode or null
//   this.size               Number of stored keys
