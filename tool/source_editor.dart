import 'dart:convert';
import 'dart:io';

import 'prepare.dart';
import 'registry.dart';

// Filesystem writes are limited to an existing, recognized student Dart file.
// Keep --students as the only root authority; never accept a client file path.
const maxSourceBytes = 256 * 1024;
final _studentName = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$');

File editableSource(String root, String student, String kind) {
  if (!_studentName.hasMatch(student)) {
    throw const FormatException('Invalid student name.');
  }
  final filename = specFor(kind).filename;
  final directory = Directory('${Directory(root).absolute.path}/$student');
  final source = File('${directory.path}/$filename');
  // A symbolic link must not turn a selected class file into an arbitrary write.
  if (FileSystemEntity.typeSync(directory.path, followLinks: false) !=
          FileSystemEntityType.directory ||
      FileSystemEntity.typeSync(source.path, followLinks: false) !=
          FileSystemEntityType.file) {
    throw const FormatException('Selected student source is not a regular file.');
  }
  return source;
}

Map<String, Object?> readEditableSource(String root, String student, String kind) {
  final file = editableSource(root, student, kind);
  if (file.lengthSync() > maxSourceBytes) {
    throw const FormatException('Source is too large for the browser editor.');
  }
  return {
    'type': 'sourceFile', 'student': student, 'structure': kind,
    'content': file.readAsStringSync(encoding: utf8),
    'revision': studentStamp(file),
  };
}

Map<String, Object?> saveEditableSource(
    String root, String student, String kind, String baseRevision, String content) {
  if (utf8.encode(content).length > maxSourceBytes || content.contains('\u0000')) {
    throw const FormatException('Source must be UTF-8 text smaller than 256 KiB.');
  }
  final file = editableSource(root, student, kind);
  if (studentStamp(file) != baseRevision) {
    throw const FormatException(
        'Source changed since editing began. Your draft was kept; review the latest file before saving.');
  }
  if (file.readAsStringSync(encoding: utf8) != content) {
    file.writeAsStringSync(content, encoding: utf8, flush: true);
  }
  return {
    'type': 'sourceSaved', 'student': student, 'structure': kind,
    'content': content, 'revision': studentStamp(file),
  };
}
