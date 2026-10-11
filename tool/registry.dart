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

// Student folders as they occur in class repositories, including dots
// (liu.kashiwabara). Never starting with '.' excludes hidden folders and '..'.
final studentFolder = RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');

// A student may keep several implementations of one structure, for example
// my_bst.dart and my_bst_recursive.dart. A variant keeps the starter's class
// name; only the file name differs.
final variantName = RegExp(r'^[a-z0-9][a-z0-9_]{0,31}$');

void checkVariant(String variant) {
  if (variant.isNotEmpty && !variantName.hasMatch(variant)) {
    throw FormatException('Invalid implementation variant: $variant');
  }
}

String implementationFile(StructureSpec spec, String variant) {
  checkVariant(variant);
  if (variant.isEmpty) return spec.filename;
  final stem = spec.filename.substring(0, spec.filename.length - '.dart'.length);
  return '${stem}_$variant.dart';
}

/// The structure and variant a student file name belongs to, or null.
({String kind, String variant})? implementationForFile(String name) {
  for (final spec in structures) {
    if (name == spec.filename) return (kind: spec.id, variant: '');
    final stem = spec.filename.substring(0, spec.filename.length - '.dart'.length);
    if (!name.startsWith('${stem}_') || !name.endsWith('.dart')) continue;
    final variant = name.substring(stem.length + 1, name.length - '.dart'.length);
    if (variantName.hasMatch(variant)) return (kind: spec.id, variant: variant);
  }
  return null;
}

String implementationLabel(String kind, String variant) =>
    variant.isEmpty ? specFor(kind).label : '${specFor(kind).label} · $variant';
