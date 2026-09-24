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
run(`clearView();structure='tree';applySnapshot({root:1,nodes:[
{id:1,value:20,left:2,right:3},{id:2,value:10,left:null,right:null},{id:3,value:30,left:null,right:null}
]});renderAll();`);
const left=run(`links.get('1:left')`),right=run(`links.get('1:right')`);
function shaft(edge){return edge.querySelector('.arrow-shaft').getAttribute('d');}
function tip(edge){return edge.querySelector('.arrow-tip').getAttribute('points').split(' ')[0].split(',').map(Number);}
assert.match(shaft(left),/ L /);
assert.match(shaft(right),/ L /);
assert.doesNotMatch(shaft(left),/ C /);
const [x,y]=tip(left), centre=run('treeCentre(nodes.get(2))');
assert.ok(Math.abs(Math.hypot(x-centre.x,y-centre.y)-37)<.05,'Tip clipped at circle outline');
run('treeEdgeMotion=.7;renderEdges()');
assert.match(shaft(left),/ C /,'Curves during transition');
run('treeEdgeMotion=0;renderEdges()');
assert.match(shaft(left),/ L /,'Returns to a straight segment');
const rootLabel=document.getElementById('references').querySelector('.ref-label');
const rootPointer=document.getElementById('references').querySelector('.ref-arrow');
assert.equal(Number(rootLabel.getAttribute('x')),run('treeCentre(nodes.get(1)).x'),
  'Root label must be centred over the root node');
assert.match(shaft(rootPointer),/ L /,'Root pointer must be straight at rest');
const [rx,ry]=tip(rootPointer);
assert.equal(rx,run('treeCentre(nodes.get(1)).x'));
assert.equal(ry,run('nodes.get(1).y-1'));
run('nodes.get(1).x+=25;renderReferences()');
assert.equal(Number(rootLabel.getAttribute('x'))+25,
  Number(document.getElementById('references').querySelector('.ref-label').getAttribute('x')),
  'Root label must follow the root node during layout changes');
console.log('PASS: Tree edges are centre-clipped, straight at rest, curved while moving.');
