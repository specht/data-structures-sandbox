import sandbox.HeapMemory;

// Min-heap: the smallest key is at index 0. This is a DYNAMIC array, not
// linked nodes. Indices describe one contiguous, complete binary tree.
// Duplicate policy: allowed; every insert stores another occurrence.
class MyArrayHeap {
    HeapMemory memory = new HeapMemory();

    public void insert(int value) {
        memory.add(value);
        int i = memory.size() - 1;
        while (i > 0) {
            int parent = (i - 1) / 2;
            if (memory.get(parent) <= memory.get(i)) break;
            memory.swap(parent, i);
            i = parent;
        }
    }

    public Integer peek() {
        if (memory.isEmpty()) return null;
        return memory.get(0);
    }

    public Integer removeMin() {
        if (memory.isEmpty()) return null;
        int minimum = memory.get(0);
        int last = memory.removeLast();
        if (memory.isEmpty()) return minimum;
        memory.set(0, last);
        int i = 0;
        while (true) {
            int left = 2 * i + 1;
            if (left >= memory.size()) break;
            int right = left + 1;
            int smaller = left;
            if (right < memory.size() && memory.get(right) < memory.get(left)) smaller = right;
            if (memory.get(i) <= memory.get(smaller)) break;
            memory.swap(i, smaller);
            i = smaller;
        }
        return minimum;
    }

    public boolean isEmpty() {
        return memory.isEmpty();
    }
}
