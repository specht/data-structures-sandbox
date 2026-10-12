package sandbox;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * The recorders: lib/*_sandbox.dart of the Dart version event by event, so the browser receives
 * the same traces from every language (languages/python/sandbox and languages/javascript/sandbox.mjs
 * are the same port).
 */
final class Recorders {
    private Recorders() {}

    static final int MAX_EVENTS = 4000;

    /** Not an Exception: a student's catch (Exception e) must not swallow it. */
    static final class TraceLimitReached extends Error {
        private static final long serialVersionUID = 1L;

        TraceLimitReached() {
            super("Trace limit reached (" + MAX_EVENTS + " events).");
        }
    }

    /** The last traced line (for timeouts, errors and progress messages). */
    static final class Diagnostics {
        private Diagnostics() {}

        interface Listener {
            void line(int line, int traceIndex);
        }

        static Integer currentLine;
        static Integer currentTraceIndex;
        static Listener onLine;

        static void reset() {
            currentLine = null;
            currentTraceIndex = null;
        }

        static void atLine(int line, int traceIndex) {
            currentLine = line;
            currentTraceIndex = traceIndex;
            Listener listener = onLine;
            if (listener != null) listener.line(line, traceIndex);
        }
    }

    static Map<String, Object> event(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }

    /** A bounded trace: a runaway loop cannot exhaust the browser. */
    static final class EventLog {
        final List<Map<String, Object>> list = new ArrayList<>();

        void add(Map<String, Object> event) {
            if ("line".equals(event.get("kind")) && event.get("line") instanceof Integer line) {
                Diagnostics.atLine(line, list.size());
            }
            if (list.size() >= MAX_EVENTS) throw new TraceLimitReached();
            list.add(event);
        }

        int size() {
            return list.size();
        }
    }

    static Integer idOf(Object node) {
        if (node instanceof ListNode list) return list.id;
        if (node instanceof TreeNode tree) return tree.id;
        return null;
    }

    /** Dart's toString for values in messages: null, true, 0.5, 1.0 for doubles. */
    static String show(Object value) {
        if (value == null) return "null";
        if (value instanceof Double || value instanceof Float) {
            double number = ((Number) value).doubleValue();
            if (Double.isFinite(number) && number == Math.rint(number) && Math.abs(number) < 1e15) {
                return (long) number + ".0";
            }
        }
        return String.valueOf(value);
    }

    static String operation(String name, List<Object> args) {
        StringBuilder text = new StringBuilder(name).append('(');
        for (int i = 0; i < args.size(); i++) {
            if (i > 0) text.append(", ");
            text.append(show(args.get(i)));
        }
        return text.append(')').toString();
    }

    static boolean heapOrderValid(List<Integer> values) {
        for (int i = 1; i < values.size(); i++) {
            if (values.get((i - 1) >> 1) > values.get(i)) return false;
        }
        return true;
    }

    // ----------------------------------------------------------------------- base

    abstract static class Base {
        final EventLog steps = new EventLog();
        int sourceLine = 0;

        void atLine(int line) {
            sourceLine = line;
            steps.add(event("kind", "line", "line", line));
        }

        void begin(String name, List<Object> args, int line) {
            steps.add(event("kind", "operationStart", "operation", operation(name, args), "line", 0));
        }

        void indexWrite(String name, Object before, Object after) {
            steps.add(event("kind", "indexWrite", "name", name, "oldValue", before, "value", after, "line", sourceLine));
            steps.add(snapshot());
        }

        void end(Object value, boolean ok, boolean returnedVoid, String message) {
            steps.add(event("kind", "operationEnd", "value", value, "returnedVoid", returnedVoid, "ok", ok,
                    "result", message != null ? message : "Result: " + show(value), "line", 0));
        }

        abstract Map<String, Object> snapshot();
    }

    // ------------------------------------------------------------ linked chains

    /** Linked chains (lists, linked stack and queue): lib/sandbox.dart. */
    static class Recorder extends Base {
        Supplier<Object> root;
        Supplier<Object> tail;
        Supplier<Object> size;

