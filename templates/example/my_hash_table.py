from sandbox import HashBuckets, ListNode


# A fixed-capacity hash SET of integers; collisions form observable chains.
# Duplicate policy: not allowed; inserting an existing key returns False.
# This simple example deliberately does not resize: as the load factor rises,
# students can observe how longer collision chains affect lookup and removal.
class MyHashTable:
    # STUDENT CHOICES: edit the default bucket count and the hash function.
    # The browser creates MyHashTable(), so the default controls its capacity.
    def __init__(self, bucket_count: int = 8):
        self.buckets = HashBuckets(bucket_count, self._hash)
        self.size = 0

    # Any deterministic mapping to 0 … capacity - 1 is permitted, including
    # for negative keys. Change this example formula and compare collisions.
    def _hash(self, key: int, capacity: int) -> int:
        return key % capacity

    def insert(self, key: int) -> bool:
        index = self.buckets.index_for(key)
        current: ListNode | None = self.buckets[index]
        while current is not None:
            if current.value == key:
                return False  # No duplicate keys.
            current = current.next
        fresh = ListNode(key)
        fresh.next = self.buckets[index]
        self.buckets[index] = fresh
        self.size += 1
        return True

    def contains(self, key: int) -> bool:
        index = self.buckets.index_for(key)
        current: ListNode | None = self.buckets[index]
        while current is not None:
            if current.value == key:
                return True
            current = current.next
        return False

    def remove(self, key: int) -> bool:
        index = self.buckets.index_for(key)
        previous: ListNode | None = None
        current: ListNode | None = self.buckets[index]
        while current is not None:
            if current.value == key:
                if previous is None:
                    self.buckets[index] = current.next
                else:
                    previous.next = current.next
                self.size -= 1
                return True
            previous = current
            current = current.next
        return False

    def is_empty(self) -> bool:
        return self.size == 0

    def load_factor(self) -> float:
        return self.size / len(self.buckets)
