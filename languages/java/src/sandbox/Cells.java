package sandbox;

/** Index and value checks shared by the storage classes. */
final class Cells {
    private Cells() {}

    static int index(int length, int index, String what) {
        if (index < 0 || index >= length) {
            String valid = length == 0 ? "it is empty" : "valid: 0 … " + (length - 1);
            throw new IndexOutOfBoundsException("Index " + index + " is out of range for " + what + " (" + valid + ").");
        }
        return index;
    }

    static int capacity(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("The capacity must be a positive integer.");
        return capacity;
    }

    static java.util.List<Integer> copy(Integer[] cells) {
        return new java.util.ArrayList<>(java.util.Arrays.asList(cells));
    }
}
