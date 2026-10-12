"""Keeps the Python checks and the formatter loaded between edits.

One JSON request and one JSON reply per line (like tool/instrument_daemon.dart).
This process never runs student code; implementations run in separate,
killable worker processes (sandbox_worker.py).

    {"id": 1, "op": "build", "kind": "stack", "className": "MyArrayStack",
     "source": "/…/alice/my_array_stack.py", "out": "DIR"}
    {"id": 2, "op": "format", "content": "…"}

`build` checks the syntax, the class and undefined names (pyflakes), then
writes DIR/algorithm.py (a byte-identical copy) and DIR/build.json for the
worker. Problems come back as {ok: false, error, diagnostics} with the
student's own lines.
"""

import ast
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VENDOR = os.path.join(os.path.dirname(os.path.dirname(HERE)), "vendor", "python")
if VENDOR not in sys.path:
    sys.path.append(VENDOR)


def diagnostic(line, column, length, message):
    return {
        "line": max(1, int(line or 1)),
        "column": max(1, int(column or 1)),
        "length": max(1, min(40, int(length or 1))),
        "message": message,
        "severity": "error",
    }


_ERRORS = None


def pyflakes_errors(tree, path):
    global _ERRORS
    from pyflakes import checker, messages

    if _ERRORS is None:
        _ERRORS = tuple(
            getattr(messages, name)
            for name in (
                "UndefinedName", "UndefinedLocal", "UndefinedExport", "DuplicateArgument",
                "ReturnOutsideFunction", "YieldOutsideFunction", "ContinueOutsideLoop",
                "BreakOutsideLoop", "TwoStarredExpressions", "TooManyExpressionsInStarredAssignment",
            )
            if hasattr(messages, name)
        )
    result = []
    found = checker.Checker(tree, filename=path)
    for message in sorted(found.messages, key=lambda m: (m.lineno, getattr(m, "col", 0))):
        if not isinstance(message, _ERRORS):
            continue
        name = message.message_args[0] if message.message_args else None
        result.append(diagnostic(message.lineno, getattr(message, "col", 0) + 1,
                                 len(name) if isinstance(name, str) else 1,
                                 message.message % message.message_args))
        if len(result) >= 30:
            break
    return result


def failure(message, diagnostics=()):
    return {"ok": False, "error": message, "diagnostics": list(diagnostics)}


def build(request):
    kind, class_name, source, out = (request.get(key) for key in ("kind", "className", "source", "out"))
    if not all(isinstance(value, str) for value in (kind, class_name, source, out)):
        raise ValueError("Invalid build request.")
    with open(source, encoding="utf-8") as file:
        content = file.read()
    try:
        tree = ast.parse(content, filename=source)
        compile(content, source, "exec", dont_inherit=True)
    except SyntaxError as error:
        line, column = error.lineno or 1, error.offset or 1
        end = getattr(error, "end_offset", None)
        length = end - column if end and getattr(error, "end_lineno", None) == line and end > column else 1
        return failure("Fix the errors in your Python source and save again.",
                       [diagnostic(line, column, length, error.msg or "Invalid syntax.")])
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == class_name]
    if len(classes) != 1:
        return failure(f"Expected one class named {class_name}.",
                       [diagnostic(1, 1, 1, f"Expected one class named {class_name} (keep the name from the starter).")])
    cls = classes[0]
    public = [
        node for node in cls.body
        if isinstance(node, ast.FunctionDef) and not node.name.startswith("_")
        and not any(isinstance(d, ast.Name) and d.id in ("staticmethod", "classmethod", "property")
                    for d in node.decorator_list)
    ]
    if not public:
        return failure("No public methods with supported parameter types found.",
                       [diagnostic(cls.lineno, cls.col_offset + 1, 5, "No public methods found.")])
    for node in cls.body:
        if isinstance(node, ast.FunctionDef) and node.name == "__init__":
            arguments = node.args
            required = len(arguments.posonlyargs) + len(arguments.args) - len(arguments.defaults)
            if required > 1 or any(default is None for default in arguments.kw_defaults):
                return failure(
                    f"The sandbox cannot create {class_name}(): the class needs a constructor without parameters.",
                    [diagnostic(node.lineno, node.col_offset + 1, 12,
                                "The constructor must work without arguments (give them default values).")],
                )
    errors = pyflakes_errors(tree, source)
    if errors:
        return failure("Fix the errors in your Python source and save again.", errors)
    os.makedirs(out, exist_ok=True)
    shutil.copyfile(source, os.path.join(out, "algorithm.py"))
    with open(os.path.join(out, "build.json"), "w", encoding="utf-8") as file:
        json.dump({"kind": kind, "className": class_name, "sourcePath": source}, file)
    return {"ok": True}


_black = None


def format_source(content):
    global _black
    try:
        ast.parse(content)
    except SyntaxError as error:
        return {"ok": False, "error": f"Python could not format this draft: line {error.lineno}: {error.msg}."}
    if _black is None:
        import black

        _black = black
    try:
        return {"ok": True, "content": _black.format_str(content, mode=_black.Mode())}
    except Exception as error:  # noqa: BLE001
        return {"ok": False, "error": f"Python could not format this draft: {error}"}


def handle(request):
    op = request.get("op")
    if op == "build":
        return build(request)
    if op == "format":
        if not isinstance(request.get("content"), str):
            raise ValueError("Invalid format request.")
        return format_source(request["content"])
    raise ValueError(f"Unknown operation: {op}")


def main():
    sys.setrecursionlimit(10000)
    out = sys.stdout
    sys.stdout = sys.stderr  # Nothing but replies on the protocol channel.
    out.write(json.dumps({"type": "ready", "pid": os.getpid()}) + "\n")
    out.flush()
    for line in sys.stdin:
        if not line.strip():
            continue
        request_id = None
        try:
            request = json.loads(line)
            if not isinstance(request, dict) or not isinstance(request.get("id"), int):
                raise ValueError("Invalid request.")
            request_id = request["id"]
            reply = handle(request)
        except Exception as error:  # noqa: BLE001 - never die on one request
            reply = {"ok": False, "error": str(error), "internal": True}
        out.write(json.dumps({"id": request_id, **reply}) + "\n")
        out.flush()


if __name__ == "__main__":
    main()
