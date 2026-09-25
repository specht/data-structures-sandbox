// Optional developer test. Runs with Node.js only; the classroom app requires
// no Node.js, npm or browser build step.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.attrs = {};
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.classList = {
      add: name => this._setClass(name, true),
      remove: name => this._setClass(name, false),
      toggle: (name, on) => this._setClass(name, on),
      contains: name => (this.attrs.class || '').split(' ').includes(name),
    };
  }
  _setClass(name, on) {
    const classes = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
    if (on) classes.add(name); else classes.delete(name);
    this.attrs.class = [...classes].join(' ');
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  append(...parts) { this.children.push(...parts); }
  replaceChildren(...parts) { this.children = parts; }
  remove() { this.removed = true; }
  addEventListener() {}
  focus() {}
  querySelectorAll(selector) {
    const result = [];
    const matching = child => selector.startsWith('.') &&
      child.classList?.contains(selector.slice(1));
    const walk = e => { for (const c of e.children || []) {
      if (matching(c)) result.push(c);
      walk(c);
    }};
    walk(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const ids = new Map();
const document = {
  getElementById: id => {
    if (!ids.has(id)) ids.set(id, new Element(id));
    return ids.get(id);
  },
  createElementNS: (_, tag) => new Element(tag),
  createElement: tag => new Element(tag),
  createTextNode: text => ({textContent:text}),
  addEventListener() {},
  querySelectorAll() { return []; },
};
const context = vm.createContext({
  document, console, location:{protocol:'http:',host:'localhost:8081'},
  window:{addEventListener(){}},clearInterval:()=>{},setInterval:()=>0,clearTimeout:()=>{},setTimeout:()=>0,
  WebSocket:class {static OPEN=1;addEventListener(){} send(){}},
  performance:{now:()=>0}, requestAnimationFrame:()=>{},
  HTMLInputElement:class {}, HTMLTextAreaElement:class {},
  HTMLSelectElement:class {},HTMLButtonElement:class {},
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../web/app.js'),'utf8'), context);
const run = source => vm.runInContext(source, context);

run(`structure='unsorted_array_list';ensureViewport(structure);arrayListState={cells:[5,8,3,null,null,null,null,null],size:3};renderArrayList();`);
const pane=document.getElementById('stack-view');
assert.equal(pane.querySelectorAll('.memory-cell').length,8);
assert.deepEqual(pane.querySelectorAll('.memory-value').map(el=>el.textContent),['5','8','3','·','·','·','·','·']);
run(`instantArrayList({kind:'memoryWriteAndSettle',index:2,oldValue:3,value:8,snapshot:{cells:[5,8,8,3,null,null,null,null],size:3}});`);
assert.equal(pane.querySelectorAll('.memory-cell').filter(el=>el.classList.contains('selected')).length,1);
run(`structure='sorted_array_list';arrayListState={cells:[-3,2,2,8,null,null,null,null],size:4};renderArrayList();`);
assert.equal(pane.querySelectorAll('.queue-occupied').length,4);
run(`structure='unsorted_linked_list';`);
assert.doesNotThrow(()=>run(`autoFrameLinked([{kind:'snapshot',head:1,nodes:[{id:1,value:3,next:2},{id:2,value:5,next:null}]}]);`));
console.log('PASS: unsorted/sorted list rendering and array write highlighting');
