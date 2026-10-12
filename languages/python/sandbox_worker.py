"""Worker process for one Python data structure (one revision of one file).

Started by the host as

    python3 -I -B sandbox_worker.py BUILD_DIRECTORY

where the directory holds algorithm.py (a byte-identical copy of the student's
file) and build.json ({kind, className, sourcePath}). It reproduces the Dart
worker (lib/worker/session.dart and lib/structures/*.dart) message by message:
the same requests (run, reset, validateCall, ping), the same trace events, the
same reference models and structural checks. The browser and the host cannot
tell the languages apart.

Python needs no instrumented copy: sys.settrace reports every executed line of
the student's file, properties of the storage classes report reads and writes,
and __setattr__ on the student's class reports `top`, `size`, `head`, `root`
and `tail` assignments - exactly the events the Dart instrumenter inserts.
"""

import ast
import importlib.util
import inspect
import io
import json
import math
import os
import sys
import threading
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sandbox  # noqa: E402
from sandbox import (  # noqa: E402
    Diagnostics,
    FixedMemory,
    HashBuckets,
    HashRecorder,
    HeapMemory,
    HeapRecorder,
    ListMemory,
    ListNode,
    ListRecorder,
    QueueMemory,
    QueueRecorder,
    Recorder,
    StackRecorder,
    TraceLimitReached,
    TreeNode,
    TreeRecorder,
    audit_avl,
    heap_order_valid,
)

MAX_OPERATIONS = 20
MAX_VALUE = 999
INVALID_MARKER = 10000000

_protocol_out = os.fdopen(os.dup(1), "w", encoding="utf-8", buffering=1)
_protocol_in = os.fdopen(os.dup(0), "r", encoding="utf-8")
sys.stdin = io.StringIO("")


def post(message):
    _protocol_out.write(json.dumps(message, allow_nan=False) + "\n")
    _protocol_out.flush()


class RequestError(Exception):
    """Dart's FormatException: an invalid request, not a student error."""

    def __str__(self):
        return f"FormatException: {self.args[0]}"


def same(a, b):
    """Dart's == for the JSON values that methods return: true is not 1."""
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    return a == b


def show(value):
    return sandbox._show(value)


def snake_to_camel(name):
    head, *rest = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in rest)


# --------------------------------------------------------------- the adapters
# One per structure, ported from lib/structures/*.dart.


class Adapter:
    kind = ""
    recorder_class = Recorder
    # Student-owned fields whose assignments the Dart instrumenter records.
    index_fields = ()
    pointer_fields = ()
    standard_methods = frozenset()
    unordered_contents = False
    insert_returns_void = False
    insert_takes_index = False
    capacity_cells = False

    def __init__(self, create):
        self._create = create
        self.reference = []
        self.instance = None

    @property
    def s(self):
        return self.instance

    def reset_ids(self):
        pass

    def reset(self):
        self.reference.clear()
        self.reset_ids()
        sandbox.set_active(None)
        self.instance = self._create()

    def create_recorder(self, silent=False):
        return self.recorder_class(silent=silent)

    @property
    def capacity(self):
        return len(self.s.memory) if self.capacity_cells else None

    def actual_values(self):
        raise NotImplementedError

    def update_reference(self, name, args, returned):
        raise NotImplementedError

    def execution_problems(self):
        return []

    def structural_checks(self, check):
        pass

    def return_matches(self, name, expected, returned):
        return same(expected, returned)

    def required_method_signature(self, name):
        if name == "insert" and self.insert_returns_void:
            returns = "void"
        elif name in ("insert", "push", "enqueue", "contains", "remove", "isEmpty", "isFull"):
            returns = "bool"
        elif name in ("get", "removeAt", "pop", "peek", "dequeue", "removeMin"):
            returns = "int?"
        elif name == "length":
            returns = "int"
        elif name == "loadFactor":
            returns = "double"
        else:
            raise RuntimeError(f"No required signature for {self.kind}.{name}")
        if name == "insert" and self.insert_takes_index:
            arguments = "int, int"
        elif name in ("pop", "peek", "dequeue", "removeMin", "isEmpty", "isFull", "length", "loadFactor"):
            arguments = ""
        else:
            arguments = "int"
        return f"{returns} {name}({arguments})"

    def expected_return(self, name, args):
        value = args[-1] if args and isinstance(args[-1], int) and not isinstance(args[-1], bool) else None
        index = args[0] if self.insert_takes_index and args else None
        reference = self.reference
        if name in ("get", "removeAt"):
            return reference[index] if index is not None and 0 <= index < len(reference) else None
        if name == "pop":
            return reference[-1] if reference else None
        if name in ("peek", "dequeue"):
            return reference[0] if reference else None
        if name == "removeMin":
            return sorted(reference)[0] if reference else None
        if name in ("remove", "contains"):
            return value in reference
        if name == "length":
            return len(reference)
        if name == "isEmpty":
            return not reference
        if name == "isFull":
            return len(reference) == 8
        raise RuntimeError(f"No reference contract for {self.kind}.{name}")

    @staticmethod
    def chain_values(head):
        values = []
        seen = set()
        node = head
        while node is not None and node._id not in seen:
            seen.add(node._id)
            values.append(node._value)
            node = node._next
        if node is not None:
            values.append(INVALID_MARKER)
        return values


def _single_int(args):
    if len(args) == 1 and isinstance(args[0], int) and not isinstance(args[0], bool):
        return args[0]
    return None


