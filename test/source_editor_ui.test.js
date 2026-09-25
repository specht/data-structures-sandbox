'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../web/editor.js'), 'utf8');
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
  setAttribute(key, value) { this.attrs[key] = value; }
}
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  },
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
let allowDiscard = false;
const window = {
  addEventListener(name, handler) { handlers.set(name, handler); },
  confirm() { return allowDiscard; },
};
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
shortcuts['Ctrl-Shift-K'](cm);
shortcuts['Cmd-Shift-K'](cm);
assert.deepEqual(commands, ['deleteLine', 'deleteLine']);
cm.setValue('class A { int x=1; }');
assert.equal(element('source-save').disabled, false);
assert.equal(element('source-discard').disabled, false);
assert(!cm.lines.has('1:source-execution-line'), 'Draft lines must not use stale trace highlighting.');
editor.renderSource({lines: ['STALE TRACE']});
assert.equal(cm.getValue(), 'class A { int x=1; }', 'Trace must not overwrite draft.');
editor.sourceChanged();
assert.equal(cm.getValue(), 'class A { int x=1; }');
assert.equal(editor.beforeSelection(), false, 'Changing implementation must confirm draft discard.');
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
assert.equal(cm.getValue(), 'class A { int x=2; }', 'Revert requires confirmation.');
allowDiscard = true;
element('source-discard').onclick();
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
assert.equal(editor.beforeSelection(), true);
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