        @Override
        void begin(String name, List<Object> args, int line) {
            sourceLine = line;
            steps.add(event("kind", "operationStart", "operation", operation(name, args),
                    "description", "Executing the student method.", "line", line));
        }

        void reference(String name, Object node) {
            steps.add(event("kind", "variableWrite", "name", name, "to", idOf(node), "line", sourceLine));
        }

        void visit(ListNode node) {
            steps.add(event("kind", "visit", "id", node.id, "line", sourceLine));
        }

        void createNode(ListNode node) {
            ListNode.registry.put(node.id, node);
            steps.add(event("kind", "createNode", "node", event("id", node.id, "value", node.value, "next", null),
                    "line", sourceLine));
        }

        void pointerWrite(String from, Object before, Object after) {
            steps.add(event("kind", "pointerWrite", "from", from, "oldTo", idOf(before), "to", idOf(after),
                    "line", sourceLine));
            steps.add(snapshot());
        }

        @Override
        Map<String, Object> snapshot() {
            Map<String, Object> result = event("kind", "snapshot", "head", idOf(root == null ? null : root.get()));
            if (tail != null) result.put("tail", idOf(tail.get()));
            if (size != null) result.put("size", size.get());
            List<Object> nodes = new ArrayList<>();
            for (ListNode node : ListNode.registry.values()) {
                nodes.add(event("id", node.id, "value", node.value, "next", idOf(node.next)));
            }
            result.put("nodes", nodes);
            return result;
        }

        Set<Integer> alive() {
            Set<Integer> alive = new HashSet<>();
            Object start = root == null ? null : root.get();
            ListNode cursor = start instanceof ListNode node ? node : null;
            while (cursor != null && alive.add(cursor.id)) cursor = cursor.next;
            return alive;
        }

        @Override
        void end(Object value, boolean ok, boolean returnedVoid, String message) {
            steps.add(event("kind", "localsClear", "line", sourceLine));
            Set<Integer> alive = alive();
            List<Integer> retired = new ArrayList<>();
            for (Integer id : ListNode.registry.keySet()) if (!alive.contains(id)) retired.add(id);
            if (!retired.isEmpty()) {
                steps.add(event("kind", "retire", "ids", retired, "line", 0));
                for (Integer id : retired) ListNode.registry.remove(id);
                steps.add(snapshot());
            }
            steps.add(event("kind", "operationEnd", "ok", ok, "value", value, "returnedVoid", returnedVoid,
                    "result", message != null ? message : (ok ? "✓" : "✗") + " Result: " + show(value),
                    "line", sourceLine));
        }
    }

    /** Hash tables: lib/hash_sandbox.dart. */
    static final class HashRecorder extends Recorder {
        Supplier<HashBuckets> memory;
        Supplier<Object> count;

        void bucketRead(int index, ListNode target) {
            steps.add(event("kind", "bucketRead", "index", index, "to", idOf(target), "line", sourceLine));
        }

        void bucketWrite(int index, ListNode before, ListNode after) {
            steps.add(event("kind", "bucketWrite", "index", index, "oldTo", idOf(before), "to", idOf(after),
                    "line", sourceLine));
            steps.add(snapshot());
        }

        private List<ListNode> heads() {
            HashBuckets buckets = memory == null ? null : memory.get();
            return buckets == null ? List.of() : buckets.heads();
        }

        @Override
        Map<String, Object> snapshot() {
            Map<String, Object> result = super.snapshot();
            List<ListNode> heads = heads();
            List<Object> ids = new ArrayList<>();
            for (ListNode head : heads) ids.add(idOf(head));
            result.put("buckets", ids);
            Object stored = count == null ? null : count.get();
            result.put("size", stored == null ? 0 : stored);
            result.put("capacity", heads.size());
            return result;
        }

        @Override
        Set<Integer> alive() {
            Set<Integer> alive = new HashSet<>();
            for (ListNode start : heads()) {
                ListNode cursor = start;
                while (cursor != null && alive.add(cursor.id)) cursor = cursor.next;
            }
            return alive;
        }
    }