class ArrayStackAdapter(Adapter):
    kind = "stack"
    recorder_class = StackRecorder
    index_fields = ("top",)
    standard_methods = frozenset({"push", "pop", "peek", "isEmpty"})
    capacity_cells = True

    def create_recorder(self, silent=False):
        recorder = StackRecorder(silent=silent)
        recorder.memory = lambda: self.s.memory
        recorder.top = lambda: self.s.top
        return recorder

    def expected_return(self, name, args):
        if name in ("push", "insert"):
            return len(self.reference) < 8
        if name == "peek":
            return self.reference[-1] if self.reference else None
        return super().expected_return(name, args)

    def actual_values(self):
        memory, top = self.s.memory, self.s.top
        values = []
        i = 0
        while i <= top and i < len(memory):
            v = memory._cells[i]
            if v is not None:
                values.append(v)
            i += 1
        return values

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        stack = self.reference
        if name == "push" and value is not None:
            expected = len(stack) < 8
            if expected:
                stack.append(value)
            return same(returned, expected)
        if name == "pop":
            expected = stack.pop() if stack else None
            return same(returned, expected)
        if name == "peek":
            return same(returned, stack[-1] if stack else None)
        if name == "isEmpty":
            return same(returned, not stack)
        stack[:] = self.actual_values()
        return True

    def storage_valid(self):
        memory, top = self.s.memory, self.s.top
        if not isinstance(top, int) or top < -1 or top >= len(memory):
            return False
        return all((i <= top) == (memory._cells[i] is not None) for i in range(len(memory)))

    def execution_problems(self):
        return [] if self.storage_valid() else ["stack cells or top index"]

    def structural_checks(self, check):
        check("Fixed capacity", 8, len(self.s.memory))
        check("Top index", len(self.reference) - 1, self.s.top)
        check("Stack storage", True, self.storage_valid())


class LinkedStackAdapter(Adapter):
    kind = "linked_stack"
    pointer_fields = ("head",)
    standard_methods = frozenset({"push", "pop", "peek", "isEmpty"})

    def reset_ids(self):
        ListNode.reset_ids()

    def create_recorder(self, silent=False):
        recorder = Recorder(silent=silent)
        recorder.root = lambda: self.s.head
        return recorder

    def expected_return(self, name, args):
        if name in ("push", "insert"):
            return True
        if name == "pop":
            return self.reference[0] if self.reference else None
        return super().expected_return(name, args)

    def actual_values(self):
        return self.chain_values(self.s.head)

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        reference = self.reference
        if name == "push" and value is not None:
            reference.insert(0, value)
            return same(returned, True)
        if name == "pop":
            expected = reference.pop(0) if reference else None
            return same(returned, expected)
        if name == "peek":
            return same(returned, reference[0] if reference else None)
        if name == "isEmpty":
            return same(returned, not reference)
        reference[:] = self.actual_values()
        return True

    def structural_checks(self, check):
        seen = set()
        node = self.s.head
        while node is not None and node._id not in seen:
            seen.add(node._id)
            node = node._next
        check("Acyclic stack chain", True, node is None)


class ArrayQueueAdapter(Adapter):
    kind = "array_queue"
    recorder_class = QueueRecorder
    standard_methods = frozenset({"enqueue", "dequeue", "peek", "isEmpty", "isFull"})
    capacity_cells = True

    def create_recorder(self, silent=False):
        recorder = QueueRecorder(silent=silent)
        recorder.memory = lambda: self.s.memory
        return recorder

    def expected_return(self, name, args):
        if name in ("enqueue", "insert"):
            return len(self.reference) < 8
        return super().expected_return(name, args)

    def _markers(self):
        memory = self.s.memory
        return memory, len(memory), memory._front, memory._rear, memory._size

    def actual_values(self):
        memory, n, front, rear, size = self._markers()
        if n <= 0 or front < 0 or front >= n or size < 0 or size > n:
            return [INVALID_MARKER]
        values = []
        for i in range(size):
            v = memory._cells[(front + i) % n]
            if v is None:
                return [INVALID_MARKER]
            values.append(v)
        return values

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        values = self.reference
        if name == "enqueue" and value is not None:
            expected = len(values) < len(self.s.memory)
            if expected:
                values.append(value)
            return same(returned, expected)
        if name == "dequeue":
            expected = values.pop(0) if values else None
            return same(returned, expected)
        if name == "peek":
            return same(returned, values[0] if values else None)
        if name == "isEmpty":
            return same(returned, not values)
        if name == "isFull":
            return same(returned, len(values) == len(self.s.memory))
        values[:] = self.actual_values()
        return True

    def storage_valid(self):
        memory, n, front, rear, size = self._markers()
        if (n <= 0 or front < 0 or front >= n or rear < 0 or rear >= n
                or size < 0 or size > n or rear != (front + size) % n):
            return False
        return all((((i - front + n) % n) < size) == (memory._cells[i] is not None) for i in range(n))

    def execution_problems(self):
        return [] if self.storage_valid() else ["circular queue storage"]

    def structural_checks(self, check):
        check("Fixed capacity", 8, len(self.s.memory))
        check("Logical size", len(self.reference), self.s.memory._size)
        check("Circular queue storage", True, self.storage_valid())


