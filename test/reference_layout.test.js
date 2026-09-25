// Check semantic labels and reference anchoring without running Dart.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.value='';this.textContent='';
    this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]??null}
  append(...parts){this.children.push(...parts)}
  replaceChildren(...parts){this.children=parts}
  addEventListener(){} focus(){} remove(){}
  querySelectorAll(selector){const out=[];const walk=e=>{for(const child of e.children??[]){
    if(selector.startsWith('.')&&child.attrs?.class?.split(' ').includes(selector.slice(1)))out.push(child);
    walk(child);
  }};walk(this);return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null}
}
const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)},
  createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),
  addEventListener(){},querySelectorAll(){return []}};
const context=vm.createContext({document,console,window:{addEventListener(){}},location:{protocol:'http:',host:'localhost:8081'},
  WebSocket:class{static OPEN=1;addEventListener(){}send(){}},setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},
  performance:{now:()=>0},requestAnimationFrame(){},HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8'),context);
const run=src=>vm.runInContext(src,context);
assert.equal(run("STRUCTURE_LABELS.linked_stack"),'Stack (linked list)');
assert.equal(run("STRUCTURE_LABELS.array_queue"),'Queue (circular array)');
assert.equal(run("STRUCTURE_LABELS.node_heap"),'Heap (node-based)');
run("structure='linked_stack';ensureViewport(structure);nodes.set(1,{id:1,x:330,y:276,opacity:1,detached:false});head=1;references={current:1,previous:1};");
const anchors=run('referenceAnchors(referenceValues())');
assert.equal(anchors.get('head').y,226);
assert.equal(anchors.get('current').y,226);
assert.ok(anchors.get('head').x<anchors.get('current').x,
  'Two pointers to one node need distinct horizontal label slots');
assert.equal(anchors.get('previous').x,386);
assert.equal(anchors.get('previous').y,184);
assert.ok(run('pointerBounds().minY')<184,'Pointer bounds include upper labels');
const width=name=>Math.max(40,run(`referenceLabel(${JSON.stringify(name)}).length`)*9);
for(const a of ['head','current'])for(const b of ['head','current']){
  if(a===b)continue;
  const left=anchors.get(a),right=anchors.get(b);
  assert.ok(Math.abs(left.x-right.x)>(width(a)+width(b))/2+8,
    'Reference labels on the same row must not overlap');
}
const tips=run(`['head','current','previous'].map(name=>referencePoint(name,1).x)`);
assert.equal(new Set(tips).size,3,'Reference arrowheads must not share one point');
run("renderReferences()");
assert.equal(elements.get('references').querySelectorAll('.ref-label').length,3);
run('fitScene()');
const vb=elements.get('scene').getAttribute('viewBox').split(' ').map(Number);
assert.ok(vb[1]<=run('pointerBounds().minY')-12,'Fit must include reference labels');
run("nodes.get(1).x=1200;renderReferences();fitScene()");
const far=elements.get('scene').getAttribute('viewBox').split(' ').map(Number);
assert.ok(far[0]+far[2]>1200+112,'Fit must include a node and its moving pointer');
run("references={current:null};head=1;renderReferences()");
assert.equal(elements.get('null-rail').querySelectorAll('.null-rail').length,1,'Null reference keeps shared rail');
run("structure='sorted_linked_list';ensureViewport(structure);");
run(`autoFrameLinked([{kind:'snapshot',head:1,nodes:Array.from({length:16},(_,i)=>({id:i+1,next:i===15?null:i+2}))}]);`);
assert.ok(run('viewport.w')>1100,'Long list must zoom out instead of overlapping nodes');
console.log('PASS: interface-first labels, anchored references, null rail and pointer-aware Fit');
