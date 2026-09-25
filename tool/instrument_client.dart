// A single, persistent analyzer process shared by all browser sessions.
// Student implementations still run in separate, killable worker processes.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

// Keep student errors distinct from failures of the analyzer daemon.
class StudentDiagnosticsException implements Exception {
  final String message;
  final List<Map<String, dynamic>> diagnostics;
  StudentDiagnosticsException(this.message, this.diagnostics);
  @override
  String toString() => message;
}

class InstrumenterUnavailable implements Exception {
  final String message;
  InstrumenterUnavailable(this.message);
  @override
  String toString() => message;
}

class InstrumentClient {
  Process? _process;
  Future<void>? _starting;
  Completer<void>? _greeting;
  bool _ready = false;
  int _requestId = 0;
  final _pending = <int, Completer<Map<String, dynamic>>>{};

  Future<void> warm() => _ensureStarted();

  Future<void> _ensureStarted() {
    if (_ready && _process != null) return Future<void>.value();
    return _starting ??= _start().whenComplete(() { _starting = null; });
  }

  Future<void> _start() async {
    final Completer<void> greeting = Completer<void>();
    late final Process process;
    try {
      process = await Process.start(
        Platform.resolvedExecutable, ['run', 'tool/instrument_daemon.dart'],
        workingDirectory: Directory.current.path,
      );
    } catch (error) {
      throw InstrumenterUnavailable('Cannot start persistent instrumenter: $error');
    }
    _process = process;
    _greeting = greeting;
    _ready = false;
    process.stdout.transform(utf8.decoder).transform(const LineSplitter()).listen(
      (line) {
        try {
          final response = jsonDecode(line);
          if (response is! Map<String, dynamic>) throw const FormatException('Not an object');
          if (response['type'] == 'ready') {
            if (!greeting.isCompleted) greeting.complete();
            return;
          }
          final id = response['id'];
          if (id is int) {
            final waiter = _pending.remove(id);
            if (waiter != null && !waiter.isCompleted) waiter.complete(response);
          }
        } catch (_) {
          // Never mistake a non-protocol print for an answer to a student's edit.
          stderr.writeln('[instrumenter] $line');
        }
      },
      onError: (Object error) => _lost(process, error),
      onDone: () => _lost(process, 'stdout closed'),
    );
    process.stderr.transform(utf8.decoder).listen((text) {
      stderr.write('[instrumenter] $text');
    });
    unawaited(process.exitCode.then((code) =>
        _lost(process, 'process exited with code $code')));
    try {
      await greeting.future.timeout(const Duration(seconds: 45));
      if (!identical(_process, process)) {
        throw InstrumenterUnavailable('Instrumenter exited during startup.');
      }
      _ready = true;
    } catch (error) {
      _lost(process, error);
      process.kill();
      if (error is InstrumenterUnavailable) rethrow;
      throw InstrumenterUnavailable('Instrumenter startup failed: $error');
    }
  }

  void _lost(Process process, Object error) {
    if (!identical(_process, process)) return;
    _process = null;
    _ready = false;
    final greeting = _greeting;
    _greeting = null;
    final failure = InstrumenterUnavailable('Instrumenter unavailable: $error');
    if (greeting != null && !greeting.isCompleted) greeting.completeError(failure);
    for (final pending in _pending.values) {
      if (!pending.isCompleted) pending.completeError(failure);
    }
    _pending.clear();
  }

  Future<void> instrument(String kind, String source, String output) async {
    // Retry only transport/process failures. Invalid student code must be
    // returned immediately with its original diagnostics, not retried.
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await _ensureStarted();
        final process = _process;
        if (process == null) throw InstrumenterUnavailable('Instrumenter exited before request.');
        final id = ++_requestId;
        final waiting = Completer<Map<String, dynamic>>();
        _pending[id] = waiting;
        try {
          process.stdin.writeln(jsonEncode({
            'id': id, 'kind': kind, 'source': source, 'out': output,
          }));
          await process.stdin.flush();
          final result = await waiting.future.timeout(const Duration(seconds: 60));
          if (result['ok'] != true) {
            final message = result['error']?.toString() ?? 'Instrumentation failed.';
            final diagnostics = (result['diagnostics'] as List?)
                    ?.whereType<Map>()
                    .map((entry) => entry.map(
                        (key, value) => MapEntry(key.toString(), value)))
                    .toList() ??
                <Map<String, dynamic>>[];
            if (diagnostics.isNotEmpty) {
              throw StudentDiagnosticsException(message, diagnostics);
            }
            throw FormatException(message);
          }
          return;
        } on TimeoutException {
          _lost(process, 'request timed out');
          process.kill();
          throw InstrumenterUnavailable('Instrumenter request timed out.');
        } on FileSystemException catch (error) {
          _lost(process, error);
          process.kill();
          throw InstrumenterUnavailable('Instrumenter pipe failed: $error');
        } on StateError catch (error) {
          _lost(process, error);
          process.kill();
          throw InstrumenterUnavailable('Instrumenter closed its input: $error');
        } finally {
          _pending.remove(id);
        }
      } on InstrumenterUnavailable {
        if (attempt == 1) rethrow;
      }
    }
  }
}