class LinkedQueueAdapter(Adapter):
    kind = "linked_queue"
    pointer_fields = ("head", "tail")
    standard_methods = frozenset({"enqueue", "dequeue", "peek", "isEmpty"})

    def reset_ids(self):
        ListNode.reset_ids()

    def create_recorder(self, silent=False):
        recorder = Recorder(silent=silent)
        recorder.root = lambda: self.s.head
        recorder.tail = lambda: self.s.tail
        return recorder

    def expected_return(self, name, args):
        if name in ("enqueue", "insert"):
            return True
        return super().expected_return(name, args)

    def actual_values(self):
        return self.chain_values(self.s.head)

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        reference = self.reference
        if name == "enqueue" and value is not None:
            reference.append(value)
            return same(returned, True)
        if name == "dequeue":
            expected = reference.pop(0) if reference else None
            return same(returned, expected)
        if name == "peek":
            return same(returned, reference[0] if reference else None)
        if name == "isEmpty":
            return same(returned, not reference)
        reference[:] = self.actual_values()
        return True

    def pointers_valid(self):
        head, tail = self.s.head, self.s.tail
        if head is None:
            return tail is None
        if tail is None:
            return False
        visited = set()
        last, cursor = None, head
        while cursor is not None and cursor._id not in visited:
            visited.add(cursor._id)
            last = cursor
            cursor = cursor._next
        return cursor is None and last is tail and tail._next is None

    def execution_problems(self):
        return [] if self.pointers_valid() else ["head/tail pointers"]

    def structural_checks(self, check):
        check("Head/tail and acyclic chain", True, self.pointers_valid())


def _update_list_reference(reference, name, args, returned, positional, capacity_limited):
    value = _single_int(args)
    index = args[0] if positional and args else None
    item = args[1] if positional and len(args) == 2 else value
    if name == "insert":
        if item is None:
            return False
        allowed = (not capacity_limited or len(reference) < 8) and (
            not positional or (index is not None and 0 <= index <= len(reference))
        )
        if allowed:
            if positional:
                reference.insert(index, item)
            else:
                at = 0
                while at < len(reference) and reference[at] <= item:
                    at += 1
                reference.insert(at, item)
        return same(returned, allowed)
    if name == "get":
        if index is None:
            return False
        return same(returned, reference[index] if 0 <= index < len(reference) else None)
    if name == "removeAt":
        if index is None:
            return False
        expected = reference.pop(index) if 0 <= index < len(reference) else None
        return same(returned, expected)
    if name == "remove":
        if item is None:
            return False
        expected = item in reference
        if expected:
            reference.remove(item)
        return same(returned, expected)
    if name == "contains":
        return item is not None and same(returned, item in reference)
    if name == "length":
        return same(returned, len(reference))
    return False


_UNSORTED_METHODS = frozenset({"insert", "get", "removeAt", "contains", "length"})
_SORTED_METHODS = frozenset({"insert", "contains", "remove", "length"})


class ArrayListAdapter(Adapter):
    recorder_class = ListRecorder
    index_fields = ("size",)

    def __init__(self, create, sorted_list):
        super().__init__(create)
        self.sorted = sorted_list
        self.kind = "sorted_array_list" if sorted_list else "unsorted_array_list"
        self.standard_methods = _SORTED_METHODS if sorted_list else _UNSORTED_METHODS
        self.insert_takes_index = not sorted_list

    def create_recorder(self, silent=False):
        recorder = ListRecorder(silent=silent)
        recorder.memory = lambda: self.s.memory
        recorder.size = lambda: self.s.size
        return recorder

    def expected_return(self, name, args):
        if name != "insert":
            return super().expected_return(name, args)
        if self.sorted:
            return len(self.reference) < 8
        index = args[0] if args else None
        return len(self.reference) < 8 and index is not None and 0 <= index <= len(self.reference)

    def actual_values(self):
        cells = self.s.memory.copy()
        size = self.s.size
        if not isinstance(size, int) or size < 0 or size > len(cells):
            return [INVALID_MARKER]
        values = []
        for i in range(size):
            if cells[i] is None:
                return [INVALID_MARKER]
            values.append(cells[i])
        return values

    def update_reference(self, name, args, returned):
        return _update_list_reference(self.reference, name, args, returned,
                                      positional=not self.sorted, capacity_limited=True)

    def storage_valid(self):
        memory, size = self.s.memory, self.s.size
        if not isinstance(size, int) or size < 0 or size > len(memory) or size != len(self.reference):
            return False
        cells = memory.copy()
        for i, cell in enumerate(cells):
            if (i < size) != (cell is not None):
                return False
            if self.sorted and 0 < i < size and cells[i - 1] > cell:
                return False
        return True

    def execution_problems(self):
        return [] if self.storage_valid() else ["list storage, length or order"]

    def structural_checks(self, check):
        check("Logical size", len(self.reference), self.s.size)
        check("List storage and ordering", True, self.storage_valid())
        check("Fixed capacity", 8, len(self.s.memory))


class LinkedListAdapter(Adapter):
    index_fields = ("size",)
    pointer_fields = ("head",)

    def __init__(self, create, sorted_list):
        super().__init__(create)
        self.sorted = sorted_list
        self.kind = "sorted_linked_list" if sorted_list else "unsorted_linked_list"
        self.standard_methods = _SORTED_METHODS if sorted_list else _UNSORTED_METHODS
        self.insert_takes_index = not sorted_list

    def reset_ids(self):
        ListNode.reset_ids()

    def create_recorder(self, silent=False):
        recorder = Recorder(silent=silent)
        recorder.root = lambda: self.s.head
        recorder.size = lambda: self.s.size
        return recorder

    def expected_return(self, name, args):
        if name != "insert":
            return super().expected_return(name, args)
        if self.sorted:
            return True
        index = args[0] if args else None
        return index is not None and 0 <= index <= len(self.reference)

    def actual_values(self):
        return self.chain_values(self.s.head)

    def update_reference(self, name, args, returned):
        reference = self.reference
        if not self.sorted:
            return _update_list_reference(reference, name, args, returned,
                                          positional=True, capacity_limited=False)
        if name == "length":
            return same(returned, len(reference))
        value = _single_int(args)
        if value is None:
            reference[:] = self.actual_values()
            return True
        present = value in reference
        if name == "insert":
            index = next((i for i, v in enumerate(reference) if v >= value), len(reference))
            reference.insert(index, value)
            return same(returned, True)
        if name == "contains":
            return same(returned, present)
        if name == "remove":
            if present:
                reference.remove(value)
            return same(returned, present)
        reference[:] = self.actual_values()
        return True

    def storage_valid(self):
        size = self.s.size
        if not isinstance(size, int) or size < 0:
            return False
        seen = set()
        node = self.s.head
        previous = None
        while node is not None:
            if node._id in seen:
                return False
            seen.add(node._id)
            if len(seen) > size:
                return False
            if self.sorted and previous is not None and node._value < previous:
                return False
            previous = node._value
            node = node._next
        return len(seen) == size and size == len(self.reference)

    def execution_problems(self):
        return [] if self.storage_valid() else ["list storage, length or order"]

    def structural_checks(self, check):
        check("Logical size", len(self.reference), self.s.size)
        check("List storage and ordering", True, self.storage_valid())


