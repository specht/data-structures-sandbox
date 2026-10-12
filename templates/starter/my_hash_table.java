// Integer hash set with separate chaining.
// Duplicate policy: not allowed; inserting an existing key returns false.
// Choose a hash function and implement the public operations below.

import sandbox.HashBuckets;
import sandbox.ListNode;

class MyHashTable {
    HashBuckets buckets;
    int size = 0;

    MyHashTable() {
        this(8);
    }

    MyHashTable(int bucketCount) {
        buckets = new HashBuckets(bucketCount, this::hash);
    }

    private int hash(int key, int capacity) {
        // TODO: Return a deterministic bucket index in 0 … capacity - 1 for any int key.
        throw new UnsupportedOperationException("Implement the student hash function");
    }

    public boolean insert(int key) {
        // TODO: Insert key if absent; return true if a key was added.
        return false;
    }

    public boolean contains(int key) {
        // TODO: Return true if key is present; otherwise return false.
        return false;
    }

    public boolean remove(int key) {
        // TODO: Remove key if present; return true if a key was removed.
        return false;
    }

    public boolean isEmpty() {
        // TODO: Return true exactly when the set contains no keys.
        return false;
    }

    public double loadFactor() {
        // TODO: Return the number of stored keys divided by the number of buckets.
        return 0.0;
    }
}

// Quick reference · HashBuckets / ListNode
//   buckets.length          Number of buckets
//   buckets.indexFor(key)   Validated bucket index (uses hash)
//   buckets.get(i)          First node of bucket i (or null)
//   buckets.set(i, node)    Replace the first node of bucket i
//   new ListNode(key)       Create a node; node.next is a ListNode or null
//   size                    Number of stored keys
