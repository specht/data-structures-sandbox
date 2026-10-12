import sandbox.HashBuckets;
import sandbox.ListNode;

// A fixed-capacity hash SET of integers; collisions form observable chains.
// Duplicate policy: not allowed; inserting an existing key returns false.
// This simple example deliberately does not resize: as the load factor rises,
// students can observe how longer collision chains affect lookup and removal.
class MyHashTable {
    HashBuckets buckets;
    int size = 0;

    // STUDENT CHOICES: edit the default bucket count and the hash function.
    // The browser creates new MyHashTable(), so the default controls its capacity.
    MyHashTable() {
        this(8);
    }

    MyHashTable(int bucketCount) {
        buckets = new HashBuckets(bucketCount, this::hash);
    }

    // Any deterministic mapping to 0 … capacity - 1 is permitted, including
    // for negative keys. Change this example formula and compare collisions.
    private int hash(int key, int capacity) {
        return Math.floorMod(key, capacity);
    }

    public boolean insert(int key) {
        int index = buckets.indexFor(key);
        ListNode current = buckets.get(index);
        while (current != null) {
            if (current.value == key) return false; // No duplicate keys.
            current = current.next;
        }
        ListNode fresh = new ListNode(key);
        fresh.next = buckets.get(index);
        buckets.set(index, fresh);
        size++;
        return true;
    }

    public boolean contains(int key) {
        int index = buckets.indexFor(key);
        ListNode current = buckets.get(index);
        while (current != null) {
            if (current.value == key) return true;
            current = current.next;
        }
        return false;
    }

    public boolean remove(int key) {
        int index = buckets.indexFor(key);
        ListNode previous = null;
        ListNode current = buckets.get(index);
        while (current != null) {
            if (current.value == key) {
                if (previous == null) {
                    buckets.set(index, current.next);
                } else {
                    previous.next = current.next;
                }
                size--;
                return true;
            }
            previous = current;
            current = current.next;
        }
        return false;
    }

    public boolean isEmpty() {
        return size == 0;
    }

    public double loadFactor() {
        return (double) size / buckets.length;
    }
}
