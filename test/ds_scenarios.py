"""The validation scenarios of tool/student_validation.dart, as data.

Used by test/language_workers_test.py to drive the Python, JavaScript and Java
workers exactly like the host's test runner drives the Dart worker. Keep in
sync with tool/student_validation.dart.
"""

STRUCTURES = {
    # kind: (file stem, class name)
    "unsorted_array_list": ("my_unsorted_array_list", "MyUnsortedArrayList"),
    "unsorted_linked_list": ("my_unsorted_linked_list", "MyUnsortedLinkedList"),
    "sorted_array_list": ("my_sorted_array_list", "MySortedArrayList"),
    "sorted_linked_list": ("my_sorted_linked_list", "MySortedLinkedList"),
    "tree": ("my_bst", "MyBST"),
    "avl": ("my_avl", "MyAVL"),
    "stack": ("my_array_stack", "MyArrayStack"),
    "linked_stack": ("my_linked_stack", "MyLinkedStack"),
    "linked_queue": ("my_linked_queue", "MyLinkedQueue"),
    "array_queue": ("my_array_queue", "MyArrayQueue"),
    "array_heap": ("my_array_heap", "MyArrayHeap"),
    "hash": ("my_hash_table", "MyHashTable"),
}


def c(method, value=None, second=None):
    return (method, [v for v in (value, second) if v is not None])


