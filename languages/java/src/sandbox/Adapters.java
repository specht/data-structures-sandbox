package sandbox;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * One adapter per structure, ported from lib/structures/*.dart (and kept line by line in step
 * with languages/python/sandbox_worker.py and languages/javascript/sandbox_worker.mjs): the
 * reference model, the structural checks and what the recorders observe.
 */
final class Adapters {
    private Adapters() {}

    static final int INVALID_MARKER = 10000000;

    interface Check {
        void check(String aspect, Object expected, Object actual);
    }

    /** Dart's == for the JSON values that methods return: true is not 1. */
    static boolean same(Object a, Object b) {
        if (a == null || b == null) return a == b;
        if (a instanceof Boolean || b instanceof Boolean) return a.equals(b);
        if (a instanceof Number x && b instanceof Number y) return x.doubleValue() == y.doubleValue();
        return a.equals(b);
    }

    static boolean isInt(Object value) {
        return value instanceof Integer || value instanceof Long || value instanceof Short || value instanceof Byte;
    }

    static Integer asInt(Object value) {
        return isInt(value) ? ((Number) value).intValue() : null;
    }

    static Integer singleInt(List<Object> args) {
        return args.size() == 1 ? asInt(args.get(0)) : null;
    }

    static Integer last(List<Integer> values) {
        return values.isEmpty() ? null : values.get(values.size() - 1);
    }

    static Integer first(List<Integer> values) {
        return values.isEmpty() ? null : values.get(0);
    }

    static Integer removeFirst(List<Integer> values) {
        return values.isEmpty() ? null : values.remove(0);
    }

    static Integer minimum(List<Integer> values) {
        return values.isEmpty() ? null : Collections.min(values);
    }

    static boolean removeValue(List<Integer> values, int value) {
        return values.remove(Integer.valueOf(value));
    }

    static List<Integer> chainValues(Object head) {
        List<Integer> values = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        ListNode node = head instanceof ListNode start ? start : null;
        while (node != null && seen.add(node.id)) {
            values.add(node.value);
            node = node.next;
        }
        if (node != null) values.add(INVALID_MARKER);
        return values;
    }

    abstract static class Adapter {
        final Supplier<Object> create;
        List<Integer> reference = new ArrayList<>();
        Object instance;
        String kind = "";
        Set<String> indexFields = Set.of();
        Set<String> pointerFields = Set.of();
        Set<String> standardMethods = Set.of();
        boolean unorderedContents = false;
        boolean insertReturnsVoid = false;
        boolean insertTakesIndex = false;
        boolean capacityCells = false;

        Adapter(Supplier<Object> create) {
            this.create = create;
        }

        Object field(String name) {
            return Trace.read(instance, name);
        }

        Integer intField(String name) {
            return asInt(field(name));
        }

        void resetIds() {}

        void reset() {
            reference = new ArrayList<>();
            resetIds();
            Trace.active = null;
            Trace.owner = null;
            instance = create.get();
            Trace.owner = instance;
            Trace.indexFields = indexFields;
            Trace.pointerFields = pointerFields;
        }

        abstract Recorders.Base createRecorder();

        Integer capacity() {
            return null;
        }

        abstract List<Integer> actualValues();

        abstract boolean updateReference(String name, List<Object> args, Object returned);

        List<String> executionProblems() {
            return List.of();
        }

        void structuralChecks(Check check) {}

        boolean returnMatches(String name, Object expected, Object returned) {
            return same(expected, returned);
        }

        String requiredMethodSignature(String name) {
            String returns;
            if (name.equals("insert") && insertReturnsVoid) {
                returns = "void";
            } else if (List.of("insert", "push", "enqueue", "contains", "remove", "isEmpty", "isFull").contains(name)) {
                returns = "bool";
            } else if (List.of("get", "removeAt", "pop", "peek", "dequeue", "removeMin").contains(name)) {
                returns = "int?";
            } else if (name.equals("length")) {
                returns = "int";
            } else if (name.equals("loadFactor")) {
                returns = "double";
            } else {
                throw new IllegalStateException("No required signature for " + kind + "." + name);
            }
            String arguments;
            if (name.equals("insert") && insertTakesIndex) {
                arguments = "int, int";
            } else if (List.of("pop", "peek", "dequeue", "removeMin", "isEmpty", "isFull", "length", "loadFactor")
                    .contains(name)) {
                arguments = "";
            } else {
                arguments = "int";
            }
            return returns + " " + name + "(" + arguments + ")";
        }

