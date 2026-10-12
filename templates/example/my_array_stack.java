import sandbox.FixedMemory;

// Fixed-capacity stack: no ArrayList, no java.util.Stack.
// The fixed array indices stay stable; only values and top change.
// Duplicate policy: allowed; every successful push stores another occurrence.
class MyArrayStack {
    FixedMemory memory = new FixedMemory(8);
    // The stack owns its logical top; FixedMemory contains only its cells.
    int top = -1;

    public boolean push(int value) {
        if (top + 1 == memory.length) return false;
        top = top + 1;
        memory.set(top, value);
        return true;
    }

    public Integer pop() {
        if (top < 0) return null;
        Integer value = memory.get(top);
        memory.set(top, null);
        top = top - 1;
        return value;
    }

    public Integer peek() {
        if (top < 0) return null;
        return memory.get(top);
    }

    public boolean isEmpty() {
        return top == -1;
    }
}
