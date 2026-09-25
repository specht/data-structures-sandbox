import 'dart:async';
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

// Format the editor draft on stdin. Never write a temporary copy or mutate the
// selected student file. The existing read/save revision checks remain intact.
Future<String> formatEditableDraft(String sourcePath, String content) async {
  if (utf8.encode(content).length > maxSourceBytes || content.contains('\u0000')) {
    throw const FormatException('Source must be UTF-8 text smaller than 256 KiB.');
  }
  final process = await Process.start(Platform.resolvedExecutable,
      ['format', '--output=show', '--stdin-name=$sourcePath']);
  final formattedOutput = process.stdout.transform(utf8.decoder).join();
  final errorOutput = process.stderr.transform(utf8.decoder).join();
  try {
    process.stdin.write(content);
    await process.stdin.close();
    final status = await process.exitCode.timeout(const Duration(seconds: 10));
    final formatted = await formattedOutput;
    final errors = await errorOutput;
    if (status != 0) {
      throw FormatException(errors.trim().isNotEmpty ? errors.trim() :
          'Dart could not format this draft. Check its syntax.');
    }
    if (utf8.encode(formatted).length > maxSourceBytes) {
      throw const FormatException('Formatted source exceeds the 256 KiB editor limit.');
    }
    return formatted;
  } on TimeoutException {
    process.kill();
    throw const FormatException('Formatting timed out. Your draft has not been changed.');
  }
}
