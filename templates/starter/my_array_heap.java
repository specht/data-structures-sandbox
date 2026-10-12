// Array-based min-heap of integers.
// Duplicate policy: allowed; every insert stores another occurrence.
// Implement the public operations below.

import sandbox.HeapMemory;

class MyArrayHeap {
    HeapMemory memory = new HeapMemory();

    public void insert(int value) {
        // TODO: Insert value while preserving the min-heap property.
    }

    public Integer removeMin() {
        // TODO: Remove and return the minimum value, or null if the heap is empty.
        return null;
    }

    public Integer peek() {
        // TODO: Return the minimum value without removing it, or null if empty.
        return null;
    }

    public boolean isEmpty() {
        // TODO: Return true exactly when the heap contains no elements.
        return false;
    }
}

// Quick reference · HeapMemory
//   memory.size()          Number of stored values
//   memory.isEmpty()       True when nothing is stored
//   memory.get(i)          Read the int at index i
//   memory.set(i, value)   Replace an existing value
//   memory.add(value)      Append a value
//   memory.removeLast()    Remove and return the last value
//   memory.swap(i, j)      Exchange two indexed values
