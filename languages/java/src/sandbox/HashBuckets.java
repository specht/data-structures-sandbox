package sandbox;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.IntBinaryOperator;

/**
 * The buckets of a hash table with separate chaining. The student chooses the bucket count and
 * the hash function {@code (key, capacity) -> index}.
 *
 * <pre>
 *   buckets.length           number of buckets
 *   buckets.indexFor(key)    validated bucket index (uses the hash function)
 *   buckets.get(i)           first node of bucket i (or null)
 *   buckets.set(i, node)     replace the first node of bucket i
 * </pre>
 */
public final class HashBuckets {
    /** The number of buckets; it never changes. */
    public final int length;

    final ListNode[] cells;
    private final IntBinaryOperator hash;

    public HashBuckets(int capacity, IntBinaryOperator hash) {
        if (capacity < 1) throw new IllegalArgumentException("A hash table needs at least one bucket.");
        if (hash == null) throw new IllegalArgumentException("The second argument must be the hash function.");
        this.length = capacity;
        this.cells = new ListNode[capacity];
        this.hash = hash;
    }

    public ListNode get(int index) {
        ListNode value = cells[Cells.index(length, index, "the buckets")];
        if (Trace.active instanceof Recorders.HashRecorder recorder) recorder.bucketRead(index, value);
        return value;
    }

    public void set(int index, ListNode node) {
        Cells.index(length, index, "the buckets");
        ListNode before = cells[index];
        cells[index] = node;
        if (Trace.active instanceof Recorders.HashRecorder recorder) recorder.bucketWrite(index, before, node);
    }

    public int indexFor(int key) {
        int index = hash.applyAsInt(key, length);
        if (index < 0 || index >= length) {
            throw new IllegalStateException("hash(" + key + ") returned " + index + "; the student hash function "
                    + "must return a valid bucket index 0 … " + (length - 1) + ".");
        }
        return index;
    }

    List<ListNode> heads() {
        return new ArrayList<>(Arrays.asList(cells));
    }

    @Override
    public String toString() {
        return "HashBuckets(" + length + ")";
    }
}
