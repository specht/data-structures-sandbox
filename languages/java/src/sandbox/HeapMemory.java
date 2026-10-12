package sandbox;

import java.util.ArrayList;
import java.util.List;

/**
 * Contiguous, growing storage for an array heap: the children of index i live at 2*i+1 and
 * 2*i+2; there are no node objects.
 *
 * <pre>
 *   memory.size()            number of stored values
 *   memory.isEmpty()         true when nothing is stored
 *   memory.get(i)            read the value at index i
 *   memory.set(i, value)     replace an existing value
 *   memory.add(value)        append a value
 *   memory.removeLast()      remove and return the last value
 *   memory.swap(i, j)        exchange two values
 * </pre>
 */
public final class HeapMemory {
    final ArrayList<Integer> cells = new ArrayList<>();

    public int size() {
        return cells.size();
    }

    public boolean isEmpty() {
        return cells.isEmpty();
    }

    public int get(int index) {
        int value = cells.get(Cells.index(cells.size(), index, "the heap"));
        if (Trace.active instanceof Recorders.HeapRecorder recorder) recorder.read(index, value);
        return value;
    }

    public void set(int index, int value) {
        Cells.index(cells.size(), index, "the heap");
        int before = cells.get(index);
        cells.set(index, value);
        if (Trace.active instanceof Recorders.HeapRecorder recorder) {
            recorder.change("heapWrite", "index", index, "oldValue", before, "value", value);
        }
    }

    public void add(int value) {
        cells.add(value);
        if (Trace.active instanceof Recorders.HeapRecorder recorder) {
            recorder.change("heapAppend", "index", cells.size() - 1, "value", value);
        }
    }

    public int removeLast() {
        if (cells.isEmpty()) throw new IllegalStateException("removeLast() on an empty heap.");
        int index = cells.size() - 1;
        int value = cells.remove(index);
        if (Trace.active instanceof Recorders.HeapRecorder recorder) {
            recorder.change("heapRemove", "index", index, "value", value);
        }
        return value;
    }

    public void swap(int a, int b) {
        Cells.index(cells.size(), a, "the heap");
        Cells.index(cells.size(), b, "the heap");
        if (a == b) return;
        int oldA = cells.get(a);
        int oldB = cells.get(b);
        cells.set(a, oldB);
        cells.set(b, oldA);
        if (Trace.active instanceof Recorders.HeapRecorder recorder) {
            recorder.change("heapSwap", "a", a, "b", b, "oldA", oldA, "oldB", oldB);
        }
    }

    List<Integer> copy() {
        return new ArrayList<>(cells);
    }

    @Override
    public String toString() {
        return "HeapMemory(" + cells.size() + ")";
    }
}
