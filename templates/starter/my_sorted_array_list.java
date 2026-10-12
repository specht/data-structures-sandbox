// Sorted ascending array list with capacity 8.
// Duplicate policy: allowed; every successful insert stores another occurrence.

import sandbox.ListMemory;

class MySortedArrayList {
    ListMemory memory = new ListMemory(8);
    int size = 0; // Number of occupied cells; maintained by student code.

    public boolean insert(int value) {
        // TODO: Insert value in ascending order; return false if full.
        return false;
    }

    public boolean contains(int value) {
        // TODO: Search for the value without changing the list.
        return false;
    }

    public boolean remove(int value) {
        // TODO: Remove one matching value and report whether it existed.
        return false;
    }

    public int length() {
        // TODO: Return the current number of stored values.
        return 0;
    }
}

// Quick reference · ListMemory
//   memory.length          Physical capacity (8)
//   memory.get(i)          Read a cell: an Integer or null
//   memory.set(i, value)   Write a value (null clears a cell)
//   size                   Student-maintained logical length