class TreeAdapter(Adapter):
    recorder_class = TreeRecorder
    pointer_fields = ("root",)
    standard_methods = frozenset({"insert", "contains", "remove"})
    insert_returns_void = True

    def __init__(self, create, avl):
        super().__init__(create)
        self.avl = avl
        self.kind = "avl" if avl else "tree"

    def reset_ids(self):
        TreeNode.reset_ids()

    def create_recorder(self, silent=False):
        recorder = TreeRecorder(silent=silent)
        recorder.root = lambda: self.s.root
        recorder.avl = self.avl
        return recorder

    def expected_return(self, name, args):
        return None if name == "insert" else super().expected_return(name, args)

    def actual_values(self):
        values = []
        seen = set()
        pending = []
        current = self.s.root
        while current is not None or pending:
            while current is not None:
                if current._id in seen:
                    values.append(INVALID_MARKER)
                    return values
                seen.add(current._id)
                pending.append(current)
                current = current._left
            node = pending.pop()
            values.append(node._value)
            current = node._right
        return values

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        reference = self.reference
        if value is None:
            reference[:] = self.actual_values()
            return True
        present = value in reference
        if name == "insert":
            if not present:
                reference.append(value)
                reference.sort()
            return True
        if name == "contains":
            return same(returned, present)
        if name == "remove":
            if present:
                reference.remove(value)
            return same(returned, present)
        reference[:] = self.actual_values()
        return True

    def execution_problems(self):
        if not self.avl:
            return []
        audit = audit_avl(self.s.root)
        faults = [
            label for key, label in (
                ("acyclic", "cycle/shared child"),
                ("ordered", "BST order"),
                ("heights", "stored heights"),
                ("balanced", "balance factor"),
            ) if audit[key] is not True
        ]
        return [f"AVL: {', '.join(faults)}"] if faults else []

    def structural_checks(self, check):
        audit = audit_avl(self.s.root)
        check("Acyclic tree", True, audit["acyclic"])
        check("BST ordering", True, audit["ordered"])
        if self.avl:
            check("Stored subtree heights", True, audit["heights"])
            check("AVL balance", True, audit["balanced"])


class ArrayHeapAdapter(Adapter):
    kind = "array_heap"
    recorder_class = HeapRecorder
    standard_methods = frozenset({"insert", "removeMin", "peek", "isEmpty"})
    unordered_contents = True
    insert_returns_void = True

    def create_recorder(self, silent=False):
        recorder = HeapRecorder(silent=silent)
        recorder.memory = lambda: self.s.memory
        return recorder

    def expected_return(self, name, args):
        if name == "insert":
            return None
        if name == "peek":
            return sorted(self.reference)[0] if self.reference else None
        return super().expected_return(name, args)

    def actual_values(self):
        return self.s.memory.copy()

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        reference = self.reference
        if name == "insert" and value is not None:
            reference.append(value)
            reference.sort()
            return True
        if name == "removeMin":
            expected = reference.pop(0) if reference else None
            return same(returned, expected)
        if name == "peek":
            return same(returned, reference[0] if reference else None)
        if name == "isEmpty":
            return same(returned, not reference)
        reference[:] = sorted(self.s.memory.copy())
        return True

    def storage_valid(self):
        return heap_order_valid(self.s.memory.copy())

    def execution_problems(self):
        return [] if self.storage_valid() else ["min-heap order"]

    def structural_checks(self, check):
        check("Min-heap ordering", True, self.storage_valid())


def audit_hash(buckets, size):
    """Physical placement checked with the STUDENT'S hash function. Not a
    student traversal: nothing is recorded meanwhile."""
    previous = sandbox.active()
    sandbox.set_active(None)
    try:
        seen, keys, values, lengths = set(), set(), [], []
        acyclic = placement = unique = True
        for i, cursor in enumerate(buckets.heads):
            length = 0
            while cursor is not None:
                if cursor._id in seen:
                    acyclic = False
                    break
                seen.add(cursor._id)
                key = cursor._value
                try:
                    if buckets.index_for(key) != i:
                        placement = False
                except Exception:  # noqa: BLE001 - an invariant failure
                    placement = False
                if key in keys:
                    unique = False
                keys.add(key)
                values.append(key)
                length += 1
                cursor = cursor._next
            lengths.append(length)
        return {
            "acyclic": acyclic, "placement": placement, "unique": unique,
            "sizeOk": size == len(values), "size": size, "capacity": len(buckets),
            "loadFactor": size / len(buckets), "lengths": lengths, "values": values,
        }
    finally:
        sandbox.set_active(previous)