    // --------------------------------------------------------------------- trees

    /** Binary search and AVL trees: lib/tree_sandbox.dart. */
    static final class TreeRecorder extends Base {
        Supplier<Object> root;
        boolean avl = false;

        void reference(String name, Object node) {
            steps.add(event("kind", "variableWrite", "name", name, "to", idOf(node), "line", sourceLine));
        }

        void visit(TreeNode node) {
            steps.add(event("kind", "visit", "id", node.id, "line", sourceLine));
        }

        void createNode(TreeNode node) {
            TreeNode.registry.put(node.id, node);
            steps.add(event("kind", "createNode", "node", event("id", node.id, "value", node.value, "height", node.height),
                    "line", sourceLine));
        }

        void valueWrite() {
            steps.add(snapshot());
        }

        void heightWrite(TreeNode node, Object before, int after) {
            steps.add(event("kind", "heightWrite", "id", node.id, "before", before, "to", after, "line", sourceLine));
            steps.add(snapshot());
        }

        void pointerWrite(String from, Object before, Object after) {
            steps.add(event("kind", "pointerWrite", "from", from, "oldTo", idOf(before), "to", idOf(after),
                    "line", sourceLine));
            steps.add(snapshot());
        }

        TreeNode rootNode() {
            Object value = root == null ? null : root.get();
            return value instanceof TreeNode node ? node : null;
        }

        @Override
        Map<String, Object> snapshot() {
            TreeNode top = rootNode();
            List<Object> nodes = new ArrayList<>();
            for (TreeNode node : TreeNode.registry.values()) {
                nodes.add(event("id", node.id, "value", node.value, "left", idOf(node.left), "right", idOf(node.right),
                        "height", node.height));
            }
            Map<String, Object> result = event("kind", "snapshot", "root", idOf(top), "nodes", nodes);
            if (avl) result.put("avl", auditAvl(top));
            return result;
        }

        @Override
        void end(Object value, boolean ok, boolean returnedVoid, String message) {
            Set<Integer> alive = new HashSet<>();
            List<TreeNode> pending = new ArrayList<>();
            pending.add(rootNode());
            while (!pending.isEmpty()) {
                TreeNode node = pending.remove(pending.size() - 1);
                if (node == null || !alive.add(node.id)) continue;
                pending.add(node.left);
                pending.add(node.right);
            }
            List<Integer> retired = new ArrayList<>();
            for (Integer id : TreeNode.registry.keySet()) if (!alive.contains(id)) retired.add(id);
            if (!retired.isEmpty()) {
                steps.add(event("kind", "retire", "ids", retired, "line", 0));
                for (Integer id : retired) TreeNode.registry.remove(id);
                steps.add(snapshot());
            }
            super.end(value, ok, returnedVoid, message);
        }
    }

    private record Pending(TreeNode node, boolean done, Integer low, Integer high) {}

    /** True heights from the pointer graph; iterative and cycle-safe. */
    static Map<String, Object> auditAvl(TreeNode root) {
        Map<Integer, Integer> calculated = new LinkedHashMap<>();
        Map<String, Object> details = new LinkedHashMap<>();
        Set<Integer> seen = new HashSet<>();
        boolean acyclic = true, ordered = true, heights = true, balanced = true;
        List<Pending> pending = new ArrayList<>();
        if (root != null) pending.add(new Pending(root, false, null, null));
        while (!pending.isEmpty()) {
            Pending item = pending.remove(pending.size() - 1);
            TreeNode node = item.node();
            if (!item.done()) {
                if (!seen.add(node.id)) {
                    acyclic = false;
                    continue;
                }
                if ((item.low() != null && node.value <= item.low()) || (item.high() != null && node.value >= item.high())) {
                    ordered = false;
                }
                pending.add(new Pending(node, true, item.low(), item.high()));
                if (node.right != null) pending.add(new Pending(node.right, false, node.value, item.high()));
                if (node.left != null) pending.add(new Pending(node.left, false, item.low(), node.value));
                continue;
            }
            TreeNode left = node.left, right = node.right;
            if ((left != null && !calculated.containsKey(left.id)) || (right != null && !calculated.containsKey(right.id))) {
                acyclic = false;
            }
            int lh = left == null ? 0 : calculated.getOrDefault(left.id, 0);
            int rh = right == null ? 0 : calculated.getOrDefault(right.id, 0);
            int expected = 1 + Math.max(lh, rh);
            int balance = lh - rh;
            boolean heightOk = node.height == expected;
            boolean balanceOk = Math.abs(balance) <= 1;
            if (!heightOk) heights = false;
            if (!balanceOk) balanced = false;
            calculated.put(node.id, expected);
            details.put(String.valueOf(node.id), event("height", node.height, "expectedHeight", expected,
                    "balance", balance, "heightOk", heightOk, "balanceOk", balanceOk));
        }
        return event("acyclic", acyclic, "ordered", ordered, "heights", heights, "balanced", balanced, "nodes", details);
    }

