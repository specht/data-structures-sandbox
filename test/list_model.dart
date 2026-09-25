// Run: dart test/list_model.dart
// Independent deterministic reference-model checks for all three additions.
import 'dart:math';
import '../templates/example/my_unsorted_array_list.dart';
import '../templates/example/my_unsorted_linked_list.dart';
import '../templates/example/my_sorted_array_list.dart';
import '../templates/example/my_sorted_linked_list.dart';

void require(bool condition, String message) {
  if (!condition) throw StateError(message);
}

void main() {
  final random = Random(20260925);
  for (final linked in [false, true]) {
    final array = MyUnsortedArrayList();
    final nodes = MyUnsortedLinkedList();
    final model = <int>[];
    for (var step = 0; step < 350; step++) {
      final size = model.length;
      final position = random.nextInt(size + 5) - 2;
      final value = random.nextInt(15) - 7;
      final op = random.nextInt(4);
      if (op == 0) {
        final valid = position >= 0 && position <= size &&
            (linked || size < array.memory.length);
        final result = linked ? nodes.insert(position,value) : array.insert(position,value);
        require(result == valid, 'insert returned wrong result at $step, linked=$linked');
        if (valid) model.insert(position,value);
      } else if (op == 1) {
        final expected = position >= 0 && position < size ? model.removeAt(position) : null;
        final actual = linked ? nodes.removeAt(position) : array.removeAt(position);
        require(actual == expected, 'removeAt at $step, linked=$linked');
      } else if (op == 2) {
        final expected = position >= 0 && position < size ? model[position] : null;
        require((linked ? nodes.get(position) : array.get(position)) == expected,
          'get at $step, linked=$linked');
      } else {
        require((linked ? nodes.contains(value) : array.contains(value)) == model.contains(value),
          'contains at $step, linked=$linked');
      }
      require((linked ? nodes.length() : array.length()) == model.length,
        'length at $step, linked=$linked');
      for (var i = 0; i < model.length; i++) {
        require((linked ? nodes.get(i) : array.get(i)) == model[i],
          'sequence at step $step, linked=$linked');
      }
      if (!linked) {
        final cells = array.memory.copy();
        for (var i = 0; i < cells.length; i++) {
          require(i < model.length ? cells[i] == model[i] : cells[i] == null,
            'physical cell $i at $step');
        }
      }
    }
  }
  final sorted = MySortedArrayList();
  final model = <int>[];
  for (var step = 0; step < 350; step++) {
    final value = random.nextInt(13) - 6;
    if (random.nextBool()) {
      final expected = model.length < sorted.memory.length;
      require(sorted.insert(value) == expected, 'sorted insert at $step');
      if (expected) { model.add(value); model.sort(); }
    } else {
      require(sorted.remove(value) == model.remove(value), 'sorted remove at $step');
    }
    require(sorted.length() == model.length, 'sorted length at $step');
    require(sorted.contains(value) == model.contains(value), 'sorted contains at $step');
    final cells = sorted.memory.copy();
    for (var i = 0; i < cells.length; i++) {
      require(i < model.length ? cells[i] == model[i] : cells[i] == null,
        'sorted physical cell $i at $step');
    }
  }
  final sortedNodes=MySortedLinkedList();
  final sortedModel=<int>[];
  for(var i=0;i<350;i++){
    final value=random.nextInt(19)-9;
    if(random.nextBool()){
      require(sortedNodes.insert(value),'linked sorted insertion at $i');
      sortedModel.add(value);sortedModel.sort();
    }else{
      require(sortedNodes.remove(value)==sortedModel.remove(value),'linked sorted remove at $i');
    }
    require(sortedNodes.length()==sortedModel.length,'linked sorted length at $i');
    var current=sortedNodes.head;
    final seen=<int>{}, values=<int>[];
    while(current!=null && seen.add(current.id)){values.add(current.value);current=current.next;}
    require(current==null && values.join(',')==sortedModel.join(','),'linked sorted order at $i');
    require(sortedNodes.contains(value)==sortedModel.contains(value),'linked sorted contains at $i');
  }
  print('PASS: 350 randomized operations per list; four list variants, ordering, bounds and storage');
}
