"""
Integer hash set with separate chaining.
Duplicate policy: not allowed; inserting an existing key returns False.
Choose a hash function and implement the public operations below.
"""

from sandbox import HashBuckets, ListNode


class MyHashTable:
    def __init__(self, bucket_count: int = 8):
        self.buckets = HashBuckets(bucket_count, self._hash)
        self.size = 0

    def _hash(self, key: int, capacity: int) -> int:
        # TODO: Return a deterministic bucket index in 0 … capacity - 1 for any int key.
        raise NotImplementedError("Implement the student hash function")

    def insert(self, key: int) -> bool:
        # TODO: Insert key if absent; return True if a key was added.
        return False

    def contains(self, key: int) -> bool:
        # TODO: Return True if key is present; otherwise return False.
        return False

    def remove(self, key: int) -> bool:
        # TODO: Remove key if present; return True if a key was removed.
        return False

    def is_empty(self) -> bool:
        # TODO: Return True exactly when the set contains no keys.
        return False

    def load_factor(self) -> float:
        # TODO: Return the number of stored keys divided by the number of buckets.
        return 0.0


# Quick reference · HashBuckets / ListNode
#   len(buckets)            Number of buckets
#   buckets.index_for(key)  Validated bucket index (uses _hash)
#   buckets[i]              Read or write a bucket's first node (or None)
#   ListNode(key)           Create a node; node.next is a ListNode or None
#   self.size               Number of stored keys
