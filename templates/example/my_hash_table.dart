import '../../lib/hash_sandbox.dart';
import '../../lib/sandbox.dart';

// A fixed-capacity hash SET of integers; collisions form observable chains.
// This simple example deliberately does not resize: as the load factor rises,
// students can observe how longer collision chains affect lookup and removal.
class MyHashTable {
  final HashBuckets buckets = HashBuckets(8);
  int size = 0;

  bool insert(int key) {
    final index = buckets.indexFor(key);
    ListNode? current = buckets[index];
    while (current != null) {
      if (current.value == key) return false; // No duplicate keys.
      current = current.next;
    }
    final fresh = ListNode(key);
    fresh.next = buckets[index];
    buckets[index] = fresh;
    size++;
    return true;
  }

  bool contains(int key) {
    final index = buckets.indexFor(key);
    ListNode? current = buckets[index];
    while (current != null) {
      if (current.value == key) return true;
      current = current.next;
    }
    return false;
  }

  bool remove(int key) {
    final index = buckets.indexFor(key);
    ListNode? previous;
    ListNode? current = buckets[index];
    while (current != null) {
      if (current.value == key) {
        if (previous == null) {
          buckets[index] = current.next;
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

  bool isEmpty() { return size == 0; }
  double loadFactor() { return size / buckets.length; }
}
