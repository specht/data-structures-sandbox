// Keeps the JavaScript parser and formatter loaded between edits.
//
// One JSON request and one JSON reply per line (like tool/instrument_daemon.dart).
// This process never runs student code; implementations run in separate,
// killable worker processes (sandbox_worker.mjs).
//
//   {"id": 1, "op": "build", "kind": "stack", "className": "MyArrayStack",
//    "source": "/…/alice/my_array_stack.js", "out": "DIR"}
//   {"id": 2, "op": "format", "content": "…"}
//
// `build` checks the syntax, the class, the imports and undefined names, then
// writes DIR/structure.mjs (the instrumented copy), DIR/source.txt (the file as
// built) and DIR/build.json.
import {createRequire} from 'node:module';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';

import {diagnostic, findClass, importProblems, methodInfo, parse, staticErrors, structureCopy, syntaxDiagnostic}
  from './instrument.mjs';

const require = createRequire(import.meta.url);
let beautify = null;

const failure = (error, diagnostics = []) => ({ok: false, error, diagnostics});

function build({kind, className, source, out}) {
  if (![kind, className, source, out].every(value => typeof value === 'string')) throw new Error('Invalid build request.');
  const content = readFileSync(source, 'utf8');
  let ast;
  try {
    ast = parse(content);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return failure('Fix the errors in your JavaScript source and save again.', [syntaxDiagnostic(error)]);
  }
  const imports = importProblems(ast);
  if (imports.length) return failure('Fix the marked import and save again.', imports);
  const classes = findClass(ast, className);
  if (classes.length !== 1) {
    return failure(`Expected one class named ${className}.`,
      [diagnostic(1, 1, 1, `Expected one top-level class named ${className} (keep the name from the starter).`)]);
  }
  const cls = classes[0];
  const methods = methodInfo(cls);
  if (!Object.keys(methods).some(name => !name.startsWith('_'))) {
    return failure('No public methods with supported parameter types found.',
      [diagnostic(cls.loc.start.line, cls.loc.start.column + 1, 5, 'No public methods found.')]);
  }
  const errors = staticErrors(ast);
  if (errors.length) return failure('Fix the errors in your JavaScript source and save again.', errors);
  mkdirSync(out, {recursive: true});
  writeFileSync(`${out}/structure.mjs`, structureCopy(content, ast, cls));
  writeFileSync(`${out}/source.txt`, content);
  writeFileSync(`${out}/build.json`, JSON.stringify({kind, className, sourcePath: source, methods}));
  return {ok: true};
}

function format(content) {
  try {
    parse(content);
  } catch (error) {
    const where = error.loc ? `line ${error.loc.line}: ` : '';
    return {ok: false, error: `JavaScript could not format this draft: ${where}${String(error.message).replace(/\s*\(\d+:\d+\)$/, '')}.`};
  }
  beautify ??= require('../../vendor/javascript/js-beautify/javascript/index.js');
  let formatted = beautify(content, {indent_size: 2, end_with_newline: true, preserve_newlines: true,
    max_preserve_newlines: 2, brace_style: 'collapse'});
  if (!formatted.endsWith('\n')) formatted += '\n';
  return {ok: true, content: formatted};
}

function handle(request) {
  if (request.op === 'build') return build(request);
  if (request.op === 'format') {
    if (typeof request.content !== 'string') throw new Error('Invalid format request.');
    return format(request.content);
  }
  throw new Error(`Unknown operation: ${request.op}`);
}

const reply = message => process.stdout.write(`${JSON.stringify(message)}\n`);
console.log = console.info = console.warn = console.debug = (...args) => console.error(...args);

reply({type: 'ready', pid: process.pid});
createInterface({input: process.stdin, crlfDelay: Infinity}).on('line', line => {
  if (!line.trim()) return;
  let id = null;
  let answer;
  try {
    const request = JSON.parse(line);
    if (!request || typeof request !== 'object' || !Number.isInteger(request.id)) throw new Error('Invalid request.');
    id = request.id;
    answer = handle(request);
  } catch (error) {
    answer = {ok: false, error: String(error?.message ?? error), internal: true};
  }
  reply({id, ...answer});
});
