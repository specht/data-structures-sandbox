import { HashBuckets, ListNode } from "sandbox";

// A fixed-capacity hash SET of integers; collisions form observable chains.
// Duplicate policy: not allowed; inserting an existing key returns false.
// This simple example deliberately does not resize: as the load factor rises,
// students can observe how longer collision chains affect lookup and removal.
export default class MyHashTable {
  // STUDENT CHOICES: edit the default bucket count and the hash function.
  // The browser creates new MyHashTable(), so the default controls its capacity.
  constructor(bucketCount = 8) {
    this.buckets = new HashBuckets(bucketCount, (key, capacity) => this._hash(key, capacity));
    this.size = 0;
  }

  // Any deterministic mapping to 0 … capacity - 1 is permitted, including
  // for negative keys. Change this example formula and compare collisions.
  _hash(key, capacity) {
    return ((key % capacity) + capacity) % capacity;
  }

  insert(key) {
    const index = this.buckets.indexFor(key);
    let current = this.buckets[index];
    while (current !== null) {
      if (current.value === key) return false; // No duplicate keys.
      current = current.next;
    }
    const fresh = new ListNode(key);
    fresh.next = this.buckets[index];
    this.buckets[index] = fresh;
    this.size++;
    return true;
  }

  contains(key) {
    const index = this.buckets.indexFor(key);
    let current = this.buckets[index];
    while (current !== null) {
      if (current.value === key) return true;
      current = current.next;
    }
    return false;
  }

  remove(key) {
    const index = this.buckets.indexFor(key);
    let previous = null;
    let current = this.buckets[index];
    while (current !== null) {
      if (current.value === key) {
        if (previous === null) {
          this.buckets[index] = current.next;
        } else {
          previous.next = current.next;
        }
        this.size--;
        return true;
      }
      previous = current;
      current = current.next;
    }
    return false;
  }

  isEmpty() {
    return this.size === 0;
  }

  loadFactor() {
    return this.size / this.buckets.length;
  }
}