def cases(kind):
    if kind in ("stack", "linked_stack"):
        result = [
            ("Empty stack", [c("isEmpty"), c("peek"), c("pop"), c("isEmpty")]),
            ("Push, peek and pop", [c("push", 12), c("isEmpty"), c("peek"), c("pop"), c("isEmpty")]),
            ("LIFO order and duplicates", [c("push", 3), c("push", 3), c("push", 7), c("peek"), c("pop"), c("pop"), c("pop"), c("pop")]),
            ("Empty and refill", [c("push", 1), c("pop"), c("push", 42), c("peek"), c("pop"), c("isEmpty"), c("push", -5), c("peek")]),
            ("Repeated operations", [c("push", -1), c("push", 0), c("push", 99), c("pop"), c("peek"), c("push", -3), c("pop"), c("pop"), c("pop"), c("isEmpty")]),
        ]
        if kind == "stack":
            result.append(("Fixed capacity and reuse", [*[c("push", i) for i in range(1, 9)], c("push", 9), c("peek"),
                                                         c("pop"), c("push", 9), c("peek"), c("isEmpty")]))
        else:
            result.append(("Linked stack beyond eight elements", [*[c("push", i) for i in range(12)], c("peek"),
                                                                   *[c("pop") for _ in range(12)], c("isEmpty")]))
        return result
    if kind in ("array_queue", "linked_queue"):
        result = [
            ("Empty queue", [c("isEmpty"), c("peek"), c("dequeue"), c("isEmpty"), *([c("isFull")] if kind == "array_queue" else [])]),
            ("FIFO order", [c("enqueue", 12), c("enqueue", 20), c("peek"), c("dequeue"), c("peek"), c("dequeue"), c("isEmpty")]),
            ("Duplicates and empty refill", [c("enqueue", 4), c("enqueue", 4), c("dequeue"), c("dequeue"), c("dequeue"), c("enqueue", -3), c("peek"), c("isEmpty")]),
            ("Mixed operations", [c("enqueue", 1), c("enqueue", 2), c("dequeue"), c("enqueue", 3), c("peek"), c("dequeue"), c("enqueue", 4), c("dequeue"), c("dequeue"), c("isEmpty")]),
        ]
        if kind == "array_queue":
            result += [
                ("Full queue and rejection", [*[c("enqueue", i) for i in range(1, 9)], c("isFull"), c("enqueue", 9), c("peek"), c("dequeue"), c("isFull")]),
                ("Circular wraparound", [*[c("enqueue", i) for i in range(1, 9)], *[c("dequeue") for _ in range(3)],
                                         *[c("enqueue", i) for i in range(9, 12)], c("isFull"), *[c("dequeue") for _ in range(8)], c("isEmpty")]),
            ]
        else:
            result.append(("Linked queue beyond eight elements", [*[c("enqueue", i) for i in range(12)], c("peek"),
                                                                   *[c("dequeue") for _ in range(12)], c("isEmpty")]))
        return result
    if kind in ("unsorted_array_list", "unsorted_linked_list"):
        result = [
            ("Empty list and invalid indices", [c("length"), c("get", 0), c("get", -1), c("removeAt", 0), c("insert", -1, 4), c("insert", 1, 4), c("length")]),
            ("Insert at beginning, middle and end", [c("insert", 0, 5), c("insert", 1, 9), c("insert", 1, 7), c("length"), c("get", 0), c("get", 1),
                                                     c("get", 2), c("contains", 7), c("contains", 8), c("removeAt", 1), c("get", 1), c("length")]),
            ("Duplicates and empty/refill", [c("insert", 0, 3), c("insert", 1, 3), c("removeAt", 0), c("contains", 3), c("removeAt", 0),
                                             c("contains", 3), c("insert", 0, -5), c("get", 0)]),
            ("Remove first, last and invalid", [c("insert", 0, 10), c("insert", 1, 20), c("insert", 2, 30), c("removeAt", 2), c("removeAt", 0),
                                                c("get", 0), c("removeAt", 5), c("removeAt", -1), c("length")]),
        ]
        if kind == "unsorted_array_list":
            result.append(("Full capacity and reuse", [*[c("insert", i, i + 1) for i in range(8)], c("length"), c("insert", 4, 99),
                                                        c("get", 7), c("removeAt", 3), c("insert", 3, 99), c("length"), c("get", 3)]))
        else:
            result.append(("Nodes beyond array capacity", [*[c("insert", i, i + 1) for i in range(11)], c("length"),
                                                            c("get", 10), c("removeAt", 10), c("length")]))
        return result
    if kind == "sorted_array_list":
        return [
            ("Empty sorted list", [c("length"), c("contains", 4), c("remove", 4)]),
            ("Unordered input, sorted result", [c("insert", 8), c("insert", 2), c("insert", 5), c("insert", -3), c("contains", 5), c("contains", 7), c("length")]),
            ("Duplicates and one-at-a-time removal", [c("insert", 4), c("insert", 4), c("insert", 4), c("remove", 4), c("contains", 4),
                                                      c("remove", 4), c("remove", 4), c("remove", 4), c("length")]),
            ("Remove first, middle and last", [c("insert", 3), c("insert", 1), c("insert", 7), c("insert", 5), c("remove", 1),
                                               c("remove", 5), c("remove", 7), c("contains", 3), c("length")]),
            ("Full capacity and reuse", [*[c("insert", i) for i in range(8, 0, -1)], c("insert", 9), c("length"), c("remove", 4), c("insert", 4),
                                         c("contains", 4), c("length")]),
        ]
    if kind == "sorted_linked_list":
        return [
            ("Empty list", [c("length"), c("contains", 3), c("remove", 3)]),
            ("Sorted insertion", [c("insert", 8), c("insert", 2), c("insert", 5), c("contains", 2), c("contains", 8), c("contains", 7)]),
            ("Duplicates", [c("insert", 4), c("insert", 4), c("insert", 4), c("length"), c("remove", 4), c("contains", 4), c("remove", 4), c("remove", 4), c("contains", 4)]),
            ("Remove missing, first and last", [c("insert", 3), c("insert", 1), c("insert", 7), c("remove", 9), c("remove", 1), c("remove", 7), c("remove", 3), c("remove", 3)]),
            ("Mixed positive and negative keys", [c("insert", 0), c("insert", -9), c("insert", 9), c("insert", -2), c("remove", -9), c("contains", -2), c("remove", 0), c("contains", 9)]),
            ("Sorted linked list beyond eight elements", [*[c("insert", i) for i in range(12, 0, -1)], c("length"), c("contains", 11),
                                                           c("remove", 6), c("length"), c("contains", 6)]),
        ]
    if kind in ("tree", "avl"):
        result = [
            ("Empty tree", [c("contains", 5), c("remove", 5)]),
            ("Search and duplicate insertions", [c("insert", 8), c("insert", 3), c("insert", 12), c("insert", 3), c("contains", 3), c("contains", 11)]),
            ("Remove leaf and root", [c("insert", 8), c("insert", 3), c("insert", 12), c("remove", 3), c("contains", 3), c("remove", 8), c("contains", 12)]),
            ("Remove a node with two children", [c("insert", 8), c("insert", 4), c("insert", 12), c("insert", 2), c("insert", 6), c("insert", 10),
                                                 c("insert", 14), c("remove", 8), c("contains", 8), c("contains", 14)]),
            ("Negative keys and repeated removal", [c("insert", 0), c("insert", -4), c("insert", 4), c("remove", -4), c("remove", -4), c("contains", 0),
                                                    c("remove", 0), c("remove", 4)]),
        ]
        if kind == "avl":
            result += [
                ("Ascending inserts", [c("insert", 10), c("insert", 20), c("insert", 30), c("insert", 40), c("insert", 50), c("contains", 20)]),
                ("Descending inserts", [c("insert", 50), c("insert", 40), c("insert", 30), c("insert", 20), c("insert", 10), c("contains", 40)]),
                ("Zigzag insertions", [c("insert", 30), c("insert", 10), c("insert", 20), c("insert", 50), c("insert", 40), c("contains", 20)]),
                ("Balance after removals", [*[c("insert", i) for i in range(1, 10)], c("remove", 1), c("remove", 2), c("remove", 3), c("remove", 4), c("contains", 9)]),
            ]
        return result
    if kind == "array_heap":
        return [
            ("Empty heap", [c("isEmpty"), c("peek"), c("removeMin")]),
            ("Insert and minimum", [c("insert", 9), c("insert", 2), c("insert", 7), c("peek"), c("isEmpty"), c("removeMin"), c("peek")]),
            ("Duplicates", [c("insert", 4), c("insert", 4), c("insert", 1), c("removeMin"), c("removeMin"), c("removeMin"), c("removeMin"), c("isEmpty")]),
            ("Ascending and descending values", [*[c("insert", i) for i in range(8, 0, -1)], *[c("removeMin") for _ in range(8)], c("isEmpty")]),
            ("Empty and refill", [c("insert", 42), c("removeMin"), c("insert", -3), c("insert", 0), c("peek"), c("removeMin"), c("removeMin"), c("isEmpty")]),
            ("Dynamic heap beyond eight elements", [*[c("insert", i) for i in range(12, 0, -1)], c("peek"), *[c("removeMin") for _ in range(12)], c("isEmpty")]),
        ]
    if kind == "hash":
        return [
            ("Empty table", [c("isEmpty"), c("contains", 5), c("remove", 5), c("loadFactor")]),
            ("Insert and membership", [c("insert", 1), c("insert", 10), c("insert", 27), c("contains", 1), c("contains", 10), c("contains", 27), c("contains", 3), c("loadFactor")]),
            ("Duplicate keys", [c("insert", 4), c("insert", 4), c("contains", 4), c("loadFactor"), c("remove", 4), c("contains", 4), c("remove", 4)]),
            ("Remove existing and missing keys", [c("insert", 2), c("insert", 11), c("insert", 29), c("remove", 11), c("contains", 11), c("contains", 2),
                                                  c("remove", 2), c("remove", 29), c("remove", 29), c("isEmpty")]),
            ("Negative keys and reuse", [c("insert", -9), c("insert", -1), c("insert", 0), c("contains", -9), c("remove", -1), c("loadFactor"),
                                         c("remove", -9), c("remove", 0), c("isEmpty")]),
            ("Many keys and rising load factor", [*[c("insert", i * 8) for i in range(20)], c("loadFactor"), c("contains", 8), c("remove", 8),
                                                  c("contains", 8), c("loadFactor")]),
        ]
    raise ValueError(kind)