    // -------------------------------------------------------------------- arrays

    /** Fixed-array stack: lib/stack_sandbox.dart. */
    static final class StackRecorder extends Base {
        Supplier<FixedMemory> memory;
        Supplier<Object> top;

        void cellWrite(int index, Integer before, Integer value) {
            steps.add(event("kind", "cellWrite", "index", index, "oldValue", before, "value", value, "line", sourceLine));
            steps.add(snapshot());
        }

        @Override
        Map<String, Object> snapshot() {
            FixedMemory cells = memory == null ? null : memory.get();
            Object index = top == null ? null : top.get();
            return event("kind", "snapshot", "cells", cells == null ? List.of() : cells.copy(),
                    "top", index == null ? -1 : index);
        }
    }

    /** Array lists: lib/list_sandbox.dart. */
    static final class ListRecorder extends Base {
        Supplier<ListMemory> memory;
        Supplier<Object> size;

        void cellWrite(int index, Integer before, Integer value) {
            steps.add(event("kind", "cellWrite", "index", index, "oldValue", before, "value", value, "line", sourceLine));
            steps.add(snapshot());
        }

        @Override
        Map<String, Object> snapshot() {
            ListMemory cells = memory == null ? null : memory.get();
            Object count = size == null ? null : size.get();
            return event("kind", "snapshot", "cells", cells == null ? List.of() : cells.copy(),
                    "size", count == null ? 0 : count);
        }
    }

    /** Circular array queue: lib/queue_sandbox.dart. */
    static final class QueueRecorder extends Base {
        Supplier<QueueMemory> memory;

        void cellWrite(int index, Integer before, Integer value) {
            steps.add(event("kind", "cellWrite", "index", index, "oldValue", before, "value", value, "line", sourceLine));
            steps.add(snapshot());
        }

        @Override
        Map<String, Object> snapshot() {
            QueueMemory cells = memory == null ? null : memory.get();
            if (cells == null) return event("kind", "snapshot", "cells", List.of(), "front", 0, "rear", 0, "size", 0);
            return event("kind", "snapshot", "cells", cells.copy(), "front", cells.front, "rear", cells.rear,
                    "size", cells.size);
        }
    }

    /** Array min-heap: lib/heap_sandbox.dart. */
    static final class HeapRecorder extends Base {
        Supplier<HeapMemory> memory;

        void read(int index, int value) {
            steps.add(event("kind", "heapRead", "index", index, "value", value, "line", sourceLine));
        }

        void change(String kind, Object... fields) {
            Map<String, Object> change = event("kind", kind);
            change.putAll(event(fields));
            change.put("line", sourceLine);
            steps.add(change);
            steps.add(snapshot());
        }

        @Override
        Map<String, Object> snapshot() {
            HeapMemory heap = memory == null ? null : memory.get();
            List<Integer> cells = heap == null ? List.of() : heap.copy();
            return event("kind", "snapshot", "cells", cells, "size", cells.size(), "heapOrder", heapOrderValid(cells));
        }
    }
}