        Object expectedReturn(String name, List<Object> args) {
            Integer value = args.isEmpty() ? null : asInt(args.get(args.size() - 1));
            Integer index = insertTakesIndex && !args.isEmpty() ? asInt(args.get(0)) : null;
            switch (name) {
                case "get", "removeAt" -> {
                    return index != null && index >= 0 && index < reference.size() ? reference.get(index) : null;
                }
                case "pop" -> {
                    return last(reference);
                }
                case "peek", "dequeue" -> {
                    return first(reference);
                }
                case "removeMin" -> {
                    return minimum(reference);
                }
                case "remove", "contains" -> {
                    return value != null && reference.contains(value);
                }
                case "length" -> {
                    return reference.size();
                }
                case "isEmpty" -> {
                    return reference.isEmpty();
                }
                case "isFull" -> {
                    return reference.size() == 8;
                }
                default -> throw new IllegalStateException("No reference contract for " + kind + "." + name);
            }
        }
    }

    // --------------------------------------------------------------------- stacks

    static final class ArrayStack extends Adapter {
        ArrayStack(Supplier<Object> create) {
            super(create);
            kind = "stack";
            indexFields = Set.of("top");
            standardMethods = Set.of("push", "pop", "peek", "isEmpty");
            capacityCells = true;
        }

        FixedMemory memory() {
            return (FixedMemory) field("memory");
        }

        @Override
        Integer capacity() {
            return memory().length;
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.StackRecorder recorder = new Recorders.StackRecorder();
            recorder.memory = this::memory;
            recorder.top = () -> field("top");
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (name.equals("push") || name.equals("insert")) return reference.size() < 8;
            if (name.equals("peek")) return last(reference);
            return super.expectedReturn(name, args);
        }

        @Override
        List<Integer> actualValues() {
            FixedMemory memory = memory();
            Integer top = intField("top");
            List<Integer> values = new ArrayList<>();
            for (int i = 0; top != null && i <= top && i < memory.length; i++) {
                Integer v = memory.cells[i];
                if (v != null) values.add(v);
            }
            return values;
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            List<Integer> stack = reference;
            if (name.equals("push") && value != null) {
                boolean expected = stack.size() < 8;
                if (expected) stack.add(value);
                return same(returned, expected);
            }
            if (name.equals("pop")) return same(returned, stack.isEmpty() ? null : stack.remove(stack.size() - 1));
            if (name.equals("peek")) return same(returned, last(stack));
            if (name.equals("isEmpty")) return same(returned, stack.isEmpty());
            reference = actualValues();
            return true;
        }

        boolean storageValid() {
            FixedMemory memory = memory();
            Integer top = intField("top");
            if (top == null || top < -1 || top >= memory.length) return false;
            for (int i = 0; i < memory.length; i++) if ((i <= top) != (memory.cells[i] != null)) return false;
            return true;
        }

        @Override
        List<String> executionProblems() {
            return storageValid() ? List.of() : List.of("stack cells or top index");
        }

        @Override
        void structuralChecks(Check check) {
            check.check("Fixed capacity", 8, memory().length);
            check.check("Top index", reference.size() - 1, field("top"));
            check.check("Stack storage", true, storageValid());
        }
    }

    static final class LinkedStack extends Adapter {
        LinkedStack(Supplier<Object> create) {
            super(create);
            kind = "linked_stack";
            pointerFields = Set.of("head");
            standardMethods = Set.of("push", "pop", "peek", "isEmpty");
        }

        @Override
        void resetIds() {
            ListNode.resetIds();
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.Recorder recorder = new Recorders.Recorder();
            recorder.root = () -> field("head");
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (name.equals("push") || name.equals("insert")) return true;
            if (name.equals("pop")) return first(reference);
            return super.expectedReturn(name, args);
        }

        @Override
        List<Integer> actualValues() {
            return chainValues(field("head"));
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            if (name.equals("push") && value != null) {
                reference.add(0, value);
                return same(returned, true);
            }
            if (name.equals("pop")) return same(returned, removeFirst(reference));
            if (name.equals("peek")) return same(returned, first(reference));
            if (name.equals("isEmpty")) return same(returned, reference.isEmpty());
            reference = actualValues();
            return true;
        }