# A short scenario per structure whose trace is compared across languages.
TRACE_SCENARIOS = {
    "unsorted_array_list": [("insert", [0, 5]), ("insert", [0, 3]), ("removeAt", [1]), ("contains", [3])],
    "unsorted_linked_list": [("insert", [0, 5]), ("insert", [1, 7]), ("insert", [1, 6]), ("removeAt", [0]), ("get", [1])],
    "sorted_array_list": [("insert", [8]), ("insert", [2]), ("insert", [5]), ("remove", [2]), ("contains", [8])],
    "sorted_linked_list": [("insert", [8]), ("insert", [2]), ("insert", [5]), ("remove", [5]), ("contains", [8])],
    "tree": [("insert", [8]), ("insert", [3]), ("insert", [12]), ("insert", [10]), ("remove", [8]), ("contains", [3])],
    "avl": [("insert", [10]), ("insert", [20]), ("insert", [30]), ("insert", [5]), ("remove", [10]), ("contains", [5])],
    "stack": [("push", [4]), ("push", [9]), ("peek", []), ("pop", []), ("isEmpty", [])],
    "linked_stack": [("push", [4]), ("push", [9]), ("pop", []), ("peek", []), ("isEmpty", [])],
    "linked_queue": [("enqueue", [4]), ("enqueue", [9]), ("dequeue", []), ("dequeue", []), ("isEmpty", [])],
    "array_queue": [("enqueue", [4]), ("enqueue", [9]), ("dequeue", []), ("peek", []), ("isFull", [])],
    "array_heap": [("insert", [5]), ("insert", [3]), ("insert", [8]), ("insert", [1]), ("removeMin", []), ("peek", [])],
    "hash": [("insert", [3]), ("insert", [11]), ("insert", [5]), ("remove", [11]), ("contains", [3]), ("loadFactor", [])],
}
