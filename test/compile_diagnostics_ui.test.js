// Run from the repository root: node test/compile_diagnostics_ui.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
class Element {
  constructor() {
    this.hidden = false; this.disabled = false; this.textContent = '';
    this.children = []; this.events = {};
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      toggle: (value, active) => active ? classes.add(value) : classes.delete(value),
      contains: value => classes.has(value),
    };
  }
  setAttribute() {}
  addEventListener(event, callback) { this.events[event] = callback; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
}
const elements = new Map();
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  },
  createElement() { return new Element(); },
};
let cm;
function CodeMirror(_container, options) {
  cm = {
    value: options.value, readOnly: options.readOnly, listeners: {}, lines: new Set(),
    marks: [], cursor: null, focused: false, scroll: null,
    setValue(value) { this.value = value; this.listeners.change?.(); },
    getValue() { return this.value; },
    getLine(line) { return this.value.split('\n')[line]; },
    lineCount() { return this.value.split('\n').length; },
    clearHistory() {}, refresh() {}, scrollTo() {},
    setOption(key, value) { this[key] = value; },
    on(key, callback) { this.listeners[key] = callback; },
    addLineClass(line, _where, name) { this.lines.add(`${line}:${name}`); },
    removeLineClass(line, _where, name) { this.lines.delete(`${line}:${name}`); },
    markText(from, to, options) {
      const mark = {from, to, options, removed: false, clear() { this.removed = true; }};
      this.marks.push(mark); return mark;
    },
    scrollIntoView(location) { this.scroll = location; },
    setCursor(location) { this.cursor = location; },
    focus() { this.focused = true; },
  };
  return cm;
}
const requests = [];
const window = {addEventListener() {}, confirm: () => true};
const ctx = vm.createContext({
  document, window, CodeMirror, selectedStudent: 'alice', structure: 'stack',
  ui: {cmdStatus: new Element()},
  socket: {readyState: 1, send: data => requests.push(JSON.parse(data))},
  WebSocket: {OPEN: 1},
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/editor.js'), 'utf8'), ctx);
const editor = window.sandboxEditor;
const problems = document.getElementById('source-problems');
const list = document.getElementById('source-problem-list');
const issue = revision => ({type: 'compileDiagnostics', student: 'alice',
  structure: 'stack', revision, diagnostics: [
    {line: 2, column: 3, length: 3, message: 'Expected a semicolon.'},
  ]});
editor.ready();
assert.equal(requests.at(-1).action, 'readSource');
editor.receiveDiagnostics(issue('rev1')); // Build can fail before readSource returns.
assert.equal(problems.hidden, true);
editor.receive({type: 'sourceFile', student: 'alice', structure: 'stack',
  revision: 'rev1', content: 'class A {\n  bad();\n}'});
assert.equal(problems.hidden, false);
assert(cm.lines.has('1:source-error-line'));
assert.equal(list.children.length, 1);
assert.equal(cm.marks[0].from.line, 1);
assert.equal(cm.marks[0].from.ch, 2);
assert.equal(cm.marks[0].to.ch, 5);
list.children[0].children[0].events.click();
assert.equal(cm.cursor.line, 1);
assert.equal(cm.cursor.ch, 2);
assert(cm.focused);
editor.receiveDiagnostics(issue('stale-revision'));
assert.equal(list.children.length, 1, 'Old compilation result must be ignored.');
cm.setValue('class A {\n  fixed();\n}');
assert.equal(problems.hidden, true, 'Editing removes stale diagnostics.');
assert.equal(cm.marks[0].removed, true);
assert(!cm.lines.has('1:source-error-line'));
editor.receiveDiagnostics(issue('rev1'));
assert.equal(problems.hidden, true, 'Do not mark unsaved drafts.');
editor.receive({type: 'sourceSaved', student: 'alice', structure: 'stack',
  revision: 'rev2', content: cm.getValue()}); // No active save: ignored.
editor.compiled();
assert.equal(problems.hidden, true);
console.log('PASS: original-source diagnostics, deferred loading, click navigation and stale-draft protection.');
