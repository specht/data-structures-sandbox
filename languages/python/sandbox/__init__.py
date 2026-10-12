"""Observable storage for the Data Structure Sandbox (Python version).

These classes are storage, not solutions: students implement their data
structures in their own `My…` classes and use these building blocks. Every
read and write that matters for the visualization is recorded here; student
code calls no recorder.

    from sandbox import FixedMemory      # stacks
    from sandbox import ListMemory       # array lists
    from sandbox import QueueMemory      # circular queues
    from sandbox import HeapMemory       # array heaps
    from sandbox import ListNode         # linked lists, stacks, queues, hash chains
    from sandbox import TreeNode         # binary search trees, AVL trees
    from sandbox import HashBuckets      # hash tables

The recorders below mirror lib/*_sandbox.dart of the Dart version event by
event, so the browser receives the same traces from every language.
"""

__all__ = [
    "FixedMemory",
    "ListMemory",
    "QueueMemory",
    "HeapMemory",
    "ListNode",
    "TreeNode",
    "HashBuckets",
]

MAX_EVENTS = 4000


class TraceLimitReached(RuntimeError):
    pass


class Diagnostics:
    """The last traced line (for timeouts, errors and progress messages)."""

    current_line = None
    current_trace_index = None
    on_line = None

    @classmethod
    def reset(cls):
        cls.current_line = None
        cls.current_trace_index = None

    @classmethod
    def at_line(cls, line, trace_index):
        cls.current_line = line
        cls.current_trace_index = trace_index
        if cls.on_line is not None:
            cls.on_line(line, trace_index)


class EventLog(list):
    """A bounded trace: a runaway loop cannot exhaust the browser."""

    def append(self, event):
        if event.get("kind") == "line" and isinstance(event.get("line"), int):
            Diagnostics.at_line(event["line"], len(self))
        if len(self) >= MAX_EVENTS:
            raise TraceLimitReached(f"Trace limit reached ({MAX_EVENTS} events).")
        super().append(event)


class _Silent(list):
    def append(self, event):
        pass


# The recorder that the instrumented student code and the storage report to.
_active = None


def active():
    return _active


def set_active(recorder):
    global _active
    _active = recorder


def _index(cells, index, what="memory"):
    if isinstance(index, bool) or not isinstance(index, int):
        raise TypeError(f"Indices must be integers, not {type(index).__name__}.")
    if index < 0 or index >= len(cells):
        valid = "it is empty" if not cells else f"valid: 0 … {len(cells) - 1}"
        raise IndexError(f"Index {index} is out of range for {what} ({valid}).")
    return index


def _cell_value(value):
    if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
        raise TypeError(f"A cell holds an int or None, not {type(value).__name__}.")
    return value


# ------------------------------------------------------------- fixed memories


class _Cells:
    """Fixed-length cells holding int or None."""

    _recorder_class = None

    def __init__(self, capacity):
        if isinstance(capacity, bool) or not isinstance(capacity, int) or capacity <= 0:
            raise ValueError("The capacity must be a positive integer.")
        self._cells = [None] * capacity

    def __len__(self):
        return len(self._cells)

    @property
    def length(self):
        """The number of physical cells (the same as len(memory))."""
        return len(self._cells)

    def __getitem__(self, index):
        return self._cells[_index(self._cells, index)]

    def __setitem__(self, index, value):
        index = _index(self._cells, index)
        value = _cell_value(value)
        before = self._cells[index]
        self._cells[index] = value
        recorder = _active
        if isinstance(recorder, self._recorder_class):
            recorder.cell_write(index, before, value)

    def __iter__(self):
        raise TypeError("Read the cells one at a time: memory[i].")

    def copy(self):
        return list(self._cells)

    def __repr__(self):
        return f"{type(self).__name__}({len(self._cells)})"


class FixedMemory(_Cells):
    """Fixed cells for an array stack: memory[i], memory[i] = value or None."""


class ListMemory(_Cells):
    """Fixed cells for the array lists; the list class owns its `size`."""


class QueueMemory(_Cells):
    """Fixed cells plus the observable circular-queue markers front, rear
    (the NEXT free slot) and size."""

    def __init__(self, capacity):
        super().__init__(capacity)
        self._front = 0
        self._rear = 0
        self._size = 0

    def _marker(self, name, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"{name} must be an integer.")
        before = getattr(self, "_" + name)
        setattr(self, "_" + name, value)
        recorder = _active
        if isinstance(recorder, QueueRecorder):
            recorder.index_write(name, before, value)

    @property
    def front(self):
        return self._front

    @front.setter
    def front(self, value):
        self._marker("front", value)

    @property
    def rear(self):
        return self._rear

    @rear.setter
    def rear(self, value):
        self._marker("rear", value)

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._marker("size", value)


