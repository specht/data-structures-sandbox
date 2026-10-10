// Prune obsolete content-addressed workers without deleting a live build.
// The host calls this once at startup, before launching any student workers.
import 'dart:convert';
import 'dart:io';

final _workerName = RegExp(
    r'^generated_worker_([A-Za-z0-9][A-Za-z0-9_-]*)_([0-9a-f]{24})\.(dart|dill)$');
final _generatedName = RegExp(
    r'^([A-Za-z0-9][A-Za-z0-9_-]*)_([0-9a-f]{24})$');

class CacheCleanupResult {
  final int revisionsRemoved;
  final int kernelsRemoved;
  final int bytesRemoved;
  const CacheCleanupResult(this.revisionsRemoved, this.kernelsRemoved,
      this.bytesRemoved);
}

class _WorkerRevision {
  final String id;
  final String implementation;
  final Directory directory;
  final File source;
  final File kernel;
  final File ready;

  _WorkerRevision(String toolRoot, this.id, this.implementation)
      : directory = Directory('$toolRoot/generated/$id'),
        source = File('$toolRoot/generated_worker_$id.dart'),
        kernel = File('$toolRoot/generated_worker_$id.dill'),
        ready = File('$toolRoot/generated/$id/ready.json');

  bool get _safe {
    // Never follow or remove symlinks, including a substituted build directory.
    for (final entity in [directory, source, kernel, ready]) {
      if (FileSystemEntity.typeSync(entity.path, followLinks: false) ==
          FileSystemEntityType.link) return false;
    }
    return true;
  }

  bool get complete {
    if (!source.existsSync() || !ready.existsSync()) return false;
    try {
      final record = jsonDecode(ready.readAsStringSync());
      if (record is! Map || record['key'] is! String ||
          !RegExp(r'^[a-f0-9]{64}$').hasMatch(record['key'] as String)) {
        return false;
      }
      if (record['kernel'] == true) return kernel.existsSync();
      return record['kernel'] == false;
    } on FileSystemException {
      return false;
    } on FormatException {
      return false;
    }
  }

  DateTime get lastWrite {
    DateTime latest = DateTime.fromMillisecondsSinceEpoch(0);
    for (final entity in [source, kernel, ready]) {
      if (FileSystemEntity.typeSync(entity.path, followLinks: false) ==
          FileSystemEntityType.notFound) continue;
      try {
        final modified = entity.statSync().modified;
        if (modified.isAfter(latest)) latest = modified;
      } on FileSystemException {
        // A concurrent build may be changing the file; it stays protected below.
        return DateTime.now();
      }
    }
    if (latest.millisecondsSinceEpoch != 0) return latest;
    // A build may have created only the directory so far.
    try {
      return directory.existsSync() ? directory.statSync().modified : latest;
    } on FileSystemException {
      return DateTime.now();
    }
  }
}

/// Keep [keepPerImplementation] completed worker revisions per student/structure.
///
/// Only our exact generated-worker filename pattern is considered. An incomplete
/// build is left alone until it is older than [gracePeriod]; a freshly written
/// complete build is similarly protected. Run this before workers start, not
/// while the host is serving requests: old workers may still refer to a kernel.
CacheCleanupResult pruneWorkerCache({
  String toolRoot = 'tool',
  int keepPerImplementation = 2,
  Duration gracePeriod = const Duration(minutes: 10),
  DateTime? now,
}) {
  if (keepPerImplementation < 1) {
    throw ArgumentError.value(keepPerImplementation, 'keepPerImplementation');
  }
  if (gracePeriod.isNegative) {
    throw ArgumentError.value(gracePeriod, 'gracePeriod');
  }
  final tool = Directory(toolRoot);
  if (FileSystemEntity.typeSync(tool.path, followLinks: false) !=
      FileSystemEntityType.directory) {
    return const CacheCleanupResult(0, 0, 0);
  }
  final timestamp = now ?? DateTime.now();
  final revisions = <String, _WorkerRevision>{};

  void include(String id, String implementation) {
    revisions.putIfAbsent(id,
        () => _WorkerRevision(toolRoot, id, implementation));
  }

  for (final entity in tool.listSync(followLinks: false)) {
    if (entity is! File) continue;
    final name = entity.uri.pathSegments.last;
    final match = _workerName.firstMatch(name);
    if (match == null) continue;
    include('${match[1]}_${match[2]}', match[1]!);
  }
  final generated = Directory('$toolRoot/generated');
  if (FileSystemEntity.typeSync(generated.path, followLinks: false) ==
      FileSystemEntityType.link) {
    return const CacheCleanupResult(0, 0, 0);
  }
  if (generated.existsSync()) {
    for (final entity in generated.listSync(followLinks: false)) {
      if (entity is! Directory) continue;
      final match = _generatedName.firstMatch(entity.uri.pathSegments
          .where((segment) => segment.isNotEmpty).last);
      if (match == null) continue;
      include('${match[1]}_${match[2]}', match[1]!);
    }
  }

  final groups = <String, List<_WorkerRevision>>{};
  for (final revision in revisions.values) {
    if (!revision._safe) continue;
    groups.putIfAbsent(revision.implementation, () => []).add(revision);
  }

  var removed = 0, kernels = 0, bytes = 0;
  for (final group in groups.values) {
    group.sort((a, b) => b.lastWrite.compareTo(a.lastWrite));
    var keptComplete = 0;
    for (final revision in group) {
      final complete = revision.complete;
      if (complete && keptComplete++ < keepPerImplementation) continue;
      // This also protects incomplete kernel compilation and recent failures.
      if (timestamp.difference(revision.lastWrite) < gracePeriod) continue;
      // A build might have completed since the initial scan: cleanup runs only
      // before the host starts workers, but the age gate still avoids races.
      if (!revision._safe) continue;
      try {
        for (final file in [revision.kernel, revision.source]) {
          if (!file.existsSync()) continue;
          final length = file.lengthSync();
          file.deleteSync();
          bytes += length;
          if (file.path == revision.kernel.path) kernels++;
        }
        if (revision.directory.existsSync()) {
          revision.directory.deleteSync(recursive: true);
        }
        removed++;
      } on FileSystemException catch (error) {
        stderr.writeln('[cache] Could not remove ${revision.id}: $error');
      }
    }
  }
  return CacheCleanupResult(removed, kernels, bytes);
}

// For occasional manual cleanup, stop ./run first, then execute this file.
void main(List<String> args) {
  if (args.isNotEmpty) {
    stderr.writeln('Usage: dart run tool/cache_cleanup.dart');
    exitCode = 64;
    return;
  }
  final result = pruneWorkerCache();
  stdout.writeln('[cache] Removed ${result.revisionsRemoved} stale worker '
      'revisions (${result.kernelsRemoved} kernels, '
      '${(result.bytesRemoved / (1024 * 1024)).toStringAsFixed(1)} MiB).');
}
