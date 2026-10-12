import sandbox.ListMemory;

// Fixed-capacity array list in nondecreasing order.
// Duplicate policy: allowed; every successful insert stores another occurrence.
class MySortedArrayList {
    ListMemory memory = new ListMemory(8);
    int size = 0; // Number of occupied cells; maintained by student code.

    public boolean insert(int value) {
        if (size == memory.length) return false;
        int index = 0;
        while (index < size && memory.get(index) <= value) {
            index++;
        }
        for (int i = size; i > index; i--) {
            memory.set(i, memory.get(i - 1));
        }
        memory.set(index, value);
        size = size + 1;
        return true;
    }

    public boolean contains(int value) {
        for (int i = 0; i < size; i++) {
            if (memory.get(i) == value) return true;
            if (memory.get(i) > value) return false;
        }
        return false;
    }

    public boolean remove(int value) {
        int index = 0;
        while (index < size && memory.get(index) < value) {
            index++;
        }
        if (index == size || memory.get(index) != value) return false;
        for (int i = index; i < size - 1; i++) {
            memory.set(i, memory.get(i + 1));
        }
        memory.set(size - 1, null);
        size = size - 1;
        return true;
    }

    public int length() {
        return size;
    }
}