class HeapMemory:
    """Contiguous, growing storage for an array heap. The children of index i
    live at 2*i+1 and 2*i+2; there are no node objects."""

    def __init__(self):
        self._cells = []

    def __len__(self):
        return len(self._cells)

    @property
    def length(self):
        return len(self._cells)

    def is_empty(self):
        return not self._cells

    def __getitem__(self, index):
        value = self._cells[_index(self._cells, index, "the heap")]
        recorder = _active
        if isinstance(recorder, HeapRecorder):
            recorder.read(index, value)
        return value

    def __setitem__(self, index, value):
        index = _index(self._cells, index, "the heap")
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"A heap cell holds an int, not {type(value).__name__}.")
        before = self._cells[index]
        self._cells[index] = value
        recorder = _active
        if isinstance(recorder, HeapRecorder):
            recorder.change("heapWrite", {"index": index, "oldValue": before, "value": value})

    def append(self, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"A heap cell holds an int, not {type(value).__name__}.")
        self._cells.append(value)
        recorder = _active
        if isinstance(recorder, HeapRecorder):
            recorder.change("heapAppend", {"index": len(self._cells) - 1, "value": value})

    def pop(self):
        """Removes and returns the last cell."""
        if not self._cells:
            raise IndexError("pop from an empty heap")
        index = len(self._cells) - 1
        value = self._cells.pop()
        recorder = _active
        if isinstance(recorder, HeapRecorder):
            recorder.change("heapRemove", {"index": index, "value": value})
        return value

    def swap(self, a, b):
        a = _index(self._cells, a, "the heap")
        b = _index(self._cells, b, "the heap")
        if a == b:
            return
        old_a, old_b = self._cells[a], self._cells[b]
        self._cells[a], self._cells[b] = old_b, old_a
        recorder = _active
        if isinstance(recorder, HeapRecorder):
            recorder.change("heapSwap", {"a": a, "b": b, "oldA": old_a, "oldB": old_b})

    def __iter__(self):
        raise TypeError("Read the cells one at a time: memory[i].")

    def copy(self):
        return list(self._cells)

    def __repr__(self):
        return f"HeapMemory({len(self._cells)})"


