"""Workers of the non-Dart languages, driven exactly like the host drives the
Dart worker: build through the language's daemon, `hello`, then `reset`,
`validateCall` and `run` requests.

    python3 -I -B test/language_workers_test.py [python] [javascript] [java]

For every language and structure: the example template passes every scenario
of tool/student_validation.dart, the starter fails, traces have the Dart
worker's shape, and the traces of all languages agree with each other.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "test"))

from ds_scenarios import STRUCTURES, TRACE_SCENARIOS, cases  # noqa: E402

SCRATCH = tempfile.mkdtemp(prefix="ds-language-workers-")
EVENT_KINDS = {
    "line", "operationStart", "operationEnd", "snapshot", "variableWrite", "visit", "createNode",
    "pointerWrite", "indexWrite", "cellWrite", "localsClear", "retire", "heightWrite", "heapRead",
    "heapWrite", "heapAppend", "heapRemove", "heapSwap", "bucketRead", "bucketWrite", "executionError",
}


class Daemon:
    def __init__(self, command):
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.DEVNULL, text=True, encoding="utf-8", cwd=ROOT)
        ready = json.loads(self.process.stdout.readline())
        assert ready.get("type") == "ready", ready
        self.next = 0

    def request(self, **payload):
        self.next += 1
        self.process.stdin.write(json.dumps({"id": self.next, **payload}) + "\n")
        self.process.stdin.flush()
        reply = json.loads(self.process.stdout.readline())
        assert reply["id"] == self.next, reply
        return reply

    def close(self):
        self.process.stdin.close()
        self.process.wait()
        self.process.stdout.close()


class Language:
    name = ""
    extension = ""
    daemon_command = None
    _daemon = None

    @classmethod
    def daemon(cls):
        if cls._daemon is None:
            cls._daemon = Daemon(cls.daemon_command())
        return cls._daemon

    @classmethod
    def missing(cls):
        """Why this language cannot be tested here, or None."""
        return None

    @classmethod
    def template(cls, variant, kind):
        stem = STRUCTURES[kind][0]
        return os.path.join(ROOT, "templates", variant, stem + cls.extension)

    @classmethod
    def build(cls, kind, source, out):
        """Returns (ok, reply); on success the worker command is cls.worker(out)."""
        reply = cls.daemon().request(op="build", kind=kind, className=STRUCTURES[kind][1],
                                     source=source, out=out)
        return reply.get("ok") is True, reply


class Python(Language):
    name = "python"
    extension = ".py"
    # A runtime error in pop and an endless loop in push of the linked stack example.
    broken = ("value = self.head.value", "value = self.head.missing",
              "        value = self.head.missing", "AttributeError")
    endless = ("        fresh = ListNode(value)\n", "        while True:\n            pass\n        fresh = ListNode(value)\n")

    @staticmethod
    def daemon_command():
        return [sys.executable, "-I", "-B", os.path.join(ROOT, "languages/python/sandbox_daemon.py")]

    @staticmethod
    def worker(out):
        return [sys.executable, "-I", "-B", os.path.join(ROOT, "languages/python/sandbox_worker.py"), out]


class JavaScript(Language):
    name = "javascript"
    extension = ".js"

    @classmethod
    def missing(cls):
        node = os.environ.get("SANDBOX_NODE", "node")
        return None if shutil.which(node) else f"Node.js is not installed ({node} not found)"
    broken = ("const value = this.head.value;", "const value = this.head.missing.value;",
              "    const value = this.head.missing.value;", "TypeError")
    endless = ("    const fresh = new ListNode(value);\n", "    while (true) {}\n    const fresh = new ListNode(value);\n")

    @staticmethod
    def daemon_command():
        return [os.environ.get("SANDBOX_NODE", "node"), os.path.join(ROOT, "languages/javascript/sandbox_daemon.mjs")]

    @staticmethod
    def worker(out):
        return [os.environ.get("SANDBOX_NODE", "node"), os.path.join(ROOT, "languages/javascript/sandbox_worker.mjs"), out]


class Java(Language):
    name = "java"
    extension = ".java"
    broken = ("int value = head.value;", "int value = head.next.next.value;",
              "        int value = head.next.next.value;", "NullPointerException")
    endless = ("        ListNode fresh = new ListNode(value);\n",
               "        while (value == value) {}\n        ListNode fresh = new ListNode(value);\n")
    _classes = None
    EXPORTS = [f"--add-exports=jdk.compiler/com.sun.tools.javac.{package}=ALL-UNNAMED"
               for package in ("api", "code", "file", "parser", "tree", "util")]
    FORMATTER = os.path.join(ROOT, "vendor/java/google-java-format-1.35.0-all-deps.jar")

    @classmethod
    def tool(cls, name):
        home = os.environ.get("SANDBOX_JAVA_HOME") or os.environ.get("JAVA_HOME")
        if home and os.path.exists(os.path.join(home, "bin", name)):
            return os.path.join(home, "bin", name)
        return name

    @classmethod
    def missing(cls):
        for name in ("javac", "java"):
            if not shutil.which(cls.tool(name)):
                return f"no JDK found ({name} is missing; set JAVA_HOME or SANDBOX_JAVA_HOME)"
        return None

    @classmethod
    def classes(cls):
        """The sandbox runtime, compiled like tool/languages.dart does."""
        if cls._classes is None:
            out = os.path.join(SCRATCH, "java-runtime")
            sources = []
            for directory, _, files in os.walk(os.path.join(ROOT, "languages/java/src")):
                sources += [os.path.join(directory, f) for f in files if f.endswith(".java")]
            subprocess.run([cls.tool("javac"), "--release", "17", "-encoding", "UTF-8", "-nowarn", "-d", out,
                            *sorted(sources)], check=True)
            cls._classes = out
        return cls._classes

    @classmethod
    def daemon_command(cls):
        return [cls.tool("java"), *cls.EXPORTS, "-XX:+UseSerialGC", "-cp",
                cls.classes() + os.pathsep + cls.FORMATTER, "sandbox.Daemon", cls.classes()]

    @classmethod
    def worker(cls, out):
        return [cls.tool("java"), "-XX:+UseSerialGC", "-Xshare:auto", "-cp", cls.classes(), "sandbox.Worker", out]


LANGUAGES = {"python": Python, "javascript": JavaScript, "java": Java}


class Worker:
    def __init__(self, command):
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, text=True, encoding="utf-8", cwd=ROOT)
        self.hello = self.receive()

    def receive(self):
        while True:
            line = self.process.stdout.readline()
            if not line:
                raise AssertionError("worker exited: " + self.process.stderr.read()[-3000:])
            message = json.loads(line)
            if message.get("type") in ("executionProgress", "studentOutput"):
                self.output = getattr(self, "output", []) + [message]
                continue
            return message

    def request(self, message):
        self.process.stdin.write(json.dumps({**message, "_diagnostics": True}) + "\n")
        self.process.stdin.flush()
        return self.receive()

    def close(self):
        self.process.kill()
        self.process.wait()
        for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
            stream.close()


def start(language, kind, variant="example", source=None):
    out = tempfile.mkdtemp(dir=SCRATCH)
    ok, reply = language.build(kind, source or language.template(variant, kind), out)
    assert ok, f"{language.name}/{kind}/{variant}: {reply}"
    worker = Worker(language.worker(out))
    assert worker.hello["type"] == "hello", worker.hello
    return worker


def validate(worker, kind):
    """Runs every scenario like Client.validate in tool/host.dart; returns the
    names of the failing scenarios with the first failing reply."""
    failures = []
    for name, calls in cases(kind):
        cleared = worker.request({"action": "reset"})
        assert cleared["type"] == "trace", cleared
        for method, arguments in calls:
            reply = worker.request({"action": "validateCall", "method": method, "arguments": arguments})
            if reply.get("type") != "validationCall" or reply.get("ok") is not True:
                failures.append((name, method, arguments, reply))
                break
    return failures


def run_trace(worker, kind):
    commands = [{"method": m, "arguments": a} for m, a in TRACE_SCENARIOS[kind]]
    return worker.request({"action": "run", "commands": commands, "reset": True})


def normalized(trace):
    """What every language must agree on: the events without source lines,
    without per-language read events, and the snapshots."""
    result = []
    for step in trace["steps"]:
        kind = step["kind"]
        if kind in ("line", "visit", "variableWrite", "localsClear"):
            continue
        step = {k: v for k, v in step.items() if k not in ("line", "description")}
        result.append(step)
    return result


class WorkerTests(unittest.TestCase):
    languages = []

    def test_examples_pass_every_scenario(self):
        for language in self.languages:
            for kind in STRUCTURES:
                with self.subTest(language=language.name, kind=kind):
                    worker = start(language, kind)
                    try:
                        hello = worker.hello["trace"]
                        self.assertEqual(hello["structure"], kind)
                        self.assertEqual(hello["steps"][0]["kind"], "snapshot")
                        self.assertEqual(hello["values"], [])
                        names = {method["name"] for method in hello["methods"]}
                        for method, _ in TRACE_SCENARIOS[kind]:
                            self.assertIn(method, names)
                        self.assertEqual(validate(worker, kind), [])
                    finally:
                        worker.close()

    def test_starters_compile_and_fail(self):
        for language in self.languages:
            for kind in STRUCTURES:
                with self.subTest(language=language.name, kind=kind):
                    worker = start(language, kind, "starter")
                    try:
                        self.assertNotEqual(validate(worker, kind), [])
                    finally:
                        worker.close()

    def test_traces_have_the_dart_shape(self):
        for language in self.languages:
            for kind in STRUCTURES:
                with self.subTest(language=language.name, kind=kind):
                    worker = start(language, kind)
                    try:
                        trace = run_trace(worker, kind)
                        self.assertEqual(trace["type"], "trace", trace)
                        planned = len(TRACE_SCENARIOS[kind])
                        self.assertEqual(trace["calls"], {"planned": planned, "completed": planned,
                                                          "stoppedEarly": False, "fromEmpty": True})
                        kinds = [step["kind"] for step in trace["steps"]]
                        self.assertTrue(set(kinds) <= EVENT_KINDS, set(kinds) - EVENT_KINDS)
                        ends = [step for step in trace["steps"] if step["kind"] == "operationEnd"]
                        self.assertEqual(len(ends), planned)
                        self.assertTrue(all(end["ok"] for end in ends), ends)
                        self.assertIn("line", kinds)
                        lines = [step["line"] for step in trace["steps"] if step["kind"] == "line"]
                        self.assertTrue(all(1 <= line <= len(trace["source"]["lines"]) for line in lines))
                        expected = {
                            "stack": {"cellWrite", "indexWrite"},
                            "array_queue": {"cellWrite", "indexWrite"},
                            "unsorted_array_list": {"cellWrite", "indexWrite"},
                            "sorted_array_list": {"cellWrite", "indexWrite"},
                            "array_heap": {"heapAppend", "heapSwap", "heapRemove", "heapRead"},
                            "hash": {"createNode", "bucketWrite", "bucketRead"},
                            "tree": {"createNode", "pointerWrite", "retire"},
                            "avl": {"createNode", "pointerWrite", "heightWrite", "retire"},
                        }.get(kind, {"createNode", "pointerWrite"})
                        self.assertTrue(expected <= set(kinds), expected - set(kinds))
                        if kind == "avl":
                            audits = [s["avl"] for s in trace["steps"] if s["kind"] == "snapshot"]
                            self.assertTrue(audits[-1]["balanced"] and audits[-1]["heights"])
                        if kind in ("tree", "avl", "linked_stack", "linked_queue", "sorted_linked_list", "unsorted_linked_list"):
                            pointer = [s for s in trace["steps"] if s["kind"] == "pointerWrite" and s["from"].startswith("root:")]
                            self.assertTrue(pointer, "assignments to head/root are traced")
                        if kind in ("stack",):
                            self.assertTrue(any(s["kind"] == "indexWrite" and s["name"] == "top" for s in trace["steps"]))
                        if kind in ("sorted_array_list", "unsorted_array_list"):
                            self.assertTrue(any(s["kind"] == "indexWrite" and s["name"] == "size" for s in trace["steps"]))
                        if kind == "array_queue":
                            names = {s["name"] for s in trace["steps"] if s["kind"] == "indexWrite"}
                            self.assertEqual(names, {"front", "rear", "size"})
                    finally:
                        worker.close()

    def test_traces_agree_across_languages(self):
        if len(self.languages) < 2:
            self.skipTest("only one language")
        for kind in STRUCTURES:
            traces = {}
            for language in self.languages:
                worker = start(language, kind)
                try:
                    traces[language.name] = normalized(run_trace(worker, kind))
                finally:
                    worker.close()
            first, *others = traces
            for other in others:
                with self.subTest(kind=kind, languages=(first, other)):
                    self.assertEqual(traces[first], traces[other])

    def test_errors_and_runaway_loops(self):
        for language in self.languages:
            find, replace, failing_line, error_name = language.broken
            source = os.path.join(SCRATCH, "my_linked_stack" + language.extension)
            with open(language.template("example", "linked_stack"), encoding="utf-8") as file:
                text = file.read()
            broken = text.replace(find, replace)
            self.assertNotEqual(broken, text)
            with open(source, "w", encoding="utf-8") as file:
                file.write(broken)
            worker = start(language, "linked_stack", source=source)
            try:
                worker.request({"action": "run", "method": "push", "arguments": [1]})
                failed = worker.request({"action": "run", "method": "pop", "arguments": []})
                self.assertEqual(failed["type"], "executionError")
                line = broken.split("\n").index(failing_line) + 1
                self.assertEqual(failed["error"]["line"], line)
                self.assertIn(error_name, failed["error"]["message"])
                self.assertEqual(failed["steps"][-1]["kind"], "executionError")
            finally:
                worker.close()
            find, replace = language.endless
            endless = text.replace(find, replace, 1)
            self.assertNotEqual(endless, text)
            with open(source, "w", encoding="utf-8") as file:
                file.write(endless)
            worker = start(language, "linked_stack", source=source)
            try:
                failed = worker.request({"action": "run", "method": "push", "arguments": [1]})
                self.assertEqual(failed["type"], "executionError")
                self.assertIn("Trace limit reached", failed["error"]["message"])
            finally:
                worker.close()

    def test_invalid_requests(self):
        for language in self.languages:
            worker = start(language, "stack")
            try:
                reply = worker.request({"action": "run", "method": "nope", "arguments": []})
                self.assertEqual(reply["type"], "error")
                self.assertIn("Unknown method: nope", reply["message"])
                reply = worker.request({"action": "run", "method": "push", "arguments": [5000]})
                self.assertIn("integer range", reply["message"])
                self.assertEqual(worker.request({"action": "ping"})["type"], "pong")
            finally:
                worker.close()


def main():
    names = [arg for arg in sys.argv[1:] if not arg.startswith("-")] or list(LANGUAGES)
    languages = []
    for name in names:
        reason = LANGUAGES[name].missing()
        if reason:
            print(f"SKIP: {name}: {reason}")
        else:
            languages.append(LANGUAGES[name])
    WorkerTests.languages = languages
    try:
        unittest.main(argv=[sys.argv[0], "-v"])
    finally:
        for language in WorkerTests.languages:
            if language._daemon is not None:
                language._daemon.close()
        shutil.rmtree(SCRATCH, ignore_errors=True)


if __name__ == "__main__":
    main()