        @Override
        void structuralChecks(Check check) {
            Set<Integer> seen = new HashSet<>();
            Object head = field("head");
            ListNode node = head instanceof ListNode start ? start : null;
            while (node != null && seen.add(node.id)) node = node.next;
            check.check("Acyclic stack chain", true, node == null);
        }
    }

    // --------------------------------------------------------------------- queues

    static final class ArrayQueue extends Adapter {
        ArrayQueue(Supplier<Object> create) {
            super(create);
            kind = "array_queue";
            standardMethods = Set.of("enqueue", "dequeue", "peek", "isEmpty", "isFull");
            capacityCells = true;
        }

        QueueMemory memory() {
            return (QueueMemory) field("memory");
        }

        @Override
        Integer capacity() {
            return memory().length;
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.QueueRecorder recorder = new Recorders.QueueRecorder();
            recorder.memory = this::memory;
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (name.equals("enqueue") || name.equals("insert")) return reference.size() < 8;
            return super.expectedReturn(name, args);
        }

        @Override
        List<Integer> actualValues() {
            QueueMemory memory = memory();
            int n = memory.length, front = memory.front, size = memory.size;
            if (n <= 0 || front < 0 || front >= n || size < 0 || size > n) return List.of(INVALID_MARKER);
            List<Integer> values = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                Integer v = memory.cells[(front + i) % n];
                if (v == null) return List.of(INVALID_MARKER);
                values.add(v);
            }
            return values;
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            List<Integer> values = reference;
            if (name.equals("enqueue") && value != null) {
                boolean expected = values.size() < memory().length;
                if (expected) values.add(value);
                return same(returned, expected);
            }
            if (name.equals("dequeue")) return same(returned, removeFirst(values));
            if (name.equals("peek")) return same(returned, first(values));
            if (name.equals("isEmpty")) return same(returned, values.isEmpty());
            if (name.equals("isFull")) return same(returned, values.size() == memory().length);
            reference = new ArrayList<>(actualValues());
            return true;
        }

        boolean storageValid() {
            QueueMemory memory = memory();
            int n = memory.length, front = memory.front, rear = memory.rear, size = memory.size;
            if (n <= 0 || front < 0 || front >= n || rear < 0 || rear >= n || size < 0 || size > n
                    || rear != (front + size) % n) {
                return false;
            }
            for (int i = 0; i < n; i++) if ((((i - front + n) % n) < size) != (memory.cells[i] != null)) return false;
            return true;
        }

        @Override
        List<String> executionProblems() {
            return storageValid() ? List.of() : List.of("circular queue storage");
        }

