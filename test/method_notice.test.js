// The notice for methods missing from an older file, and stub insertion into
// the editor draft (never directly into the saved file).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../web/js/editor.js'), 'utf8');
const elements = new Map(), requests = [];
class Element {
  constructor() {
    this.hidden = false; this.disabled = false; this.textContent = ''; this.attrs = {};
    const classes = new Set();
    this.classList = {
      add: key => classes.add(key), remove: key => classes.delete(key),
      toggle: (key, on) => on ? classes.add(key) : classes.delete(key),
      contains: key => classes.has(key),
    };
  }
  addEventListener(name, handler) { this[`on${name}`] = handler; }
  removeEventListener(name, handler) { if (this[`on${name}`] === handler) delete this[`on${name}`]; }
  showModal() { this.open = true; }
  close() { this.open = false; this.onclose?.(); }
  setAttribute(key, value) { this.attrs[key] = value; }
  append(...children) { (this.children ??= []).push(...children); }
  replaceChildren(...children) { this.children = children; }
  get style() { return (this._style ??= {}); }
}
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  },
  createElement: () => new Element(),
};
let cm;
function CodeMirror(container, options) {
  cm = {
    value: options.value, listeners: {}, origins: [], cursor: null,
    setValue(value) { this.value = value; this.listeners.change?.(this, {origin: 'setValue'}); },
    getValue() { return this.value; }, clearHistory() {}, refresh() {}, scrollTo() {},
    setOption(name, value) { this[name] = value; }, getOption(name) { return this[name]; },
    on(name, callback) { this.listeners[name] = callback; },
    lineCount() { return this.value.split('\n').length; },
    lastLine() { return this.lineCount() - 1; }, getLine(n) { return this.value.split('\n')[n]; },
    operation(run) { run(); },
    replaceRange(text, from, to, origin) {
      this.origins.push(origin); this.value = text;
      this.listeners.change?.(this, {origin, text: [text]});
    },
    setCursor(position) { this.cursor = position; },
    addLineClass() {}, removeLineClass() {}, scrollIntoView() {},
    somethingSelected() { return false; },
  };
  return cm;
}
const window = {addEventListener() {}};
const ctx = vm.createContext({
  document, window, CodeMirror, selectedStudent: 'alice', structure: 'tree',
  ui: {cmdStatus: new Element()},
  socket: {readyState: 1, send: value => requests.push(JSON.parse(value))},
  WebSocket: {OPEN: 1},
});
vm.runInContext(source, ctx);
const $ = id => document.getElementById(id);
const editor = window.sandboxEditor;
const old = 'class MyBST {\n  void insert(int value) {}\n}\n';

assert.equal($('method-notice').hidden, true, 'No notice before a file is selected');
editor.ready();
editor.missingMethods(['preorder', 'inorder', 'postorder', 'breadthFirst']);
assert.equal($('method-notice').hidden, true, 'No notice before the file is loaded');
editor.receive({type: 'sourceFile', student: 'alice', structure: 'tree', revision: 'r1', content: old});
assert.equal($('method-notice').hidden, false, 'An older file shows the notice');
assert.match($('method-notice-text').textContent,
  /preorder, inorder, postorder and breadthFirst\. They are not in your file yet; Run tests checks them too\./);

$('method-notice-insert').onclick();
const request = requests.at(-1);
assert.deepEqual({action: request.action, revision: request.revision, content: request.content},
  {action: 'insertStubs', revision: 'r1', content: old}, 'The current draft is sent, not a path');
assert.equal($('method-notice-insert').disabled, true, 'One request at a time');

// A reply for an outdated draft must not overwrite newer typing.
const withStubs = 'class MyBST {\n  void insert(int value) {}\n\n  void preorder(void Function(int value) visit) {\n  }\n}\n';
editor.receiveStubs({type: 'sourceStubs', requestId: request.requestId + 1, revision: 'r1',
  student: 'alice', structure: 'tree', variant: '', content: withStubs, inserted: ['preorder']});
assert.equal(cm.getValue(), old, 'A reply to another request is ignored');

editor.receiveStubs({type: 'sourceStubs', requestId: request.requestId, revision: 'r1',
  student: 'alice', structure: 'tree', variant: '', content: withStubs,
  inserted: ['preorder', 'postorder', 'breadthFirst'], existing: ['inorder'],
  signatures: {inorder: 'void inorder(void Function(int value) visit)'}});
assert.equal(cm.getValue(), withStubs, 'Stubs go into the draft');
assert.deepEqual(cm.origins, ['+stubs'], 'One undoable edit');
assert.equal(cm.cursor.line, 3, 'The cursor moves to the first inserted method');
assert.equal($('method-notice').hidden, true, 'The notice hides once stubs are inserted');
assert.equal($('source-save').disabled, false, 'The student saves the draft explicitly');
assert.match($('source-edit-status').textContent, /Inserted preorder, postorder and breadthFirst/);
assert.match($('source-edit-status').textContent,
  /inorder exists with another signature; declare it as void inorder\(void Function\(int value\) visit\)/);
assert.equal(requests.filter(r => r.action === 'saveSource').length, 0, 'Nothing is saved automatically');

// A hello for the still unsaved draft does not bring the notice back.
editor.missingMethods(['preorder', 'inorder', 'postorder', 'breadthFirst']);
assert.equal($('method-notice').hidden, true);
// After saving, the recompiled file reports nothing missing.
editor.missingMethods([]);
assert.equal($('method-notice').hidden, true);

// An error leaves the draft unchanged and explains why.
editor.missingMethods(['inorder']);
$('method-notice-insert').onclick();
const draft = cm.getValue();
editor.receiveStubs({type: 'sourceStubsError', requestId: requests.at(-1).requestId, revision: 'r1',
  student: 'alice', structure: 'tree', variant: '',
  message: 'Fix the compilation errors in the draft first, then insert the method stubs.'});
assert.equal(cm.getValue(), draft);
assert.match($('source-edit-status').textContent, /Fix the compilation errors/);
console.log('PASS: missing-method notice and stub insertion into the editor draft');
