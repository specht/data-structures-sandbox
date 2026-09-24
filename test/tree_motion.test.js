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
// A one-sided tree of depth >20 must retain every node in the layout.
const chain=Array.from({length:27},(_,i)=>({id:i+1,value:i+1,left:null,right:i<26?i+2:null}));
const layout=run(`treeLayout({root:1,nodes:${JSON.stringify(chain)}})`);
assert.equal(layout.count,27,'No 12-node or 20-level visualization cutoff');
assert.equal(layout.targets.size,27);
run('ensureViewport("tree")');
const originalView=ids.get('scene').getAttribute('viewBox');
run('zoomScene(1.35)');
const zoomedView=ids.get('scene').getAttribute('viewBox');
assert.notEqual(zoomedView,originalView,'Zoom changes the viewport when requested');
run('ensureViewport("tree")');
assert.equal(ids.get('scene').getAttribute('viewBox'),zoomedView,
  'Repeated scene updates must preserve student-controlled zoom');
// A broad AVL (and a deep skewed BST) must use sufficient *world-space*
// geometry instead of compressing circles into a fixed 1100px-wide picture.
function assertSeparated(snapshot,minimum){
  const layout=run(`treeLayout(${JSON.stringify(snapshot)})`);
  const byLevel=new Map();
  for(const t of layout.targets.values()){
    if(t.detached)continue;
    if(!byLevel.has(t.y))byLevel.set(t.y,[]);
    byLevel.get(t.y).push(t.x);
  }
  for(const [level,positions] of byLevel){
    positions.sort((a,b)=>a-b);
    for(let i=1;i<positions.length;i++){
      assert.ok(positions[i]-positions[i-1]>=minimum,
        `Overlapping nodes at y=${level}: ${positions[i-1]}, ${positions[i]}`);
    }
  }
  return layout;
}
const balanced=(count)=>{
  const records=[];
  function add(lo,hi){
    if(lo>hi)return null;
    const mid=Math.floor((lo+hi)/2),id=mid+1;
    const left=add(lo,mid-1),right=add(mid+1,hi);
    records.push({id,value:id,left,right});
    return id;
  }
  const root=add(0,count-1);
  return {root,nodes:records};
};
const wide=balanced(127);
const wideLayout=assertSeparated(wide,93.99);
assert.equal(wideLayout.count,127);
assert.equal(wideLayout.targets.get(wide.root).x+run('TREE_RADIUS'),run('SCENE_WIDTH/2'));
assertSeparated({root:1,nodes:Array.from({length:80},(_,i)=>({id:i+1,value:i+1,
  left:null,right:i===79?null:i+2}))},93.99);
// Existing balanced siblings don't move when a new leaf is placed in a
// different subtree that has enough reserved room.
const before=assertSeparated(balanced(15),93.99);
const afterNodes=balanced(15).nodes;
const leaf=afterNodes.find(n=>n.value===15);
leaf.right=16;afterNodes.push({id:16,value:16,left:null,right:null});
const after=assertSeparated({root:8,nodes:afterNodes},93.99);
assert.equal(before.targets.get(1).x,after.targets.get(1).x);
// The path shown in the source pane must be relative to the student repo.
run(`selectedStudent='example';renderSource({file:'/home/teacher/project/structures/example/my_avl.dart',
  lines:['class MyAVL {}']});`);
assert.equal(document.getElementById('filename').textContent,'example/my_avl.dart');
run(`selectedStudent='alice';renderSource({file:'/custom/repo/alice/my_bst.dart',lines:[]});`);
assert.equal(document.getElementById('filename').textContent,'alice/my_bst.dart');
// Compact spacing should not waste half the viewport on each parent-child
// edge: 31 nodes remain readable at ordinary desktop sizes.
const compact=assertSeparated(balanced(31),93.99);
const compactNodes=[...compact.targets.values()];
assert.ok(Math.max(...compactNodes.map(n=>n.x))-Math.min(...compactNodes.map(n=>n.x))+72<2100,
  'The compact contour layout should not have giant first-level gaps');