        @Override
        void structuralChecks(Check check) {
            check.check("Fixed capacity", 8, memory().length);
            check.check("Logical size", reference.size(), memory().size);
            check.check("Circular queue storage", true, storageValid());
        }
    }

    static final class LinkedQueue extends Adapter {
        LinkedQueue(Supplier<Object> create) {
            super(create);
            kind = "linked_queue";
            pointerFields = Set.of("head", "tail");
            standardMethods = Set.of("enqueue", "dequeue", "peek", "isEmpty");
        }

        @Override
        void resetIds() {
            ListNode.resetIds();
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.Recorder recorder = new Recorders.Recorder();
            recorder.root = () -> field("head");
            recorder.tail = () -> field("tail");
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (name.equals("enqueue") || name.equals("insert")) return true;
            return super.expectedReturn(name, args);
        }

        @Override
        List<Integer> actualValues() {
            return chainValues(field("head"));
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            if (name.equals("enqueue") && value != null) {
                reference.add(value);
                return same(returned, true);
            }
            if (name.equals("dequeue")) return same(returned, removeFirst(reference));
            if (name.equals("peek")) return same(returned, first(reference));
            if (name.equals("isEmpty")) return same(returned, reference.isEmpty());
            reference = actualValues();
            return true;
        }

        boolean pointersValid() {
            ListNode head = field("head") instanceof ListNode node ? node : null;
            ListNode tail = field("tail") instanceof ListNode node ? node : null;
            if (head == null) return tail == null;
            if (tail == null) return false;
            Set<Integer> visited = new HashSet<>();
            ListNode last = null, cursor = head;
            while (cursor != null && visited.add(cursor.id)) {
                last = cursor;
                cursor = cursor.next;
            }
            return cursor == null && last == tail && tail.next == null;
        }

        @Override
        List<String> executionProblems() {
            return pointersValid() ? List.of() : List.of("head/tail pointers");
        }

        @Override
        void structuralChecks(Check check) {
            check.check("Head/tail and acyclic chain", true, pointersValid());
        }
    }

    // ---------------------------------------------------------------------- lists

    static boolean updateListReference(List<Integer> reference, String name, List<Object> args, Object returned,
            boolean positional, boolean capacityLimited) {
        Integer value = singleInt(args);
        Integer index = positional && !args.isEmpty() ? asInt(args.get(0)) : null;
        Integer item = positional && args.size() == 2 ? asInt(args.get(1)) : value;
        switch (name) {
            case "insert" -> {
                if (item == null) return false;
                boolean allowed = (!capacityLimited || reference.size() < 8)
                        && (!positional || (index != null && index >= 0 && index <= reference.size()));
                if (allowed) {
                    if (positional) {
                        reference.add(index, item);
                    } else {
                        int at = 0;
                        while (at < reference.size() && reference.get(at) <= item) at++;
                        reference.add(at, item);
                    }
                }
                return same(returned, allowed);
            }
            case "get" -> {
                if (index == null) return false;
                return same(returned, index >= 0 && index < reference.size() ? reference.get(index) : null);
            }
            case "removeAt" -> {
                if (index == null) return false;
                return same(returned, index >= 0 && index < reference.size() ? reference.remove((int) index) : null);
            }
            case "remove" -> {
                if (item == null) return false;
                return same(returned, removeValue(reference, item));
            }
            case "contains" -> {
                return item != null && same(returned, reference.contains(item));
            }
            case "length" -> {
                return same(returned, reference.size());
            }
            default -> {
                return false;
            }
        }
    }

    static final Set<String> UNSORTED_METHODS = Set.of("insert", "get", "removeAt", "contains", "length");
    static final Set<String> SORTED_METHODS = Set.of("insert", "contains", "remove", "length");

    static final class ArrayList_ extends Adapter {
        final boolean sorted;

        ArrayList_(Supplier<Object> create, boolean sorted) {
            super(create);
            this.sorted = sorted;
            kind = sorted ? "sorted_array_list" : "unsorted_array_list";
            indexFields = Set.of("size");
            standardMethods = sorted ? SORTED_METHODS : UNSORTED_METHODS;
            insertTakesIndex = !sorted;
        }

        ListMemory memory() {
            return (ListMemory) field("memory");
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.ListRecorder recorder = new Recorders.ListRecorder();
            recorder.memory = this::memory;
            recorder.size = () -> field("size");
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (!name.equals("insert")) return super.expectedReturn(name, args);
            if (sorted) return reference.size() < 8;
            Integer index = args.isEmpty() ? null : asInt(args.get(0));
            return reference.size() < 8 && index != null && index >= 0 && index <= reference.size();
        }

        @Override
        List<Integer> actualValues() {
            List<Integer> cells = memory().copy();
            Integer size = intField("size");
            if (size == null || size < 0 || size > cells.size()) return List.of(INVALID_MARKER);
            List<Integer> values = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                if (cells.get(i) == null) return List.of(INVALID_MARKER);
                values.add(cells.get(i));
            }
            return values;
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            return updateListReference(reference, name, args, returned, !sorted, true);
        }

        boolean storageValid() {
            ListMemory memory = memory();
            Integer size = intField("size");
            if (size == null || size < 0 || size > memory.length || size != reference.size()) return false;
            List<Integer> cells = memory.copy();
            for (int i = 0; i < cells.size(); i++) {
                if ((i < size) != (cells.get(i) != null)) return false;
                if (sorted && i > 0 && i < size && cells.get(i - 1) > cells.get(i)) return false;
            }
            return true;
        }

        @Override
        List<String> executionProblems() {
            return storageValid() ? List.of() : List.of("list storage, length or order");
        }

        @Override
        void structuralChecks(Check check) {
            check.check("Logical size", reference.size(), field("size"));
            check.check("List storage and ordering", true, storageValid());
            check.check("Fixed capacity", 8, memory().length);
        }
    }

    static final class LinkedList_ extends Adapter {
        final boolean sorted;

        LinkedList_(Supplier<Object> create, boolean sorted) {
            super(create);
            this.sorted = sorted;
            kind = sorted ? "sorted_linked_list" : "unsorted_linked_list";
            indexFields = Set.of("size");
            pointerFields = Set.of("head");
            standardMethods = sorted ? SORTED_METHODS : UNSORTED_METHODS;
            insertTakesIndex = !sorted;
        }

        @Override
        void resetIds() {
            ListNode.resetIds();
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.Recorder recorder = new Recorders.Recorder();
            recorder.root = () -> field("head");
            recorder.size = () -> field("size");
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (!name.equals("insert")) return super.expectedReturn(name, args);
            if (sorted) return true;
            Integer index = args.isEmpty() ? null : asInt(args.get(0));
            return index != null && index >= 0 && index <= reference.size();
        }

        @Override
        List<Integer> actualValues() {
            return chainValues(field("head"));
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            if (!sorted) return updateListReference(reference, name, args, returned, true, false);
            if (name.equals("length")) return same(returned, reference.size());
            Integer value = singleInt(args);
            if (value == null) {
                reference = actualValues();
                return true;
            }
            boolean present = reference.contains(value);
            switch (name) {
                case "insert" -> {
                    int index = 0;
                    while (index < reference.size() && reference.get(index) < value) index++;
                    reference.add(index, value);
                    return same(returned, true);
                }
                case "contains" -> {
                    return same(returned, present);
                }
                case "remove" -> {
                    if (present) removeValue(reference, value);
                    return same(returned, present);
                }
                default -> {
                    reference = actualValues();
                    return true;
                }
            }
        }

        boolean storageValid() {
            Integer size = intField("size");
            if (size == null || size < 0) return false;
            Set<Integer> seen = new HashSet<>();
            ListNode node = field("head") instanceof ListNode head ? head : null;
            Integer previous = null;
            while (node != null) {
                if (!seen.add(node.id)) return false;
                if (seen.size() > size) return false;
                if (sorted && previous != null && node.value < previous) return false;
                previous = node.value;
                node = node.next;
            }
            return seen.size() == size && size == reference.size();
        }

        @Override
        List<String> executionProblems() {
            return storageValid() ? List.of() : List.of("list storage, length or order");
        }

        @Override
        void structuralChecks(Check check) {
            check.check("Logical size", reference.size(), field("size"));
            check.check("List storage and ordering", true, storageValid());
        }
    }

    // ---------------------------------------------------------------------- trees

    static final class Tree extends Adapter {
        final boolean avl;

        Tree(Supplier<Object> create, boolean avl) {
            super(create);
            this.avl = avl;
            kind = avl ? "avl" : "tree";
            pointerFields = Set.of("root");
            standardMethods = Set.of("insert", "contains", "remove");
            insertReturnsVoid = true;
        }

        TreeNode root() {
            return field("root") instanceof TreeNode node ? node : null;
        }

        @Override
        void resetIds() {
            TreeNode.resetIds();
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.TreeRecorder recorder = new Recorders.TreeRecorder();
            recorder.root = () -> field("root");
            recorder.avl = avl;
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            return name.equals("insert") ? null : super.expectedReturn(name, args);
        }

        @Override
        List<Integer> actualValues() {
            List<Integer> values = new ArrayList<>();
            Set<Integer> seen = new HashSet<>();
            List<TreeNode> pending = new ArrayList<>();
            TreeNode current = root();
            while (current != null || !pending.isEmpty()) {
                while (current != null) {
                    if (!seen.add(current.id)) {
                        values.add(INVALID_MARKER);
                        return values;
                    }
                    pending.add(current);
                    current = current.left;
                }
                TreeNode node = pending.remove(pending.size() - 1);
                values.add(node.value);
                current = node.right;
            }
            return values;
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            if (value == null) {
                reference = actualValues();
                return true;
            }
            boolean present = reference.contains(value);
            switch (name) {
                case "insert" -> {
                    if (!present) {
                        reference.add(value);
                        Collections.sort(reference);
                    }
                    return true;
                }
                case "contains" -> {
                    return same(returned, present);
                }
                case "remove" -> {
                    if (present) removeValue(reference, value);
                    return same(returned, present);
                }
                default -> {
                    reference = actualValues();
                    return true;
                }
            }
        }

        @Override
        List<String> executionProblems() {
            if (!avl) return List.of();
            Map<String, Object> audit = Recorders.auditAvl(root());
            List<String> faults = new ArrayList<>();
            if (!Boolean.TRUE.equals(audit.get("acyclic"))) faults.add("cycle/shared child");
            if (!Boolean.TRUE.equals(audit.get("ordered"))) faults.add("BST order");
            if (!Boolean.TRUE.equals(audit.get("heights"))) faults.add("stored heights");
            if (!Boolean.TRUE.equals(audit.get("balanced"))) faults.add("balance factor");
            return faults.isEmpty() ? List.of() : List.of("AVL: " + String.join(", ", faults));
        }

        @Override
        void structuralChecks(Check check) {
            Map<String, Object> audit = Recorders.auditAvl(root());
            check.check("Acyclic tree", true, audit.get("acyclic"));
            check.check("BST ordering", true, audit.get("ordered"));
            if (avl) {
                check.check("Stored subtree heights", true, audit.get("heights"));
                check.check("AVL balance", true, audit.get("balanced"));
            }
        }
    }

    // ----------------------------------------------------------------------- heap

    static final class ArrayHeap extends Adapter {
        ArrayHeap(Supplier<Object> create) {
            super(create);
            kind = "array_heap";
            standardMethods = Set.of("insert", "removeMin", "peek", "isEmpty");
            unorderedContents = true;
            insertReturnsVoid = true;
        }

        HeapMemory memory() {
            return (HeapMemory) field("memory");
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.HeapRecorder recorder = new Recorders.HeapRecorder();
            recorder.memory = this::memory;
            return recorder;
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            if (name.equals("insert")) return null;
            if (name.equals("peek")) return minimum(reference);
            return super.expectedReturn(name, args);
        }

        @Override
        List<Integer> actualValues() {
            return memory().copy();
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            if (name.equals("insert") && value != null) {
                reference.add(value);
                Collections.sort(reference);
                return true;
            }
            if (name.equals("removeMin")) return same(returned, removeFirst(reference));
            if (name.equals("peek")) return same(returned, first(reference));
            if (name.equals("isEmpty")) return same(returned, reference.isEmpty());
            reference = memory().copy();
            Collections.sort(reference);
            return true;
        }

        boolean storageValid() {
            return Recorders.heapOrderValid(memory().copy());
        }

        @Override
        List<String> executionProblems() {
            return storageValid() ? List.of() : List.of("min-heap order");
        }

        @Override
        void structuralChecks(Check check) {
            check.check("Min-heap ordering", true, storageValid());
        }
    }

    // ----------------------------------------------------------------------- hash

    /** Physical placement checked with the STUDENT'S hash function. Not a student traversal:
     *  nothing is recorded meanwhile. */
    static Map<String, Object> auditHash(HashBuckets buckets, Object size) {
        Recorders.Base previous = Trace.active;
        Trace.active = null;
        try {
            Set<Integer> seen = new HashSet<>();
            Set<Integer> keys = new HashSet<>();
            List<Integer> values = new ArrayList<>();
            List<Integer> lengths = new ArrayList<>();
            boolean acyclic = true, placement = true, unique = true;
            List<ListNode> heads = buckets.heads();
            for (int i = 0; i < heads.size(); i++) {
                int length = 0;
                ListNode cursor = heads.get(i);
                while (cursor != null) {
                    if (!seen.add(cursor.id)) {
                        acyclic = false;
                        break;
                    }
                    int key = cursor.value;
                    try {
                        if (buckets.indexFor(key) != i) placement = false;
                    } catch (RuntimeException | StackOverflowError error) {
                        placement = false; // An invariant failure.
                    }
                    if (!keys.add(key)) unique = false;
                    values.add(key);
                    length++;
                    cursor = cursor.next;
                }
                lengths.add(length);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("acyclic", acyclic);
            result.put("placement", placement);
            result.put("unique", unique);
            result.put("sizeOk", same(size, values.size()));
            result.put("size", size);
            result.put("capacity", buckets.length);
            result.put("lengths", lengths);
            result.put("values", values);
            return result;
        } finally {
            Trace.active = previous;
        }
    }

    static final class Hash extends Adapter {
        Hash(Supplier<Object> create) {
            super(create);
            kind = "hash";
            standardMethods = Set.of("insert", "remove", "contains", "isEmpty", "loadFactor");
            unorderedContents = true;
        }

        HashBuckets buckets() {
            return (HashBuckets) field("buckets");
        }

        @Override
        void resetIds() {
            ListNode.resetIds();
        }

        @Override
        Recorders.Base createRecorder() {
            Recorders.HashRecorder recorder = new Recorders.HashRecorder();
            recorder.memory = this::buckets;
            recorder.count = () -> field("size");
            return recorder;
        }

        Map<String, Object> audit() {
            return auditHash(buckets(), field("size"));
        }

        @Override
        Object expectedReturn(String name, List<Object> args) {
            Integer value = args.isEmpty() ? null : asInt(args.get(args.size() - 1));
            if (name.equals("insert")) return value == null || !reference.contains(value);
            if (name.equals("loadFactor")) return (double) reference.size() / buckets().length;
            return super.expectedReturn(name, args);
        }

        @Override
        boolean returnMatches(String name, Object expected, Object returned) {
            if (name.equals("loadFactor")) {
                return returned instanceof Number r && !(returned instanceof Boolean) && expected instanceof Number e
                        && Math.abs(r.doubleValue() - e.doubleValue()) < 0.0000001;
            }
            return same(expected, returned);
        }

        @SuppressWarnings("unchecked")
        @Override
        List<Integer> actualValues() {
            return (List<Integer>) audit().get("values");
        }

        @Override
        boolean updateReference(String name, List<Object> args, Object returned) {
            Integer value = singleInt(args);
            if (name.equals("insert") && value != null) {
                boolean expected = !reference.contains(value);
                if (expected) reference.add(value);
                return same(returned, expected);
            }
            if (name.equals("remove") && value != null) return same(returned, removeValue(reference, value));
            if (name.equals("contains") && value != null) return same(returned, reference.contains(value));
            if (name.equals("isEmpty")) return same(returned, reference.isEmpty());
            if (name.equals("loadFactor")) {
                Integer size = intField("size");
                return returned instanceof Number r && size != null
                        && Math.abs(r.doubleValue() - (double) size / buckets().length) < 0.0000001;
            }
            reference = new ArrayList<>(actualValues());
            return true;
        }

        @Override
        List<String> executionProblems() {
            Map<String, Object> audit = audit();
            List<String> faults = new ArrayList<>();
            if (!Boolean.TRUE.equals(audit.get("acyclic"))) faults.add("cycle/shared node");
            if (!Boolean.TRUE.equals(audit.get("placement"))) faults.add("wrong bucket");
            if (!Boolean.TRUE.equals(audit.get("unique"))) faults.add("duplicate keys");
            if (!Boolean.TRUE.equals(audit.get("sizeOk"))) faults.add("stored size");
            return faults.isEmpty() ? List.of() : List.of("hash: " + String.join(", ", faults));
        }

        @Override
        void structuralChecks(Check check) {
            Map<String, Object> audit = audit();
            check.check("Acyclic chains", true, audit.get("acyclic"));
            check.check("Bucket placement", true, audit.get("placement"));
            check.check("Unique keys", true, audit.get("unique"));
            check.check("Stored size", reference.size(), field("size"));
            check.check("Hash table storage", true, audit.get("sizeOk"));
        }
    }

    static Adapter create(String kind, Supplier<Object> create) {
        return switch (kind) {
            case "unsorted_array_list" -> new ArrayList_(create, false);
            case "sorted_array_list" -> new ArrayList_(create, true);
            case "unsorted_linked_list" -> new LinkedList_(create, false);
            case "sorted_linked_list" -> new LinkedList_(create, true);
            case "tree" -> new Tree(create, false);
            case "avl" -> new Tree(create, true);
            case "stack" -> new ArrayStack(create);
            case "linked_stack" -> new LinkedStack(create);
            case "linked_queue" -> new LinkedQueue(create);
            case "array_queue" -> new ArrayQueue(create);
            case "array_heap" -> new ArrayHeap(create);
            case "hash" -> new Hash(create);
            default -> throw new IllegalArgumentException("Unknown structure: " + kind);
        };
    }
}
