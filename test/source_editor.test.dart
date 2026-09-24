import 'dart:io';
import '../tool/source_editor.dart';

void main() {
  final root = Directory.systemTemp.createTempSync('sandbox-source-editor-');
  try {
    final student = Directory('${root.path}/alice')..createSync();
    final file = File('${student.path}/my_array_stack.dart')
      ..writeAsStringSync('class MyArrayStack {}\n');
    final first = readEditableSource(root.path, 'alice', 'stack');
    if (first['content'] != 'class MyArrayStack {}\n') {
      throw StateError('Reading the selected student source failed.');
    }
    final saved = saveEditableSource(root.path, 'alice', 'stack',
      first['revision'] as String, 'class MyArrayStack { int top = -1; }\n');
    if (!file.readAsStringSync().contains('int top = -1')) {
      throw StateError('Source save did not change the selected file.');
    }
    if (saved['revision'] == first['revision']) {
      throw StateError('Source revision was not updated after the save.');
    }
    var conflict = false;
    try {
      saveEditableSource(root.path, 'alice', 'stack',
        first['revision'] as String, 'outdated');
    } on FormatException { conflict = true; }
    if (!conflict) throw StateError('Stale write was accepted.');
    if (!file.readAsStringSync().contains('int top = -1')) {
      throw StateError('Stale write replaced the current source.');
    }
    var traversalRejected = false;
    try { editableSource(root.path, '../alice', 'stack'); }
    on FormatException { traversalRejected = true; }
    if (!traversalRejected) throw StateError('Unsafe student path accepted.');
    final other = File('${root.path}/outside.dart')..writeAsStringSync('untouched');
    file.deleteSync();
    Link(file.path).createSync(other.path);
    var symlinkRejected = false;
    try { editableSource(root.path, 'alice', 'stack'); }
    on FormatException { symlinkRejected = true; }
    if (!symlinkRejected || other.readAsStringSync() != 'untouched') {
      throw StateError('Symlink write was not rejected.');
    }
    print('PASS: selected-file reads, writes, revision conflicts and path guards.');
  } finally {
    root.deleteSync(recursive: true);
  }
}