class HashAdapter(Adapter):
    kind = "hash"
    recorder_class = HashRecorder
    standard_methods = frozenset({"insert", "remove", "contains", "isEmpty", "loadFactor"})
    unordered_contents = True

    def reset_ids(self):
        ListNode.reset_ids()

    def create_recorder(self, silent=False):
        recorder = HashRecorder(silent=silent)
        recorder.memory = lambda: self.s.buckets
        recorder.count = lambda: self.s.size
        return recorder

    def audit(self):
        return audit_hash(self.s.buckets, self.s.size)

    def expected_return(self, name, args):
        value = args[-1] if args and isinstance(args[-1], int) and not isinstance(args[-1], bool) else None
        if name == "insert":
            return value not in self.reference
        if name == "loadFactor":
            return len(self.reference) / len(self.s.buckets)
        return super().expected_return(name, args)

    def return_matches(self, name, expected, returned):
        if name == "loadFactor":
            return (isinstance(returned, (int, float)) and not isinstance(returned, bool)
                    and isinstance(expected, (int, float)) and abs(returned - expected) < 0.0000001)
        return same(expected, returned)

    def actual_values(self):
        return self.audit()["values"]

    def update_reference(self, name, args, returned):
        value = _single_int(args)
        reference = self.reference
        if name == "insert" and value is not None:
            expected = value not in reference
            if expected:
                reference.append(value)
            return same(returned, expected)
        if name == "remove" and value is not None:
            expected = value in reference
            if expected:
                reference.remove(value)
            return same(returned, expected)
        if name == "contains" and value is not None:
            return same(returned, value in reference)
        if name == "isEmpty":
            return same(returned, not reference)
        if name == "loadFactor":
            return (isinstance(returned, (int, float)) and not isinstance(returned, bool)
                    and abs(returned - self.s.size / len(self.s.buckets)) < 0.0000001)
        reference[:] = self.actual_values()
        return True

    def execution_problems(self):
        audit = self.audit()
        faults = [
            label for key, label in (
                ("acyclic", "cycle/shared node"),
                ("placement", "wrong bucket"),
                ("unique", "duplicate keys"),
                ("sizeOk", "stored size"),
            ) if audit[key] is not True
        ]
        return [f"hash: {', '.join(faults)}"] if faults else []

    def structural_checks(self, check):
        audit = self.audit()
        check("Acyclic chains", True, audit["acyclic"])
        check("Bucket placement", True, audit["placement"])
        check("Unique keys", True, audit["unique"])
        check("Stored size", len(self.reference), self.s.size)
        check("Hash table storage", True, audit["sizeOk"])


ADAPTERS = {
    "unsorted_array_list": lambda create: ArrayListAdapter(create, False),
    "sorted_array_list": lambda create: ArrayListAdapter(create, True),
    "unsorted_linked_list": lambda create: LinkedListAdapter(create, False),
    "sorted_linked_list": lambda create: LinkedListAdapter(create, True),
    "tree": lambda create: TreeAdapter(create, False),
    "avl": lambda create: TreeAdapter(create, True),
    "stack": ArrayStackAdapter,
    "linked_stack": LinkedStackAdapter,
    "linked_queue": LinkedQueueAdapter,
    "array_queue": ArrayQueueAdapter,
    "array_heap": ArrayHeapAdapter,
    "hash": HashAdapter,
}


# ------------------------------------------------------------ method discovery

_SUPPORTED = {int: "int", float: "double", bool: "bool", str: "String"}


def _annotation_type(annotation):
    if annotation is inspect.Parameter.empty:
        return None
    if annotation in _SUPPORTED:
        return _SUPPORTED[annotation]
    if isinstance(annotation, str):
        return {"int": "int", "float": "double", "bool": "bool", "str": "String"}.get(annotation, "?")
    return "?"


def _return_type(annotation):
    if annotation is inspect.Signature.empty:
        return "dynamic"
    text = annotation if isinstance(annotation, str) else getattr(annotation, "__name__", None) or str(annotation)
    text = str(text).replace("typing.", "").replace(" ", "")
    if annotation is None or text in ("None", "NoneType"):
        return "void"
    mapping = {"int": "int", "bool": "bool", "float": "double", "str": "String",
               "int|None": "int?", "None|int": "int?", "Optional[int]": "int?"}
    return mapping.get(text, "dynamic")


def discover_methods(cls, adapter, path):
    """The public methods with scalar parameters, named as in the classroom
    contract (is_empty → isEmpty). Standard methods with the right number of
    parameters get the contract's types, so only the arity is checked."""
    methods = []
    for python_name, function in cls.__dict__.items():
        if python_name.startswith("_") or not inspect.isfunction(function):
            continue
        try:
            signature = inspect.signature(function)
        except (TypeError, ValueError):
            continue
        parameters = list(signature.parameters.values())[1:]  # without self
        if any(p.kind not in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD) or p.default is not p.empty
               for p in parameters):
            continue
        types = [_annotation_type(p.annotation) or "int" for p in parameters]
        if "?" in types:
            continue
        name = snake_to_camel(python_name)
        returns = _return_type(signature.return_annotation)
        if name in adapter.standard_methods:
            required = adapter.required_method_signature(name)
            required_returns, rest = required.split(" ", 1)
            required_params = rest[rest.index("(") + 1:-1]
            required_types = [t.strip() for t in required_params.split(",")] if required_params else []
            if len(required_types) == len(parameters):
                types, returns = required_types, required_returns
        line = function.__code__.co_firstlineno
        methods.append({
            "name": name,
            "params": [{"name": p.name, "type": t, "named": False} for p, t in zip(parameters, types)],
            "returns": returns,
            "python": python_name,
            "line": line,
        })
    return methods


# -------------------------------------------------------------------- tracing


