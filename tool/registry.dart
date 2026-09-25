// Teaching contracts and the currently implemented visual adapters.
// This is deliberately data, not filename/heuristic inference of semantics.
class StructureSpec {
  final String id, label, filename, className, storage, renderer;
  const StructureSpec(this.id,this.label,this.filename,this.className,this.storage,this.renderer);
}
const structures = <StructureSpec>[
  StructureSpec('unsorted_array_list','List (unsorted, array)','my_unsorted_array_list.dart','MyUnsortedArrayList','array','array-list'),
  StructureSpec('unsorted_linked_list','List (unsorted, singly linked)','my_unsorted_linked_list.dart','MyUnsortedLinkedList','linked','linked-list'),
  StructureSpec('sorted_array_list','List (sorted, array)','my_sorted_array_list.dart','MySortedArrayList','array','array-list'),
  StructureSpec('sorted_linked_list','List (sorted, singly linked)','my_sorted_linked_list.dart','MySortedLinkedList','linked','linked-list'),
  StructureSpec('tree','Tree (binary search)','my_bst.dart','MyBST','linked','binary-tree'),
  StructureSpec('avl','Tree (AVL)','my_avl.dart','MyAVL','linked','binary-tree'),
  StructureSpec('stack','Stack (fixed array)','my_array_stack.dart','MyArrayStack','array','fixed-memory'),
  StructureSpec('linked_stack','Stack (linked list)','my_linked_stack.dart','MyLinkedStack','linked','linked-list'),
  StructureSpec('linked_queue','Queue (linked list)','my_linked_queue.dart','MyLinkedQueue','linked','linked-list'),
  StructureSpec('array_queue','Queue (circular array)','my_array_queue.dart','MyArrayQueue','array','fixed-memory'),
  StructureSpec('array_heap','Heap (array)','my_array_heap.dart','MyArrayHeap','array','array-heap'),
  StructureSpec('node_heap','Heap (node-based)','my_node_heap.dart','MyNodeHeap','linked','binary-tree'),
  StructureSpec('hash','Hash table (separate chaining)','my_hash_table.dart','MyHashTable','buckets','hash-chains'),
];
StructureSpec specFor(String id) => structures.firstWhere((s)=>s.id==id,
  orElse:()=>throw FormatException('Unsupported structure: $id'));
