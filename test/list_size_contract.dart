// Run from the application root: dart test/list_size_contract.dart
import '../templates/example/my_unsorted_array_list.dart';
import '../templates/example/my_unsorted_linked_list.dart';
import '../templates/example/my_sorted_array_list.dart';
import '../templates/example/my_sorted_linked_list.dart';
import '../lib/list_sandbox.dart';
import '../lib/sandbox.dart';

void require(bool test, String message) {
  if (!test) throw StateError(message);
}

void main() {
  final a=MyUnsortedArrayList();
  final b=MyUnsortedLinkedList();
  final c=MySortedArrayList();
  final d=MySortedLinkedList();
  require(a.size==0 && b.size==0 && c.size==0 && d.size==0,
      'List size must start at zero');
  require(a.insert(0,7) && b.insert(0,7) && c.insert(7) && d.insert(7),
      'Insertion should succeed');
  require(a.size==1 && b.size==1 && c.size==1 && d.size==1,
      'Each list must increment its own size');
  require(a.removeAt(0)==7 && b.removeAt(0)==7 && c.remove(7) && d.remove(7),
      'Removal should succeed');
  require(a.size==0 && b.size==0 && c.size==0 && d.size==0,
      'Each list must decrement its own size');
  require(!a.insert(-1,7) && !b.insert(-1,7) && !c.remove(7) && !d.remove(7),
      'Invalid/missing operations must not change size');
  require(a.size==0 && b.size==0 && c.size==0 && d.size==0,
      'Invalid/missing operations changed size');

  a.size=3;
  b.size=3;
  c.size=3;
  d.size=3;
  require(a.length()==3 && b.length()==3 && c.length()==3 && d.length()==3,
      'length() must return the student field, not recompute stored elements');
  final arrayTrace=ListRecorder(const [])..memory=(() => a.memory)..size=(() => a.size);
  final linkedTrace=Recorder(const [])..root=(() => b.head)..size=(() => b.size);
  require(arrayTrace.snapshot()['size']==3 && linkedTrace.snapshot()['size']==3,
      'The observable snapshot must report the student field, even when wrong');
  print('PASS: four student-owned sizes, O(1) length, and raw size snapshots');
}