class Tracer:
    """sys.settrace for the student's file: every executed line becomes a
    `line` event of the active recorder (like trace.atLine in the Dart copy),
    entering a function records its def line, and node-typed local variables
    become `variableWrite` events after the statement that assigned them."""

    def __init__(self, path, node_types, node_variables):
        self.path = path
        self.node_types = node_types
        # Function name → local names declared as nodes (annotations), which
        # are reported even while they are None.
        self.node_variables = node_variables
        self.frames = {}

    def calls(self, frame, event, arg):
        if frame.f_code.co_filename != self.path:
            return None
        recorder = sandbox.active()
        if recorder is not None and event == "call":
            recorder.at_line(frame.f_code.co_firstlineno)
            self.frames[id(frame)] = self._node_locals(frame, initial=True)
        return self.lines

    def lines(self, frame, event, arg):
        recorder = sandbox.active()
        if recorder is None:
            return self.lines
        if event == "line":
            self._references(frame, recorder)
            recorder.at_line(frame.f_lineno)
        elif event == "return":
            self._references(frame, recorder)
            self.frames.pop(id(frame), None)
        return self.lines

    def _node_locals(self, frame, initial=False):
        code = frame.f_code
        parameters = set(code.co_varnames[:code.co_argcount + code.co_kwonlyargcount])
        declared = self.node_variables.get(code.co_name, ())
        result = {}
        for name, value in dict(frame.f_locals).items():
            if name in parameters or name == "self":
                continue
            if isinstance(value, self.node_types):
                result[name] = value._id
            elif value is None and name in declared:
                result[name] = None
        return result

    def _references(self, frame, recorder):
        if not hasattr(recorder, "reference"):
            return
        before = self.frames.get(id(frame), {})
        now = self._node_locals(frame)
        for name, node_id in now.items():
            if name not in before or before[name] != node_id:
                recorder.steps.append(
                    {"kind": "variableWrite", "name": name, "to": node_id, "line": recorder.source_line}
                )
        self.frames[id(frame)] = now


def node_variable_names(source):
    """Local names annotated with ListNode / TreeNode in each function."""
    result = {}
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return result
    for function in ast.walk(tree):
        if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        names = set()
        for node in ast.walk(function):
            if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                if "Node" in ast.unparse(node.annotation):
                    names.add(node.target.id)
        result.setdefault(function.name, set()).update(names)
    return result


def install_field_hooks(cls, adapter):
    """`self.top = …`, `self.size += 1`, `self.head = …` in student methods
    become indexWrite / pointerWrite events, as the Dart instrumenter does."""
    index_fields = set(adapter.index_fields)
    pointer_fields = set(adapter.pointer_fields)
    if not index_fields and not pointer_fields:
        return
    original = cls.__setattr__

    def traced(self, name, value):
        recorder = sandbox.active()
        if recorder is None or self is not adapter.instance or (name not in index_fields and name not in pointer_fields):
            original(self, name, value)
            return
        before = getattr(self, name, None)
        original(self, name, value)
        if name in index_fields:
            recorder.index_write(name, before, value)
        else:
            recorder.pointer_write(f"root:{name}", before, value)

    cls.__setattr__ = traced


# -------------------------------------------------------------------- session


