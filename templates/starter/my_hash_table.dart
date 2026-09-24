import '../../lib/hash_sandbox.dart';
import '../../lib/sandbox.dart';

// Hash table (separate chaining): integer SET, no duplicate keys, fixed
// bucket count. Students choose both the bucket count and _hash algorithm.
class MyHashTable {
  late final HashBuckets buckets;
  int size = 0;

  MyHashTable([int bucketCount = 8]) {
    buckets = HashBuckets(bucketCount, _hash);
  }

  int _hash(int key, int capacity) {
    // TODO: Return a deterministic index in 0 .. capacity - 1.
    throw UnimplementedError('Implement the student hash function');
  }

  bool insert(int key) {
    // TODO: Search the chosen bucket; insert only if the key is absent.
    return false;
  }

  bool contains(int key) {
    // TODO: Search only the chosen bucket.
    return false;
  }

  bool remove(int key) {
    // TODO: Unlink the key if present, update size, return whether removed.
    return false;
  }

  bool isEmpty() => size == 0;
  double loadFactor() => size / buckets.length;
}