def heap_order_valid(values):
    return all(values[(i - 1) // 2] <= values[i] for i in range(1, len(values)))


# ---------------------------------------------------------------------- nodes


class ListNode:
    """A node of a singly linked chain: node.value and node.next."""

    _next_id = 0
    registry = {}

    @classmethod
    def reset_ids(cls):
        cls._next_id = 0
        cls.registry.clear()

    def __init__(self, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"A ListNode holds an int, not {type(value).__name__}.")
        ListNode._next_id += 1
        self._id = ListNode._next_id
        self._value = value
        self._next = None
        recorder = _active
        if isinstance(recorder, Recorder):
            recorder.create_node(self)

    @property
    def id(self):
        return self._id

    @property
    def value(self):
        recorder = _active
        if isinstance(recorder, Recorder):
            recorder.visit(self)
        return self._value

    @value.setter
    def value(self, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"A ListNode holds an int, not {type(value).__name__}.")
        self._value = value

    @property
    def next(self):
        return self._next

    @next.setter
    def next(self, target):
        if target is not None and not isinstance(target, ListNode):
            raise TypeError(f"next must be a ListNode or None, not {type(target).__name__}.")
        before = self._next
        self._next = target
        recorder = _active
        if isinstance(recorder, Recorder):
            recorder.pointer_write(f"node:{self._id}.next", before, target)

    def __repr__(self):
        return f"ListNode({self._value})"


class TreeNode:
    """A binary tree node: value, left, right and height (a leaf has height 1)."""

    _next_id = 0
    registry = {}

    @classmethod
    def reset_ids(cls):
        cls._next_id = 0
        cls.registry.clear()

    def __init__(self, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"A TreeNode holds an int, not {type(value).__name__}.")
        TreeNode._next_id += 1
        self._id = TreeNode._next_id
        self._value = value
        self._height = 1
        self._left = None
        self._right = None
        recorder = _active
        if isinstance(recorder, TreeRecorder):
            recorder.create_node(self)

    @property
    def id(self):
        return self._id

    @property
    def value(self):
        recorder = _active
        if isinstance(recorder, TreeRecorder):
            recorder.visit(self)
        return self._value

    @value.setter
    def value(self, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"A TreeNode holds an int, not {type(value).__name__}.")
        self._value = value
        recorder = _active
        if isinstance(recorder, TreeRecorder):
            recorder.value_write(self)

    @property
    def height(self):
        return self._height

    @height.setter
    def height(self, value):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"height must be an int, not {type(value).__name__}.")
        before = self._height
        self._height = value
        recorder = _active
        if isinstance(recorder, TreeRecorder):
            recorder.height_write(self, before, value)

    def _link(self, side, target):
        if target is not None and not isinstance(target, TreeNode):
            raise TypeError(f"{side} must be a TreeNode or None, not {type(target).__name__}.")
        before = getattr(self, "_" + side)
        setattr(self, "_" + side, target)
        recorder = _active
        if isinstance(recorder, TreeRecorder):
            recorder.pointer_write(f"node:{self._id}.{side}", before, target)

    @property
    def left(self):
        return self._left

    @left.setter
    def left(self, target):
        self._link("left", target)

    @property
    def right(self):
        return self._right

    @right.setter
    def right(self, target):
        self._link("right", target)

    def __repr__(self):
        return f"TreeNode({self._value})"


class HashBuckets:
    """The buckets of a hash table with separate chaining. The student chooses
    the bucket count and the hash function hash(key, capacity) -> index."""

    def __init__(self, capacity, hash_function):
        if isinstance(capacity, bool) or not isinstance(capacity, int) or capacity < 1:
            raise ValueError("A hash table needs at least one bucket.")
        if not callable(hash_function):
            raise TypeError("The second argument must be the hash function.")
        self._cells = [None] * capacity
        self._hash = hash_function

    def __len__(self):
        return len(self._cells)

    @property
    def length(self):
        return len(self._cells)

    def index_for(self, key):
        index = self._hash(key, len(self._cells))
        if isinstance(index, bool) or not isinstance(index, int) or not 0 <= index < len(self._cells):
            raise IndexError(
                f"hash({key}) returned {index!r}; the student hash function must "
                f"return a valid bucket index 0 … {len(self._cells) - 1}."
            )
        return index

    def __getitem__(self, index):
        value = self._cells[_index(self._cells, index, "the buckets")]
        recorder = _active
        if isinstance(recorder, HashRecorder):
            recorder.bucket_read(index, value)
        return value

    def __setitem__(self, index, value):
        index = _index(self._cells, index, "the buckets")
        if value is not None and not isinstance(value, ListNode):
            raise TypeError(f"A bucket holds a ListNode or None, not {type(value).__name__}.")
        before = self._cells[index]
        self._cells[index] = value
        recorder = _active
        if isinstance(recorder, HashRecorder):
            recorder.bucket_write(index, before, value)

    def __iter__(self):
        raise TypeError("Read the buckets one at a time: buckets[i].")

    @property
    def heads(self):
        return tuple(self._cells)

    def __repr__(self):
        return f"HashBuckets({len(self._cells)})"


def _id(node):
    return None if node is None else node._id


# ------------------------------------------------------------------ recorders
# One per storage family, exactly like the Dart recorders.


class _Base:
    def __init__(self, lines=None, silent=False):
        self.steps = _Silent() if silent else EventLog()
        self.source_line = 0

    def at_line(self, line):
        self.source_line = line
        self.steps.append({"kind": "line", "line": line})

    def begin(self, name, args, line=0):
        self.steps.append(
            {"kind": "operationStart", "operation": f"{name}({', '.join(_show(a) for a in args)})", "line": 0}
        )

    def index_write(self, name, before, after):
        self.steps.append(
            {"kind": "indexWrite", "name": name, "oldValue": before, "value": after, "line": self.source_line}
        )
        self.steps.append(self.snapshot())

    def end(self, value, ok, returned_void=False, message=None):
        self.steps.append(
            {
                "kind": "operationEnd",
                "value": value,
                "returnedVoid": returned_void,
                "ok": ok,
                "result": message if message is not None else f"Result: {_show(value)}",
                "line": 0,
            }
        )


def _show(value):
    """Like Dart's toString in messages: null, true/false, 0.5."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


class Recorder(_Base):
    """Linked chains (lists, linked stack and queue): lib/sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.root = None  # callables reading the student's object
        self.tail = None
        self.size = None
        self.method_line = 0

    def begin(self, name, args, line=0):
        self.source_line = line
        self.steps.append(
            {
                "kind": "operationStart",
                "operation": f"{name}({', '.join(_show(a) for a in args)})",
                "description": "Executing the student method.",
                "line": line,
            }
        )

    def reference(self, name, node):
        self.steps.append({"kind": "variableWrite", "name": name, "to": _id(node), "line": self.source_line})

    def visit(self, node):
        self.steps.append({"kind": "visit", "id": node._id, "line": self.source_line})

    def create_node(self, node):
        ListNode.registry[node._id] = node
        self.steps.append(
            {"kind": "createNode", "node": {"id": node._id, "value": node._value, "next": None}, "line": self.source_line}
        )

    def pointer_write(self, source, before, after):
        self.steps.append(
            {"kind": "pointerWrite", "from": source, "oldTo": _id(before), "to": _id(after), "line": self.source_line}
        )
        self.steps.append(self.snapshot())

    def snapshot(self):
        result = {"kind": "snapshot", "head": _id(self.root() if self.root else None)}
        if self.tail is not None:
            result["tail"] = _id(self.tail())
        if self.size is not None:
            result["size"] = self.size()
        result["nodes"] = [
            {"id": node._id, "value": node._value, "next": _id(node._next)}
            for node in ListNode.registry.values()
        ]
        return result

    def _alive(self):
        alive = set()
        cursor = self.root() if self.root else None
        while cursor is not None and cursor._id not in alive:
            alive.add(cursor._id)
            cursor = cursor._next
        return alive

    def end(self, value, ok, returned_void=False, message=None):
        self.steps.append({"kind": "localsClear", "line": self.source_line})
        # The registry observes, it does not own: nodes no longer reachable
        # from head retire (their ids stay valid in earlier steps).
        alive = self._alive()
        retired = [node_id for node_id in ListNode.registry if node_id not in alive]
        if retired:
            self.steps.append({"kind": "retire", "ids": retired, "line": 0})
            for node_id in retired:
                del ListNode.registry[node_id]
            self.steps.append(self.snapshot())
        self.steps.append(
            {
                "kind": "operationEnd",
                "ok": ok,
                "value": value,
                "returnedVoid": returned_void,
                "result": message if message is not None else f"{'✓' if ok else '✗'} Result: {_show(value)}",
                "line": self.source_line,
            }
        )


class HashRecorder(Recorder):
    """Hash tables: lib/hash_sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.memory = None
        self.count = None

    def bucket_read(self, index, target):
        self.steps.append({"kind": "bucketRead", "index": index, "to": _id(target), "line": self.source_line})

    def bucket_write(self, index, before, after):
        self.steps.append(
            {"kind": "bucketWrite", "index": index, "oldTo": _id(before), "to": _id(after), "line": self.source_line}
        )
        self.steps.append(self.snapshot())

    def snapshot(self):
        result = super().snapshot()
        buckets = self.memory() if self.memory else None
        heads = buckets.heads if buckets is not None else ()
        result["buckets"] = [_id(head) for head in heads]
        result["size"] = self.count() if self.count else 0
        result["capacity"] = len(heads)
        return result

    def _alive(self):
        alive = set()
        buckets = self.memory() if self.memory else None
        for start in buckets.heads if buckets is not None else ():
            cursor = start
            while cursor is not None and cursor._id not in alive:
                alive.add(cursor._id)
                cursor = cursor._next
        return alive


class TreeRecorder(_Base):
    """Binary search and AVL trees: lib/tree_sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.root = None
        self.avl = False

    def reference(self, name, node):
        self.steps.append({"kind": "variableWrite", "name": name, "to": _id(node), "line": self.source_line})

    def visit(self, node):
        self.steps.append({"kind": "visit", "id": node._id, "line": self.source_line})

    def create_node(self, node):
        TreeNode.registry[node._id] = node
        self.steps.append(
            {
                "kind": "createNode",
                "node": {"id": node._id, "value": node._value, "height": node._height},
                "line": self.source_line,
            }
        )

    def value_write(self, node):
        self.steps.append(self.snapshot())

    def height_write(self, node, before, after):
        self.steps.append({"kind": "heightWrite", "id": node._id, "before": before, "to": after, "line": self.source_line})
        self.steps.append(self.snapshot())

    def pointer_write(self, source, before, after):
        self.steps.append(
            {"kind": "pointerWrite", "from": source, "oldTo": _id(before), "to": _id(after), "line": self.source_line}
        )
        self.steps.append(self.snapshot())

    def snapshot(self):
        root = self.root() if self.root else None
        result = {
            "kind": "snapshot",
            "root": _id(root),
            "nodes": [
                {
                    "id": node._id,
                    "value": node._value,
                    "left": _id(node._left),
                    "right": _id(node._right),
                    "height": node._height,
                }
                for node in TreeNode.registry.values()
            ],
        }
        if self.avl:
            result["avl"] = audit_avl(root)
        return result

    def end(self, value, ok, returned_void=False, message=None):
        alive = set()
        pending = [self.root() if self.root else None]
        while pending:
            node = pending.pop()
            if node is None or node._id in alive:
                continue
            alive.add(node._id)
            pending.append(node._left)
            pending.append(node._right)
        retired = [node_id for node_id in TreeNode.registry if node_id not in alive]
        if retired:
            self.steps.append({"kind": "retire", "ids": retired, "line": 0})
            for node_id in retired:
                del TreeNode.registry[node_id]
            self.steps.append(self.snapshot())
        super().end(value, ok, returned_void, message)


def audit_avl(root):
    """True heights from the pointer graph, independent of stored heights;
    cycle-safe and iterative (student trees may be deep)."""
    calculated = {}
    details = {}
    seen = set()
    acyclic = ordered = heights = balanced = True
    pending = [] if root is None else [(root, False, None, None)]
    while pending:
        node, done, low, high = pending.pop()
        if not done:
            if node._id in seen:
                acyclic = False
                continue
            seen.add(node._id)
            if (low is not None and node._value <= low) or (high is not None and node._value >= high):
                ordered = False
            pending.append((node, True, low, high))
            if node._right is not None:
                pending.append((node._right, False, node._value, high))
            if node._left is not None:
                pending.append((node._left, False, low, node._value))
            continue
        left, right = node._left, node._right
        if (left is not None and left._id not in calculated) or (right is not None and right._id not in calculated):
            acyclic = False
        lh = 0 if left is None else calculated.get(left._id, 0)
        rh = 0 if right is None else calculated.get(right._id, 0)
        expected = 1 + max(lh, rh)
        balance = lh - rh
        height_ok = node._height == expected
        balance_ok = abs(balance) <= 1
        if not height_ok:
            heights = False
        if not balance_ok:
            balanced = False
        calculated[node._id] = expected
        details[str(node._id)] = {
            "height": node._height,
            "expectedHeight": expected,
            "balance": balance,
            "heightOk": height_ok,
            "balanceOk": balance_ok,
        }
    return {"acyclic": acyclic, "ordered": ordered, "heights": heights, "balanced": balanced, "nodes": details}


class StackRecorder(_Base):
    """Fixed-array stack: lib/stack_sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.memory = None
        self.top = None

    def cell_write(self, index, before, value):
        self.steps.append({"kind": "cellWrite", "index": index, "oldValue": before, "value": value, "line": self.source_line})
        self.steps.append(self.snapshot())

    def snapshot(self):
        return {
            "kind": "snapshot",
            "cells": self.memory().copy() if self.memory else [],
            "top": self.top() if self.top else -1,
        }


FixedMemory._recorder_class = StackRecorder


class ListRecorder(_Base):
    """Array lists: lib/list_sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.memory = None
        self.size = None

    def cell_write(self, index, before, value):
        self.steps.append({"kind": "cellWrite", "index": index, "oldValue": before, "value": value, "line": self.source_line})
        self.steps.append(self.snapshot())

    def snapshot(self):
        return {
            "kind": "snapshot",
            "cells": self.memory().copy() if self.memory else [],
            "size": self.size() if self.size else 0,
        }


ListMemory._recorder_class = ListRecorder


class QueueRecorder(_Base):
    """Circular array queue: lib/queue_sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.memory = None

    def cell_write(self, index, before, value):
        self.steps.append({"kind": "cellWrite", "index": index, "oldValue": before, "value": value, "line": self.source_line})
        self.steps.append(self.snapshot())

    def snapshot(self):
        memory = self.memory() if self.memory else None
        return {
            "kind": "snapshot",
            "cells": memory.copy() if memory is not None else [],
            "front": memory._front if memory is not None else 0,
            "rear": memory._rear if memory is not None else 0,
            "size": memory._size if memory is not None else 0,
        }


QueueMemory._recorder_class = QueueRecorder


class HeapRecorder(_Base):
    """Array min-heap: lib/heap_sandbox.dart."""

    def __init__(self, lines=None, silent=False):
        super().__init__(lines, silent)
        self.memory = None

    def read(self, index, value):
        self.steps.append({"kind": "heapRead", "index": index, "value": value, "line": self.source_line})

    def change(self, kind, fields):
        self.steps.append({"kind": kind, **fields, "line": self.source_line})
        self.steps.append(self.snapshot())

    def snapshot(self):
        cells = self.memory().copy() if self.memory else []
        return {"kind": "snapshot", "cells": cells, "size": len(cells), "heapOrder": heap_order_valid(cells)}
