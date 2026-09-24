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

run(`structure='array_heap';ensureViewport(structure);heapState={cells:[3,5,5,12,13,8],heapOrder:true};heapHot=[2,5];renderHeap();`);
const pane=document.getElementById('stack-view');
assert.equal(pane.querySelectorAll('.heap-node').length,6,'One tree node per active array cell');
assert.equal(pane.querySelectorAll('.heap-cell').length,6,'Dynamic array shows only allocated cells');
assert.equal(pane.querySelectorAll('.heap-hot').length,2,'Both swap indices highlighted in tree');
assert.equal(pane.querySelectorAll('.memory-cell').filter(el=>el.classList.contains('selected')).length,2,'Same swap indices highlighted in array');
const values=pane.querySelectorAll('.heap-node-value').map(el=>el.textContent);
assert.deepEqual(values,['3','5','5','12','13','8']);
assert.equal(pane.querySelectorAll('.heap-index-edge').length,5,'Array indices, not references, define edges');
run(`instantHeap({kind:'memoryWriteAndSettle',snapshot:{cells:[3,5,8,12,13,5],heapOrder:true},a:2,b:5});`);
assert.deepEqual(pane.querySelectorAll('.heap-node-value').map(el=>el.textContent),['3','5','8','12','13','5']);
assert.equal(pane.querySelectorAll('.heap-hot').length,2);
run(`instantHeap({kind:'heapRead',index:3,value:12});`);
assert.equal(pane.querySelectorAll('.heap-hot').length,1,'Read highlights corresponding tree index');
assert.equal(pane.querySelectorAll('.memory-cell').filter(el=>el.classList.contains('selected')).length,1,'Read highlights corresponding array index');
run(`instantHeap({kind:'snapshot',snapshot:{cells:[3,5,5,12,13,8],heapOrder:true}});`);
assert.equal(pane.querySelectorAll('.heap-hot').length,0,'Historical snapshot clears previous highlight');
const previous=run('viewport.w');
run(`autoFrameHeap([{kind:'snapshot',cells:Array.from({length:63},(_,i)=>i)}]);`);
assert.ok(run('viewport.w')>previous,'Larger heap should automatically zoom out');
run(`zoomScene(1.2);autoFrameHeap([{kind:'snapshot',cells:Array.from({length:127},(_,i)=>i)}]);`);
const manual=run('viewport.w');
run(`autoFrameHeap([{kind:'snapshot',cells:Array.from({length:127},(_,i)=>i)}]);`);
assert.equal(run('viewport.w'),manual,'Manual camera must take precedence');
run(`fitScene()`);
assert.equal(run('cameraMode'),'auto','Fit resumes automatic heap framing');
assert.ok(run('viewport.w')>=1100,'Fit contains the currently visible heap');
const raw=run(`makeFrames([{kind:'snapshot',cells:[]},{kind:'heapSwap',a:0,b:1},{kind:'snapshot',cells:[5,3],heapOrder:false}])`);
assert.equal(raw.length,1);
assert.equal(raw[0].kind,'memoryWriteAndSettle');
console.log('PASS: heap SVG array + tree projections, read/swap highlight, history and auto-frame');
