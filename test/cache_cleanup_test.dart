// Run from the repository root: dart test/cache_cleanup_test.dart
import 'dart:convert';
import 'dart:io';

import '../tool/cache_cleanup.dart';

void check(bool condition, String description) {
  if (!condition) throw StateError(description);
}

void main() {
  final sandbox = Directory.systemTemp.createTempSync('sandbox-cache-test-');
  try {
    final tool = Directory('${sandbox.path}/tool')..createSync();
    final now = DateTime.now();
    final key = 'a' * 64;

    String add(String implementation, int revision, Duration age,
        {bool complete = true, bool kernel = true}) {
      final id = '${implementation}_${revision.toRadixString(16).padLeft(24, '0')}';
      final generated = Directory('${tool.path}/generated/$id')
        ..createSync(recursive: true);
      final source = File('${tool.path}/generated_worker_$id.dart')
        ..writeAsStringSync('// generated');
      final dill = File('${tool.path}/generated_worker_$id.dill');
      if (kernel) dill.writeAsBytesSync([1, 2, 3, 4]);
      final ready = File('${generated.path}/ready.json');
      if (complete) ready.writeAsStringSync(
          jsonEncode({'key': key, 'kernel': kernel}));
      for (final file in [source, dill, ready]) {
        if (file.existsSync()) file.setLastModifiedSync(now.subtract(age));
      }
      return id;
    }

    final oldest = add('alice_stack', 1, const Duration(hours: 5));
    final old = add('alice_stack', 2, const Duration(hours: 4));
    final recent = add('alice_stack', 3, const Duration(hours: 3));
    final latest = add('alice_stack', 4, const Duration(hours: 2));
    final other = add('bob_tree', 5, const Duration(hours: 5));
    final inProgress = add('alice_stack', 6, const Duration(minutes: 1),
        complete: false);
    final failed = add('alice_stack', 7, const Duration(hours: 6),
        complete: false);
    final fallback = add('bob_tree', 8, const Duration(hours: 3), kernel: false);
    final unrelated = File('${tool.path}/generated_worker_custom.dill')
      ..writeAsBytesSync([2]);
    String? symlink;
    File? outside;
    if (!Platform.isWindows) {
      symlink = add('alice_stack', 9, const Duration(hours: 8),
          complete: false);
      outside = File('${sandbox.path}/unrelated-source.dart')
        ..writeAsStringSync('keep me');
      final kernel = File('${tool.path}/generated_worker_$symlink.dill');
      kernel.deleteSync();
      Link(kernel.path).createSync(outside.path);
    }

    final result = pruneWorkerCache(
        toolRoot: tool.path, now: now, keepPerImplementation: 2);
    check(result.revisionsRemoved == 3, 'Prune two old and one failed build');
    check(result.kernelsRemoved == 3, 'Prune three stale kernels');
    check(result.bytesRemoved == 48, 'Count deleted worker bytes separately');
    for (final id in [oldest, old, failed]) {
      check(!File('${tool.path}/generated_worker_$id.dill').existsSync(),
          'Stale kernel $id must be deleted');
      check(!Directory('${tool.path}/generated/$id').existsSync(),
          'Stale metadata $id must be deleted');
    }
    for (final id in [recent, latest, other, inProgress, fallback]) {
      check(Directory('${tool.path}/generated/$id').existsSync(),
          'Retained revision $id must survive');
    }
    check(unrelated.existsSync(), 'Do not delete unrelated dill files');
    if (symlink != null) {
      check(Link('${tool.path}/generated_worker_$symlink.dill').existsSync(),
          'Never remove symlinked snapshots');
      check(outside!.readAsStringSync() == 'keep me',
          'Never touch the target of a symlink');
    }
    final repeated = pruneWorkerCache(toolRoot: tool.path, now: now);
    check(repeated.revisionsRemoved == 0, 'Cleanup is idempotent');
    check(pruneWorkerCache(toolRoot: '${sandbox.path}/missing')
        .revisionsRemoved == 0, 'Missing cache directory is harmless');
    stdout.writeln('PASS: safe content-addressed worker cache cleanup');
  } finally {
    sandbox.deleteSync(recursive: true);
  }
}
