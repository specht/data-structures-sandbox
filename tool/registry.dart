// Teaching contracts and the currently implemented visual adapters.
// This is deliberately data, not filename/heuristic inference of semantics.
class StructureSpec {
  final String id, label, filename, className, storage, renderer;
  const StructureSpec(this.id,this.label,this.filename,this.className,this.storage,this.renderer);
}
const structures = <StructureSpec>[
  StructureSpec('list','Singly linked list','my_linked_list.dart','MyLinkedList','linked','linked-list'),
  StructureSpec('tree','Binary search tree','my_bst.dart','MyBST','linked','binary-tree'),
  StructureSpec('stack','Fixed-array stack','my_array_stack.dart','MyArrayStack','array','fixed-memory'),
  StructureSpec('linked_stack','Linked stack (LIFO)','my_linked_stack.dart','MyLinkedStack','linked','linked-list'),
  StructureSpec('linked_queue','Linked queue (FIFO)','my_linked_queue.dart','MyLinkedQueue','linked','linked-list'),
];
StructureSpec specFor(String id) => structures.firstWhere((s)=>s.id==id,
  orElse:()=>throw FormatException('Unsupported structure: $id'));