class Session:
    def __init__(self, build_directory):
        with open(os.path.join(build_directory, "build.json"), encoding="utf-8") as file:
            build = json.load(file)
        self.kind = build["kind"]
        self.source_path = build["sourcePath"]
        self.copy_path = os.path.abspath(os.path.join(build_directory, "algorithm.py"))
        with open(self.copy_path, encoding="utf-8") as file:
            source = file.read()
        self.lines = source.split("\n")
        if self.lines and self.lines[-1] == "":
            self.lines.pop()
        self.session_id = str(int(time.time() * 1000000))

        spec = importlib.util.spec_from_file_location("student", self.copy_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules["student"] = module
        spec.loader.exec_module(module)
        cls = getattr(module, build["className"])
        self.adapter = ADAPTERS[self.kind](cls)
        self.methods = discover_methods(cls, self.adapter, self.copy_path)
        install_field_hooks(cls, self.adapter)
        node_types = (TreeNode,) if self.adapter.recorder_class is TreeRecorder else (ListNode,)
        uses_nodes = self.adapter.recorder_class in (Recorder, HashRecorder, TreeRecorder)
        self.tracer = Tracer(self.copy_path, node_types if uses_nodes else (), node_variable_names(source)
                             if uses_nodes else {})
        self.adapter.reset()

    @property
    def reference(self):
        return self.adapter.reference

    def initial(self):
        return self.envelope([self.adapter.create_recorder().snapshot()])

    def envelope(self, steps):
        return {
            "type": "trace",
            "structure": self.kind,
            "sessionId": f"{self.kind}:{self.session_id}",
            "source": {"file": self.source_path, "lines": self.lines},
            "steps": list(steps),
            "values": list(self.reference),
            "methods": [
                {key: method[key] for key in ("name", "params", "returns")} for method in self.methods
            ],
            "capacity": self.adapter.capacity,
        }

    def descriptor(self, name):
        for method in self.methods:
            if method["name"] == name:
                return method
        raise RequestError(f"Unknown method: {name}")

    @staticmethod
    def scalar(raw, kind):
        if kind == "int" and isinstance(raw, int) and not isinstance(raw, bool) and abs(raw) <= MAX_VALUE:
            return raw
        if kind == "double" and isinstance(raw, (int, float)) and not isinstance(raw, bool) and math.isfinite(raw):
            return float(raw)
        if kind == "bool" and isinstance(raw, bool):
            return raw
        if kind == "String" and isinstance(raw, str) and len(raw) <= 256:
            return raw
        raise RequestError(f"Invalid {kind} argument (integer range: -999…999).")

    def plan(self, message):
        if message.get("action") != "run":
            raise RequestError("Unknown command.")

        def checked_call(name, args):
            params = self.descriptor(name)["params"]
            if len(args) != len(params):
                raise RequestError("Wrong number of arguments.")
            return {"method": name, "args": [self.scalar(a, p["type"]) for a, p in zip(args, params)]}

        sequence = message.get("commands")
        if isinstance(sequence, list):
            if not sequence or len(sequence) > MAX_OPERATIONS:
                raise RequestError(f"Use 1–{MAX_OPERATIONS} calls.")
            calls = []
            for command in sequence:
                if isinstance(command, dict) and isinstance(command.get("method"), str) and isinstance(command.get("arguments"), list):
                    calls.append(checked_call(command["method"], command["arguments"]))
                else:
                    raise RequestError("Invalid command in sequence.")
            return calls
        name = message.get("method")
        if not isinstance(name, str):
            raise RequestError("Supply the method arguments.")
        params = self.descriptor(name)["params"]
        raw, legacy = message.get("arguments"), message.get("values")
        if isinstance(raw, list):
            return [checked_call(name, raw)]
        if isinstance(legacy, list) and len(params) == 1 and params[0]["type"] == "int":
            if not legacy or len(legacy) > MAX_OPERATIONS:
                raise RequestError(f"Use 1–{MAX_OPERATIONS} calls.")
            return [checked_call(name, [value]) for value in legacy]
        raise RequestError("Supply the method arguments.")

    def invoke(self, name, args):
        method = self.descriptor(name)
        result = getattr(self.adapter.instance, method["python"])(*args)
        return None if method["returns"] == "void" else result

    def invoke_recorded(self, recorder, name, args):
        sandbox.set_active(recorder)
        sys.settrace(self.tracer.calls)
        try:
            return self.invoke(name, args)
        finally:
            sys.settrace(None)
            sandbox.set_active(None)
            self.tracer.frames.clear()

    def validate_call(self, message):
        name = message.get("method")
        declared = self.descriptor(name)
        params = declared["params"]
        raw = message.get("arguments")
        if not isinstance(raw, list) or len(raw) != len(params):
            raise RequestError("Wrong number of test arguments.")
        required = self.adapter.required_method_signature(name)
        declared_args = ", ".join(("named " if p["named"] else "") + p["type"] for p in params)
        declared_signature = f"{declared['returns']} {name}({declared_args})"
        if required != declared_signature:
            return {
                "type": "validationCall", "ok": False, "notExecuted": True,
                "expectedContents": list(self.reference),
                "actualContents": self.adapter.actual_values(),
                "checks": [{"aspect": "Method signature", "expected": required, "actual": declared_signature}],
                "message": "Method signature",
            }
        args = [self.scalar(raw[i], params[i]["type"]) for i in range(len(raw))]
        expected = self.adapter.expected_return(name, args)
        # The instrumented student method expects an active recorder; this one
        # is disposable and never interpreted as a test result.
        returned = self.invoke_recorded(self.adapter.create_recorder(), name, args)
        self.adapter.update_reference(name, args, returned)
        expected_contents = list(self.reference)
        actual_contents = self.adapter.actual_values()
        issues = []

        def check(aspect, wanted, observed, passed=None):
            if not (passed if passed is not None else same(wanted, observed)):
                issues.append({"aspect": aspect, "expected": wanted, "actual": observed})

        check("Return value", expected, returned, self.adapter.return_matches(name, expected, returned))
        unordered = self.adapter.unordered_contents
        compared_actual = list(actual_contents)
        compared_expected = list(expected_contents)
        if unordered:
            compared_actual.sort()
            compared_expected.sort()
        check("Contents", compared_expected, compared_actual,
              ",".join(map(str, compared_expected)) == ",".join(map(str, compared_actual)))
        self.adapter.structural_checks(check)
        result = {
            "type": "validationCall", "ok": not issues,
            "expectedReturn": expected, "actualReturn": json_value(returned),
            "returnIsVoid": declared["returns"] == "void",
            "expectedContents": compared_expected if unordered else expected_contents,
            "actualContents": compared_actual if unordered else actual_contents,
            "contentsComparedAsUnordered": unordered,
            "checks": issues,
        }
        if issues:
            result["message"] = ", ".join(issue["aspect"] for issue in issues)
        return result

    def execute(self, message):
        action = message.get("action")
        if action == "reset":
            self.adapter.reset()
            return self.initial()
        if action == "validateCall":
            return self.validate_call(message)
        commands = self.plan(message)
        from_empty = message.get("reset") is True
        if from_empty:
            self.adapter.reset()
        recorder = self.adapter.create_recorder()
        recorder.steps.append(recorder.snapshot())
        completed = 0
        stopped_early = False
        for command in commands:
            completed += 1
            name, args = command["method"], command["args"]
            recorder.begin(name, args, self.descriptor(name)["line"])
            try:
                result = self.invoke_recorded(recorder, name, args)
            except Exception as error:  # noqa: BLE001 - reported to the student
                failure = self.runtime_failure(error)
                index = failure.get("traceIndex")
                if isinstance(index, int) and index >= len(recorder.steps) and recorder.steps:
                    failure["traceIndex"] = len(recorder.steps) - 1
                try:
                    recorder.steps.append({
                        "kind": "executionError", "message": failure["message"],
                        "line": failure.get("line", Diagnostics.current_line),
                    })
                except TraceLimitReached:
                    pass  # The failure metadata still carries the last line.
                return {**self.envelope(recorder.steps), "type": "executionError", "error": failure}
            result = json_value(result)
            adapter = self.adapter
            can_verify = name in adapter.standard_methods and (
                name in ("pop", "dequeue", "removeMin", "peek", "isEmpty", "isFull", "length")
                or (len(args) == 1 and isinstance(args[0], int))
                or (len(args) == 2 and all(isinstance(a, int) for a in args))
            )
            checked = adapter.update_reference(name, args, result)
            actual = list(adapter.actual_values())
            expected = list(self.reference)
            if adapter.unordered_contents:
                actual.sort()
                expected.sort()
            problems = adapter.execution_problems()
            ok = checked and ",".join(map(str, actual)) == ",".join(map(str, expected)) and not problems
            recorder.steps.append(recorder.snapshot())
            returns_void = self.descriptor(name)["returns"] == "void"
            label = f"{name}({', '.join(show(a) for a in args)})"
            if not ok:
                verdict = "CHECK FAILED" + "".join(f" ({problem})" for problem in problems)
            elif can_verify:
                verdict = "checked"
            else:
                verdict = "not automatically verified"
            text = f"{label} {'completed' if returns_void else '⇒ ' + show(result)} · {verdict}"
            recorder.end(result, ok, returns_void, text)
            if not ok:
                stopped_early = completed < len(commands)
                break
        return {
            **self.envelope(recorder.steps),
            "calls": {"planned": len(commands), "completed": completed,
                      "stoppedEarly": stopped_early, "fromEmpty": from_empty},
        }

    def runtime_failure(self, error):
        line = Diagnostics.current_line
        column = None
        frames = [frame for frame in traceback.extract_tb(error.__traceback__)
                  if frame.filename == self.copy_path]
        if frames:
            innermost = frames[-1]
            if line is None:
                line = innermost.lineno
            if getattr(innermost, "colno", None) is not None:
                column = innermost.colno + 1
        if isinstance(error, (RequestError, TraceLimitReached)):
            message = str(error)
        else:
            text = str(error)
            message = f"{type(error).__name__}: {text}" if text else type(error).__name__
        result = {"kind": "runtime", "message": message[:2000]}
        if line is not None:
            result["line"] = line
        if column is not None:
            result["column"] = column
        if Diagnostics.current_trace_index is not None:
            result["traceIndex"] = Diagnostics.current_trace_index
        if frames:
            name = os.path.basename(self.source_path)
            result["stack"] = [f"{frame.name} ({name}:{frame.lineno})" for frame in reversed(frames)][:8]
        return result


def json_value(value):
    """Return values as JSON: floats stay floats, anything else becomes text."""
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else str(value)
    return str(value)


# ------------------------------------------------------------------ main loop


class StudentOutput(io.TextIOBase):
    """print() of student code → studentOutput messages, bounded."""

    def __init__(self):
        super().__init__()
        self.pending = ""
        self.count = 0
        self.bytes = 0
        self.truncated = False

    def writable(self):
        return True

    def write(self, text):
        self.pending += str(text)
        while "\n" in self.pending:
            line, self.pending = self.pending.split("\n", 1)
            self.emit(line)
        return len(text)

    def finish(self):
        if self.pending:
            self.emit(self.pending)
            self.pending = ""

    def emit(self, text):
        size = len(text.encode("utf-8"))
        if self.count < 200 and self.bytes + size <= 65536:
            self.count += 1
            self.bytes += size
            kind = "stdout"
        elif not self.truncated:
            self.truncated = True
            kind, text = "warning", "Further print output was truncated."
        else:
            return
        post({"type": "studentOutput", "kind": kind, "text": text,
              "line": Diagnostics.current_line, "traceIndex": Diagnostics.current_trace_index})


def serve(build_directory):
    try:
        session = Session(build_directory)
    except Exception as error:  # noqa: BLE001 - e.g. an exception at import time
        failure = {"kind": "runtime", "message": f"{type(error).__name__}: {error}"}
        sys.stderr.write("".join(traceback.format_exception(error)))
        post({"type": "error", "error": failure, "message": failure["message"]})
        return
    post({"type": "hello", "trace": session.initial()})
    for raw in _protocol_in:
        if not raw.strip():
            continue
        Diagnostics.reset()
        output = StudentOutput()
        previous_stdout = sys.stdout
        try:
            message = json.loads(raw)
            if not isinstance(message, dict):
                raise RequestError("Invalid request")
            if message.get("action") == "ping":
                post({"type": "pong"})
                continue
            if message.get("_diagnostics") is True:
                last = [-1.0]

                def progress(line, trace_index):
                    now = time.monotonic()
                    if now - last[0] < 0.05:
                        return
                    last[0] = now
                    post({"type": "executionProgress", "line": line, "traceIndex": trace_index})

                Diagnostics.on_line = progress
            sys.stdout = output
            response = session.execute(message)
            output.finish()
            sys.stdout = previous_stdout
            post(response)
        except Exception as error:  # noqa: BLE001
            output.finish()
            sys.stdout = previous_stdout
            sys.stderr.write(f"Student execution failed: {error}\n")
            post({"type": "error", "error": session.runtime_failure(error), "message": str(error)})
        finally:
            sys.stdout = previous_stdout
            Diagnostics.on_line = None


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("usage: sandbox_worker.py BUILD_DIRECTORY\n")
        sys.exit(64)
    sys.setrecursionlimit(20000)
    try:
        threading.stack_size(512 * 1024 * 1024)
    except (ValueError, RuntimeError):
        pass
    thread = threading.Thread(target=serve, args=(sys.argv[1],), name="student")
    thread.start()
    thread.join()
    _protocol_out.flush()
    os._exit(0)


if __name__ == "__main__":
    main()
