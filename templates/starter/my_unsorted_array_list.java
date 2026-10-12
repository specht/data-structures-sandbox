// Unsorted array list with index-based insert/get/remove operations.
// Duplicate policy: allowed; every successful insert stores another occurrence.

import sandbox.ListMemory;

class MyUnsortedArrayList {
    ListMemory memory = new ListMemory(8);
    int size = 0; // Number of occupied cells; maintained by student code.

    public boolean insert(int index, int value) {
        // TODO: Insert value at index; return false if invalid or full.
        return false;
    }

    public Integer get(int index) {
        // TODO: Return the indexed value, or null if the index is invalid.
        return null;
    }

    public Integer removeAt(int index) {
        // TODO: Remove and return the value at index, or null if invalid.
        return null;
    }

    public boolean contains(int value) {
        // TODO: Return whether value is in the list.
        return false;
    }

    public int length() {
        // TODO: Return the student-maintained size, NOT memory.length.
        return 0;
    }
}

// Quick reference · ListMemory
//   memory.length          Physical capacity (8)
//   memory.get(i)          Read a cell: an Integer or null
//   memory.set(i, value)   Write a value (null clears a cell)
//   size                   Student-maintained logical length
