// Deterministic, implementation-independent scenarios for the web test runner.
// These specify public behavior only; the existing worker checks actual storage.
class ValidationCall {
  final String method;
  final int? value, second;
  const ValidationCall(this.method, [this.value, this.second]);

  Map<String, Object?> toRequest() => {
    'action': 'run',
    'method': method,
    'arguments': [if (value != null) value, if (second != null) second],
  };

  String get label => '$method(${[if(value!=null)value,if(second!=null)second].join(', ')})';
}

class ValidationCase {
  final String name;
  final List<ValidationCall> calls;
  const ValidationCase(this.name, this.calls);
}

ValidationCall c(String method, [int? value, int? second]) => ValidationCall(method, value, second);

List<ValidationCase> validationCases(String kind) {
  if (kind == 'stack' || kind == 'linked_stack') {
    final cases = <ValidationCase>[
      ValidationCase('Empty stack', [c('isEmpty'), c('peek'), c('pop'), c('isEmpty')]),
      ValidationCase('Push, peek and pop', [c('push', 12), c('isEmpty'), c('peek'), c('pop'), c('isEmpty')]),
      ValidationCase('LIFO order and duplicates', [c('push', 3), c('push', 3), c('push', 7), c('peek'), c('pop'), c('pop'), c('pop'), c('pop')]),
      ValidationCase('Empty and refill', [c('push', 1), c('pop'), c('push', 42), c('peek'), c('pop'), c('isEmpty'), c('push', -5), c('peek')]),
      ValidationCase('Repeated operations', [c('push', -1), c('push', 0), c('push', 99), c('pop'), c('peek'), c('push', -3), c('pop'), c('pop'), c('pop'), c('isEmpty')]),
    ];
    if (kind == 'stack') {
      cases.add(ValidationCase('Fixed capacity and reuse', [
        for (var i = 1; i <= 8; i++) c('push', i), c('push', 9), c('peek'),
        c('pop'), c('push', 9), c('peek'), c('isEmpty'),
      ]));
    } else {
      cases.add(ValidationCase('Linked stack beyond eight elements', [
        for (var i = 0; i < 12; i++) c('push',i), c('peek'),
        for (var i = 0; i < 12; i++) c('pop'), c('isEmpty'),
      ]));
    }
    return cases;
  }
  if (kind == 'array_queue' || kind == 'linked_queue') {
    final cases = <ValidationCase>[
      ValidationCase('Empty queue', [c('isEmpty'), c('peek'), c('dequeue'), c('isEmpty'), if (kind == 'array_queue') c('isFull')]),
      ValidationCase('FIFO order', [c('enqueue', 12), c('enqueue', 20), c('peek'), c('dequeue'), c('peek'), c('dequeue'), c('isEmpty')]),
      ValidationCase('Duplicates and empty refill', [c('enqueue', 4), c('enqueue', 4), c('dequeue'), c('dequeue'), c('dequeue'), c('enqueue', -3), c('peek'), c('isEmpty')]),
      ValidationCase('Mixed operations', [c('enqueue', 1), c('enqueue', 2), c('dequeue'), c('enqueue', 3), c('peek'), c('dequeue'), c('enqueue', 4), c('dequeue'), c('dequeue'), c('isEmpty')]),
    ];
    if (kind == 'array_queue') {
      cases.addAll([
        ValidationCase('Full queue and rejection', [for (var i = 1; i <= 8; i++) c('enqueue', i), c('isFull'), c('enqueue', 9), c('peek'), c('dequeue'), c('isFull')]),
        ValidationCase('Circular wraparound', [for (var i = 1; i <= 8; i++) c('enqueue', i), for (var i = 0; i < 3; i++) c('dequeue'), for (var i = 9; i <= 11; i++) c('enqueue', i), c('isFull'), for (var i = 0; i < 8; i++) c('dequeue'), c('isEmpty')]),
      ]);
    } else {
      cases.add(ValidationCase('Linked queue beyond eight elements', [
        for (var i = 0; i < 12; i++) c('enqueue',i), c('peek'),
        for (var i = 0; i < 12; i++) c('dequeue'), c('isEmpty'),
      ]));
    }
    return cases;
  }
  if (kind == 'unsorted_array_list' || kind == 'unsorted_linked_list') return [
    ValidationCase('Empty list and invalid indices', [c('length'), c('get',0),
      c('get',-1), c('removeAt',0), c('insert',-1,4), c('insert',1,4), c('length')]),
    ValidationCase('Insert at beginning, middle and end', [c('insert',0,5),
      c('insert',1,9), c('insert',1,7), c('length'), c('get',0), c('get',1),
      c('get',2), c('contains',7), c('contains',8), c('removeAt',1),
      c('get',1), c('length')]),
    ValidationCase('Duplicates and empty/refill', [c('insert',0,3),
      c('insert',1,3), c('removeAt',0), c('contains',3), c('removeAt',0),
      c('contains',3), c('insert',0,-5), c('get',0)]),
    ValidationCase('Remove first, last and invalid', [c('insert',0,10),
      c('insert',1,20), c('insert',2,30), c('removeAt',2), c('removeAt',0),
      c('get',0), c('removeAt',5), c('removeAt',-1), c('length')]),
    if(kind=='unsorted_array_list') ValidationCase('Full capacity and reuse', [
      for(var i=0;i<8;i++)c('insert',i,i+1), c('length'), c('insert',4,99),
      c('get',7), c('removeAt',3), c('insert',3,99), c('length'), c('get',3)]),
    if(kind=='unsorted_linked_list') ValidationCase('Nodes beyond array capacity', [
      for(var i=0;i<11;i++)c('insert',i,i+1), c('length'),
      c('get',10), c('removeAt',10), c('length')]),
  ];
  if(kind=='sorted_array_list') return [
    ValidationCase('Empty sorted list', [c('length'), c('contains',4), c('remove',4)]),
    ValidationCase('Unordered input, sorted result', [c('insert',8), c('insert',2),
      c('insert',5), c('insert',-3), c('contains',5), c('contains',7), c('length')]),
    ValidationCase('Duplicates and one-at-a-time removal', [c('insert',4),
      c('insert',4), c('insert',4), c('remove',4), c('contains',4),
      c('remove',4), c('remove',4), c('remove',4), c('length')]),
    ValidationCase('Remove first, middle and last', [c('insert',3),
      c('insert',1), c('insert',7), c('insert',5), c('remove',1),
      c('remove',5), c('remove',7), c('contains',3), c('length')]),
    ValidationCase('Full capacity and reuse', [for(var i=8;i>0;i--)c('insert',i),
      c('insert',9), c('length'), c('remove',4), c('insert',4),
      c('contains',4), c('length')]),
  ];
  if (kind == 'sorted_linked_list') return [
    ValidationCase('Empty list', [c('length'),c('contains', 3), c('remove', 3)]),
    ValidationCase('Sorted insertion', [c('insert', 8), c('insert', 2), c('insert', 5), c('contains', 2), c('contains', 8), c('contains', 7)]),
    ValidationCase('Duplicates', [c('insert', 4), c('insert', 4), c('insert', 4), c('length'), c('remove', 4), c('contains', 4), c('remove', 4), c('remove', 4), c('contains', 4)]),
    ValidationCase('Remove missing, first and last', [c('insert', 3), c('insert', 1), c('insert', 7), c('remove', 9), c('remove', 1), c('remove', 7), c('remove', 3), c('remove', 3)]),
    ValidationCase('Mixed positive and negative keys', [c('insert', 0), c('insert', -9), c('insert', 9), c('insert', -2), c('remove', -9), c('contains', -2), c('remove', 0), c('contains', 9)]),
    ValidationCase('Sorted linked list beyond eight elements', [
      for(var i=12;i>=1;i--) c('insert',i), c('length'), c('contains',11),
      c('remove',6), c('length'), c('contains',6),
    ]),
  ];
  if (kind == 'tree' || kind == 'avl') {
    final cases = <ValidationCase>[
      ValidationCase('Empty tree', [c('contains', 5), c('remove', 5)]),
      ValidationCase('Search and duplicate insertions', [c('insert', 8), c('insert', 3), c('insert', 12), c('insert', 3), c('contains', 3), c('contains', 11)]),
      ValidationCase('Remove leaf and root', [c('insert', 8), c('insert', 3), c('insert', 12), c('remove', 3), c('contains', 3), c('remove', 8), c('contains', 12)]),
      ValidationCase('Remove a node with two children', [c('insert', 8), c('insert', 4), c('insert', 12), c('insert', 2), c('insert', 6), c('insert', 10), c('insert', 14), c('remove', 8), c('contains', 8), c('contains', 14)]),
      ValidationCase('Negative keys and repeated removal', [c('insert', 0), c('insert', -4), c('insert', 4), c('remove', -4), c('remove', -4), c('contains', 0), c('remove', 0), c('remove', 4)]),
    ];
    if (kind == 'avl') cases.addAll([
      ValidationCase('Ascending inserts', [c('insert', 10), c('insert', 20), c('insert', 30), c('insert', 40), c('insert', 50), c('contains', 20)]),
      ValidationCase('Descending inserts', [c('insert', 50), c('insert', 40), c('insert', 30), c('insert', 20), c('insert', 10), c('contains', 40)]),
      ValidationCase('Zigzag insertions', [c('insert', 30), c('insert', 10), c('insert', 20), c('insert', 50), c('insert', 40), c('contains', 20)]),
      ValidationCase('Balance after removals', [for (var i = 1; i <= 9; i++) c('insert', i), c('remove', 1), c('remove', 2), c('remove', 3), c('remove', 4), c('contains', 9)]),
    ]);
    return cases;
  }
  if (kind == 'array_heap' || kind == 'node_heap') return [
    ValidationCase('Empty heap', [c('isEmpty'), c('peek'), c('removeMin')]),
    ValidationCase('Insert and minimum', [c('insert', 9), c('insert', 2), c('insert', 7), c('peek'), c('isEmpty'), c('removeMin'), c('peek')]),
    ValidationCase('Duplicates', [c('insert', 4), c('insert', 4), c('insert', 1), c('removeMin'), c('removeMin'), c('removeMin'), c('removeMin'), c('isEmpty')]),
    ValidationCase('Ascending and descending values', [c('insert', 8), c('insert', 7), c('insert', 6), c('insert', 5), c('insert', 4), c('insert', 3), c('insert', 2), c('insert', 1), for (var i = 0; i < 8; i++) c('removeMin'), c('isEmpty')]),
    ValidationCase('Empty and refill', [c('insert', 42), c('removeMin'), c('insert', -3), c('insert', 0), c('peek'), c('removeMin'), c('removeMin'), c('isEmpty')]),
    ValidationCase('Dynamic heap beyond eight elements', [
      for(var i=12;i>=1;i--) c('insert',i), c('peek'),
      for(var i=0;i<12;i++) c('removeMin'), c('isEmpty'),
    ]),
  ];
  if (kind == 'hash') return [
    ValidationCase('Empty table', [c('isEmpty'), c('contains', 5), c('remove', 5), c('loadFactor')]),
    ValidationCase('Insert and membership', [c('insert', 1), c('insert', 10), c('insert', 27), c('contains', 1), c('contains', 10), c('contains', 27), c('contains', 3), c('loadFactor')]),
    ValidationCase('Duplicate keys', [c('insert', 4), c('insert', 4), c('contains', 4), c('loadFactor'), c('remove', 4), c('contains', 4), c('remove', 4)]),
    ValidationCase('Remove existing and missing keys', [c('insert', 2), c('insert', 11), c('insert', 29), c('remove', 11), c('contains', 11), c('contains', 2), c('remove', 2), c('remove', 29), c('remove', 29), c('isEmpty')]),
    ValidationCase('Negative keys and reuse', [c('insert', -9), c('insert', -1), c('insert', 0), c('contains', -9), c('remove', -1), c('loadFactor'), c('remove', -9), c('remove', 0), c('isEmpty')]),
    ValidationCase('Many keys and rising load factor', [
      for(var i=0;i<20;i++) c('insert',i*8), c('loadFactor'),
      c('contains',8), c('remove',8), c('contains',8), c('loadFactor'),
    ]),
  ];
  throw ArgumentError.value(kind, 'kind', 'Unsupported data structure');
}
