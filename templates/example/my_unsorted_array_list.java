import sandbox.ListMemory;

// Unsorted, fixed-capacity array list. The list owns its logical size.
// Values are stored contiguously in cells 0 … size-1.
// Duplicate policy: allowed; every successful insert stores another occurrence.
class MyUnsortedArrayList {
    ListMemory memory = new ListMemory(8);
    int size = 0; // Number of occupied cells; maintained by student code.

    public boolean insert(int index, int value) {
        if (index < 0 || index > size || size == memory.length) return false;
        for (int i = size; i > index; i--) {
            memory.set(i, memory.get(i - 1));
        }
        memory.set(index, value);
        size = size + 1;
        return true;
    }

    public Integer get(int index) {
        if (index < 0 || index >= size) return null;
        return memory.get(index);
    }

    public Integer removeAt(int index) {
        if (index < 0 || index >= size) return null;
        Integer removed = memory.get(index);
        for (int i = index; i < size - 1; i++) {
            memory.set(i, memory.get(i + 1));
        }
        memory.set(size - 1, null);
        size = size - 1;
        return removed;
    }

    public boolean contains(int value) {
        for (int i = 0; i < size; i++) {
            if (memory.get(i) == value) return true;
        }
        return false;
    }

    public int length() {
        return size;
    }
}
