// A single, persistent analyzer process shared by all browser sessions.
// Student implementations still run in separate, killable worker processes.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'languages.dart' show dartToolchain;

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
  /// The Dart analyzer daemon (tool/instrument_daemon.dart). The other
  /// languages pass the command of their own daemon (languages/*/), which
  /// answers `build` and `format` requests with the same reply format.
  InstrumentClient({
    Future<List<String>> Function()? command,
    this.label = 'instrumenter',
  }) : _command = command ??
            (() async => [await dartToolchain.executable(), 'run', 'tool/instrument_daemon.dart']);

  final Future<List<String>> Function() _command;

  /// Prefix of this daemon's lines in the terminal.
  final String label;

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
    // May throw a subclass of InstrumenterUnavailable (toolchain missing).
    final command = await _command();
    late final Process process;
    try {
      process = await Process.start(
        command.first, command.sublist(1),
        workingDirectory: Directory.current.path,
      );
    } catch (error) {
      throw InstrumenterUnavailable('Cannot start the persistent $label: $error');
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
          stderr.writeln('[$label] $line');
        }
      },
      onError: (Object error) => _lost(process, error),
      onDone: () => _lost(process, 'stdout closed'),
    );
    process.stderr.transform(utf8.decoder).listen((text) {
      stderr.write('[$label] $text');
    });
    unawaited(process.exitCode.then((code) =>
        _lost(process, 'process exited with code $code')));
    try {
      // The JVM and the Java compiler may start slowly on school computers.
      await greeting.future.timeout(const Duration(seconds: 90));
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

  /// Stops the daemon so that a short-lived program (a test) can exit; the
  /// open pipes would otherwise keep it running. A later request restarts it.
  Future<void> dispose() async {
    final process = _process;
    if (process == null) return;
    _lost(process, 'disposed');
    process.kill();
    await process.exitCode.timeout(const Duration(seconds: 5), onTimeout: () {
      process.kill(ProcessSignal.sigkill);
      return -1;
    });
  }

  /// Dart: writes the instrumented copy of [source] into [output].
  Future<void> instrument(String kind, String source, String output) async {
    await _request({'kind': kind, 'source': source, 'out': output}, studentErrors: true);
  }

  /// Other languages: checks [source] and writes everything its worker needs
  /// into [output]. Throws [StudentDiagnosticsException] for invalid code.
  Future<void> build(String kind, String className, String source, String output) async {
    await _request({
      'op': 'build', 'kind': kind, 'className': className, 'source': source, 'out': output,
    }, studentErrors: true);
  }

  /// Other languages: formats an editor draft. Returns `{ok, content}` or
  /// `{ok: false, error}`.
  Future<Map<String, dynamic>> format(String content) =>
      _request({'op': 'format', 'content': content}, studentErrors: false);

  Future<Map<String, dynamic>> _request(Map<String, Object?> payload,
      {required bool studentErrors}) async {
    // Retry only transport/process failures. Invalid student code must be
    // returned immediately with its original diagnostics, not retried.
    for (var attempt = 0;; attempt++) {
      try {
        await _ensureStarted();
        final process = _process;
        if (process == null) throw InstrumenterUnavailable('Instrumenter exited before request.');
        final id = ++_requestId;
        final waiting = Completer<Map<String, dynamic>>();
        // A daemon failure completes every pending request with an error; one
        // that is not awaited yet must not become an uncaught async error.
        unawaited(waiting.future.then((_) {}, onError: (Object _) {}));
        _pending[id] = waiting;
        try {
          // No flush(): two builds at the same moment (two students saving,
          // or a save during the class progress sweep) would flush the same
          // pipe concurrently and throw "StreamSink is bound to a stream",
          // which looks like a daemon crash. The sink delivers lines itself.
          process.stdin.writeln(jsonEncode({'id': id, ...payload}));
          final result = await waiting.future.timeout(const Duration(seconds: 60));
          if (studentErrors && result['ok'] != true) {
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
          return result;
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
        if (attempt >= 1) rethrow;
      }
    }
  }
}
