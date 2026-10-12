'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../web/js/editor.js'), 'utf8');
const elements = new Map(), handlers = new Map(), requests = [], commands = [];
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
let cm, shortcuts;
function CodeMirror(container, options) {
  shortcuts = options.extraKeys;
  cm = {
    value: options.value, readOnly: options.readOnly, lines: new Set(), listeners: {},
    setValue(value) { this.value = value; this.listeners.change?.(); },
    getValue() { return this.value; }, clearHistory() {}, refresh() {}, scrollTo() {},
    setOption(name, value) { this[name] = value; }, on(name, callback) { this.listeners[name] = callback; },
    lineCount() { return this.value.split('\n').length; },
    addLineClass(line, _, name) { this.lines.add(`${line}:${name}`); },
    removeLineClass(line, _, name) { this.lines.delete(`${line}:${name}`); },
    scrollIntoView() {}, execCommand(command) { commands.push(command); },
    somethingSelected() { return false; },
  };
  return cm;
}
const window = {
  addEventListener(name, handler) { handlers.set(name, handler); },
  confirm() { throw new Error('The browser\'s confirm() must not be used.'); },
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const ctx = vm.createContext({
  document, window, CodeMirror, selectedStudent: 'alice', structure: 'stack',
  ui: { cmdStatus: new Element() },
  socket: {readyState: 1, send: value => requests.push(JSON.parse(value))},
  WebSocket: {OPEN: 1},
});
vm.runInContext(source, ctx);
const element = id => document.getElementById(id);
const editor = window.sandboxEditor;
assert.equal(cm.readOnly, 'nocursor', 'No student file should be editable.');
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8'), /id="source-edit"/, 'The Edit button is gone.');
assert.equal(element('source-save').hidden, false);
assert.equal(element('source-discard').hidden, false);
assert.equal(element('source-save').disabled, true);
assert.equal(element('source-discard').disabled, true);
assert.equal(element('source-discard').attrs['aria-label'], 'Revert unsaved edits');
editor.ready();
assert.equal(requests.at(-1).action, 'readSource', 'Select should load the writable file automatically.');
editor.receive({type: 'sourceFile', student: 'alice', structure: 'stack', revision: 'rev1',
  content: 'class A {\n  int? pop() => null;\n}'});
assert.equal(cm.readOnly, false);
assert.equal(element('source-save').disabled, true);
editor.highlight(2);
assert(cm.lines.has('1:source-execution-line'));
shortcuts['Shift-Ctrl-K'](cm);
shortcuts['Shift-Cmd-K'](cm);
assert.deepEqual(commands, ['deleteLine', 'deleteLine']);
cm.setValue('class A { int x=1; }');
assert.equal(element('source-save').disabled, false);
assert.equal(element('source-discard').disabled, false);
assert(!cm.lines.has('1:source-execution-line'), 'Draft lines must not use stale trace highlighting.');
editor.renderSource({lines: ['STALE TRACE']});
assert.equal(cm.getValue(), 'class A { int x=1; }', 'Trace must not overwrite draft.');
editor.sourceChanged();
assert.equal(cm.getValue(), 'class A { int x=1; }');
(async () => {
let switched = 0;
assert.equal(editor.beforeSelection(() => switched++), false, 'Changing implementation must confirm draft discard.');
assert.equal(element('confirm-dialog').open, true, 'The app asks in its own dialog.');
assert.match(element('confirm-message').textContent, /unsaved changes/);
element('confirm-cancel').onclick();
await settle();
assert.equal(element('confirm-dialog').open, false);
assert.equal(switched, 0, 'Keep editing stays on the draft.');
assert.equal(cm.getValue(), 'class A { int x=1; }');
element('source-save').onclick();
assert.deepEqual(requests.at(-1), {action: 'saveSource', revision: 'rev1', content: 'class A { int x=1; }'});
assert.equal(cm.readOnly, false, 'The editor stays writable while saving.');
cm.setValue('class A { int x=2; }');
editor.receive({type: 'sourceSaved', student: 'alice', structure: 'stack',
  revision: 'rev2', content: 'class A { int x=1; }'});
assert.equal(cm.readOnly, false, 'Saving must not leave editing mode.');
assert.equal(cm.getValue(), 'class A { int x=2; }', 'Typing during a save must be preserved.');
assert.equal(element('source-save').disabled, false);
// The host's sourceChanged notification for our own save is not an external edit.
editor.sourceChanged();
assert.equal(element('source-edit-status').classList.contains('source-edit-error'), false);
// Revert discards unsaved edits, never overwrites the saved file.
element('source-discard').onclick();
assert.equal(element('confirm-title').textContent, 'Revert to the saved version?');
element('confirm-close').onclick();
await settle();
assert.equal(cm.getValue(), 'class A { int x=2; }', 'Revert requires confirmation.');
element('source-discard').onclick();
element('confirm-ok').onclick();
await settle();
assert.equal(cm.getValue(), 'class A { int x=1; }');
assert.equal(cm.readOnly, false);
assert.equal(element('source-save').disabled, true);
// External saves refresh clean editors; a newer trace never replaces an in-flight draft.
editor.sourceChanged();
assert.equal(requests.at(-1).action, 'readSource');
editor.receive({type: 'sourceFile', student: 'alice', structure: 'stack',
  revision: 'rev3', content: 'class A { int x=3; }'});
assert.equal(cm.getValue(), 'class A { int x=3; }');
assert.equal(cm.readOnly, false);
cm.setValue('class A { int x=4; }');
assert.equal(editor.beforeSelection(() => switched++), false);
element('confirm-ok').onclick();
await settle();
assert.equal(switched, 1, 'Discard switches to the chosen implementation.');
assert.equal(editor.beforeSelection(() => switched++), true, 'A clean editor switches at once.');
assert.equal(switched, 2);
vm.runInContext("structure='sorted_linked_list'", ctx);
editor.ready();
assert.equal(requests.at(-1).action, 'readSource');
editor.receive({type: 'sourceFile', student: 'alice', structure: 'sorted_linked_list',
  revision: 'list1', content: 'class MySortedLinkedList {}'});
assert.equal(cm.readOnly, false);
editor.clear();
assert.equal(cm.readOnly, 'nocursor');
assert.equal(element('source-editor').classList.contains('source-empty'), true);
console.log('PASS: always-editable source, save without mode switch, revert, conflict-safe refresh, and delete-line shortcuts.');
console.log('PASS: unsaved drafts are confirmed in the app\'s own dialog, never with confirm().');
})().catch(error => { console.error(error); process.exit(1); });