// Automatic camera uses the final reachable structure, once per incoming trace.
// Dense trees must be entirely visible; replaying steps must not modify viewBox.
function showTree(snapshot){
  run(`structure='avl';viewportKind=null;ensureViewport('avl');acceptTrace({
    structure:'avl',source:{file:'structures/example/my_avl.dart',lines:[]},
    methods:[],values:[],steps:[{kind:'snapshot',...${JSON.stringify(snapshot)}}]
  });`);
  const view=run('({...viewport})');
  const targets=run(`treeLayout(${JSON.stringify(snapshot)}).targets`);
  for(const node of targets.values()){
    if(node.detached)continue;
    assert.ok(node.x>=view.x+10 && node.x+72<=view.x+view.w-10,
      `Node clipped horizontally at x=${node.x}, view=${JSON.stringify(view)}`);
    assert.ok(node.y-75>=view.y && node.y+72<=view.y+view.h-10,
      `Node or its root reference clipped vertically at y=${node.y}`);
  }
  return view;
}
const framed=showTree(wide);
assert.ok(framed.w>1100,'A broad tree must automatically zoom out');
assert.ok(Math.abs((framed.x+framed.w/2)-550)<120,
  'Balanced trees should be centered around the root');
const viewAtStart=document.getElementById('scene').getAttribute('viewBox');
run('jumpTo(frames.length);jumpTo(0)');
assert.equal(document.getElementById('scene').getAttribute('viewBox'),viewAtStart,
  'Playback must not alter the camera');
// Use the real SVG aspect ratio on a wide screen rather than wasting space
// in horizontal gutters from a fixed 1100:620 viewBox.
run('ui.scene.getBoundingClientRect=()=>({width:1200,height:480})');
const wideAspect=showTree(wide);
assert.ok(Math.abs(wideAspect.w/wideAspect.h-2.5)<.001,
  'Automatic framing should use the real canvas aspect ratio');
showTree({root:1,nodes:chain});
const deepView=run('({...viewport})');
assert.ok(deepView.h>620,'A deep tree must fit vertically, not just horizontally');
// A student-chosen zoom/pan remains authoritative across future calls.
run('zoomScene(1/1.35)');
const manual=JSON.stringify(run('({...viewport})'));
run(`acceptTrace({structure:'avl',source:{file:'structures/example/my_avl.dart',lines:[]},
  methods:[],values:[],steps:[{kind:'snapshot',...${JSON.stringify(wide)}}]})`);
assert.equal(JSON.stringify(run('({...viewport})')),manual,
  'Do not override manually chosen zoom on the next trace');
run('fitScene()');
assert.equal(run('cameraMode'),'auto','Fit resumes auto framing');
// A subsequent reset should return to a useful default rather than preserving
// a tiny empty diagram at the old zoom level.
run(`acceptTrace({structure:'avl',source:{file:'structures/example/my_avl.dart',lines:[]},
  methods:[],values:[],steps:[{kind:'snapshot',root:null,nodes:[]}]})`);
assert.equal(run('viewport.w'),1100);
assert.equal(run('viewport.x'),0);
// Wheel zoom must leave the world-space point under the mouse in the same
// screen position, including the actual canvas offset.
run('ui.scene.getBoundingClientRect=()=>({left:40,top:20,width:1100,height:620})');
run('viewport={x:100,y:30,w:1100,h:620};paintViewport()');
const pointerWorld={x:100+275,y:30+124};
run('zoomScene(.8,315,144)');
const pointerAfter=run('({...viewport})');
assert.ok(Math.abs(pointerAfter.x+pointerAfter.w*.25-pointerWorld.x)<.0001);
assert.ok(Math.abs(pointerAfter.y+pointerAfter.h*.2-pointerWorld.y)<.0001,
  'Pointer-centred zoom must preserve the world point under the cursor');
// Each new command centres the resulting geometry without zooming in again.
run(`structure='avl';viewportKind=null;ensureViewport('avl');
  acceptTrace({structure:'avl',source:{file:'my_avl.dart',lines:[]},methods:[],values:[],
    steps:[{kind:'snapshot',...${JSON.stringify({root:1,nodes:chain})}}]})`);
const chainTargets=run(`treeLayout(${JSON.stringify({root:1,nodes:chain})}).targets`);
const xs=[...chainTargets.values()].map(p=>p.x);
const box=run('({...viewport})');
assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs)+72)/2-(box.x+box.w/2))<.0001,
  'An asymmetrical tree is centred after the command');
console.log('PASS: Tree edges are centre-clipped, straight at rest, curved while moving.');
