// Hash table with separate chaining: HashBuckets buckets + `int size`.
// The student chooses the bucket count and the hash function.
import '../hash_sandbox.dart' as hash_api;
import '../sandbox.dart' as list_api;
import '../worker/adapter.dart';

class HashAdapter extends StructureAdapter {
  HashAdapter({required super.create, required super.invoke, required super.methodsJson})
      : super('hash');

  hash_api.HashBuckets get buckets => s.buckets;
  int get size => s.size;

  Map<String, Object?> audit() => hash_api.auditHash(buckets, size);

  @override
  void resetIds() => list_api.Recorder.resetIds();

  @override
  dynamic createRecorder(List<String> lines) => hash_api.HashRecorder(lines)
    ..memory = (() => s.buckets)
    ..count = (() => s.size);

  @override
  void activate(dynamic recorder) =>
      list_api.Recorder.active = recorder as hash_api.HashRecorder;

  @override
  bool get unorderedContents => true;

  @override
  Set<String> get standardMethods =>
      const {'insert', 'remove', 'contains', 'isEmpty', 'loadFactor'};

  @override
  Object? expectedReturn(String name, List<Object?> args) {
    final value = args.isNotEmpty && args.last is int ? args.last as int : null;
    return switch (name) {
      'insert' => !reference.contains(value),
      'loadFactor' => reference.length / buckets.length,
      _ => super.expectedReturn(name, args),
    };
  }

  @override
  bool returnMatches(String name, Object? expected, Object? returned) =>
      name == 'loadFactor'
          ? returned is num && expected is num && (returned - expected).abs() < 0.0000001
          : expected == returned;

  @override
  List<int> actualValues() => (audit()['values'] as List).cast<int>();

  @override
  bool updateReference(String name, List<Object?> args, Object? returned) {
    final value = args.length == 1 && args[0] is int ? args[0] as int : null;
    switch (name) {
      case 'insert' when value != null:
        final expected = !reference.contains(value);
        if (expected) reference.add(value);
        return returned == expected;
      case 'remove' when value != null:
        final expected = reference.remove(value);
        return returned == expected;
      case 'contains' when value != null:
        return returned == reference.contains(value);
      case 'isEmpty':
        return returned == reference.isEmpty;
      case 'loadFactor':
        return returned is num && (returned - size / buckets.length).abs() < 0.0000001;
      default:
        reference
          ..clear()
          ..addAll(actualValues());
        return true;
    }
  }

  @override
  List<String> executionProblems() {
    final result = audit();
    final faults = [
      if (result['acyclic'] != true) 'cycle/shared node',
      if (result['placement'] != true) 'wrong bucket',
      if (result['unique'] != true) 'duplicate keys',
      if (result['sizeOk'] != true) 'stored size',
    ];
    return faults.isEmpty ? const [] : ['hash: ${faults.join(', ')}'];
  }

  @override
  void structuralChecks(Check check) {
    final result = audit();
    check('Acyclic chains', true, result['acyclic']);
    check('Bucket placement', true, result['placement']);
    check('Unique keys', true, result['unique']);
    check('Stored size', reference.length, size);
    check('Hash table storage', true, result['sizeOk']);
  }
}
