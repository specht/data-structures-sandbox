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
run(`applySnapshot({head:1,nodes:[
  {id:1,value:10,next:2}, {id:2,value:20,next:3}, {id:3,value:30,next:null}
]}); references={current:2,previous:null,fresh:null};renderAll();`);
function point(group) {
  return group.querySelector('.arrow-tip').getAttribute('points').split(' ')[0].split(',').map(Number);
}
let [x,y] = point(run('links.get(1)'));
assert.equal(x, run('nodes.get(2).x-1'));
assert.equal(y, run('nodes.get(2).y+HEIGHT/2'));
const arrows = document.getElementById('references').querySelectorAll('.ref-arrow');
assert.equal(arrows.length, 4);
[x,y] = point(arrows[0]);
assert.equal(x, run('nodes.get(1).x+WIDTH*TARGET_OFFSETS.head'));
assert.equal(y, run('nodes.get(1).y-1'));
[x,y] = point(arrows[2]);
assert.equal(x, run('DOCKS.previous.x'));
assert.equal(y, run('NULL_RAIL_TOP'));
assert.equal(document.getElementById('null-rail').querySelectorAll('.null-slot').length, 2);
assert.equal(document.getElementById('null-rail').querySelectorAll('.null-rail-label').length, 1);
assert.equal(run(`nodeViews.get(3).querySelector('.pointer-label').textContent`),'null');
assert.equal(run('links.size'),2, 'A terminal next=null must not draw a global edge');
run('references.previous=2;references.fresh=3;renderReferences();');
assert.equal(document.getElementById('null-rail').children.length,0,
  'The shared null rail disappears when no displayed variable is null');
run('head=null;references={current:null,previous:null};renderReferences();');
const nullArrows = document.getElementById('references').querySelectorAll('.ref-arrow');
assert.equal(new Set(nullArrows.map(a => point(a)[0])).size,3,
  'Independent null references must not converge on a single point');
// Verify a moving structural arrow is still drawn before the list is relaid out.
run(`head=1;references={};renderAll();override={from:'node:2.next',x:nodes.get(1).x-1,y:nodes.get(1).y+HEIGHT/2};renderEdges();`);
assert.equal(point(run('links.get(2)'))[0],run('nodes.get(1).x-1'));
run('override=null;renderAll();');
// Stub only the animation clock, not the structural state machine: confirm
// that a pointer write changes the edge while positions stay fixed until the
// subsequent settling event.
(async () => {
  run(`clearView(); applySnapshot({head:1,nodes:[
    {id:1,value:10,next:2},{id:2,value:20,next:3},{id:3,value:30,next:null}
  ]}); tween=async (_, update)=>{update(1);};`);
  const oldX = run('nodes.get(3).x');
  await run(`animateWrite({from:'node:1.next',oldTo:2,to:3})`);
  assert.equal(run('nodes.get(1).next'),3);
  assert.equal(run('nodes.get(3).x'),oldX,
    'Pointer writes must not settle nodes prematurely');
  await run(`animateSettle({head:1,nodes:[
    {id:1,value:10,next:3},{id:2,value:20,next:3},{id:3,value:30,next:null}
  ]})`);
  assert.equal(run('nodes.get(3).x'),(run('SCENE_WIDTH-WIDTH-GAP')/2)+run('GAP'),
    'The reachable chain must settle about canvas centre');
  assert.equal(run('nodes.get(2).detached'),true);
  run(`clearView(); structure='stack'; stackState={cells:[13,7,null,null],top:1}; renderStack();`);
  const stack=document.getElementById('stack-view');
  const label=stack.querySelector('.stack-label');
  const topArrow=stack.querySelector('.ref-arrow');
  assert.equal(Number(label.getAttribute('x')),run('(SCENE_WIDTH-((stackState.cells.length-1)*94+80))/2+94+40'));
  const cells=stack.children.filter(c=>c.getAttribute('class')?.includes('memory-cell'));
  assert.equal((Number(cells[0].getAttribute('x'))+Number(cells.at(-1).getAttribute('x'))+80)/2,run('SCENE_WIDTH/2'), 'Memory strip centred');
  assert.equal(point(topArrow)[0],Number(label.getAttribute('x')));
  assert.match(topArrow.querySelector('.arrow-shaft').getAttribute('d'),/ L /);
  const triangle=topArrow.querySelector('.arrow-tip').getAttribute('points')
    .split(' ').map(point=>point.split(',').map(Number));
  assert.equal(triangle[0][1],235-3,'Arrow tip must terminate above selected cell');
  assert.equal(triangle[1][1],triangle[2][1], 'Vertical arrowhead base must be horizontal');
  assert.ok(Math.abs(triangle[1][0]-triangle[2][0])>9,'Vertical arrowhead must not collapse sideways');
  run('stackState.top=-1;renderStack()');
  assert.equal(stack.querySelector('.ref-arrow'),null,'No arrow when the stack is empty');
  // A queue has two independently owned references, even when head and tail
  // point at the same object. Both follow the same centered linked-node layout.
  run(`clearView();structure='linked_queue';applySnapshot({head:1,tail:3,nodes:[
    {id:1,value:25,next:2},{id:2,value:6,next:3},{id:3,value:25,next:null}
  ]});`);
  const queueArrows=document.getElementById('references').querySelectorAll('.ref-arrow');
  assert.equal(queueArrows.length,2,'Queue must show both head and tail pointers');
  assert.equal(point(queueArrows[0])[0],run('nodes.get(1).x+WIDTH*TARGET_OFFSETS.head'));
  assert.equal(point(queueArrows[1])[0],run('nodes.get(3).x+WIDTH*.5'));
  assert.equal(run('tailId'),3);
  await run(`animateWrite({from:'root:tail',oldTo:3,to:2})`);
  assert.equal(run('tailId'),2,'Tail retargeting must be animatable, not a local variable');
  assert.equal(run('nodes.get(1).x+WIDTH/2'),run('SCENE_WIDTH/2-GAP'));
  run(`instant({kind:'writeAndSettle',from:'root:tail',oldTo:3,to:2,snapshot:{head:1,tail:2,nodes:[
    {id:1,value:25,next:2},{id:2,value:6,next:null}
  ]}})`);
  assert.equal(run('tailId'),2,'Seek/replay must restore the queue tail from snapshots');
  run(`clearView();structure='array_queue';applySnapshot({
    cells:[null,null,17,3,9,8,4,101],front:2,rear:0,size:6
  });`);
  const arrayView=document.getElementById('stack-view');
  const queueCells=arrayView.querySelectorAll('.memory-cell');
  assert.equal(queueCells.length,8,'Queue displays all physical cells');
  assert.equal((Number(queueCells[0].getAttribute('x'))+
    Number(queueCells.at(-1).getAttribute('x'))+80)/2,run('SCENE_WIDTH/2'),
    'Queue remains centred during wraparound');
  assert.equal(arrayView.querySelector('.queue-size').textContent,'size = 6 / 8');
  assert.equal(arrayView.querySelectorAll('.queue-order').length,6,
    'Only occupied logical elements get an order badge');
  const queueFront=arrayView.querySelector('.queue-front');
  const queueRear=arrayView.querySelector('.queue-rear');
  // Query both arrow and label directly: the cells also carry these classes.
  const frontArrow=arrayView.children.find(c=>c.classList.contains('ref-arrow')&&c.classList.contains('queue-front'));
  const rearArrow=arrayView.children.find(c=>c.classList.contains('ref-arrow')&&c.classList.contains('queue-rear'));
  assert.ok(frontArrow && rearArrow,'Front and rear are independently visible');
  assert.equal(point(frontArrow)[0],Number(queueCells[2].getAttribute('x'))+40);
  assert.equal(point(rearArrow)[0],Number(queueCells[0].getAttribute('x'))+40);
  assert.equal(queueFront.tagName,'rect');assert.equal(queueRear.tagName,'rect');
  assert.equal(frontArrow.querySelector('.arrow-shaft').getAttribute('d').includes(' L '),true);
  assert.equal(rearArrow.querySelector('.arrow-shaft').getAttribute('d').includes(' L '),true);
  const [frontTipY,rearTipY]=[point(frontArrow)[1],point(rearArrow)[1]];
  assert.equal(frontTipY,232);assert.equal(rearTipY,303);
  run(`applySnapshot({cells:[1,2,3,4,5,6,7,8],front:2,rear:2,size:8});`);
  assert.equal(arrayView.querySelector('.queue-size').textContent,'size = 8 / 8 · FULL');
  assert.equal(arrayView.children.find(c=>c.classList.contains('ref-arrow')&&c.classList.contains('queue-front'))!=null,true);
  assert.equal(arrayView.children.find(c=>c.classList.contains('ref-arrow')&&c.classList.contains('queue-rear'))!=null,true,
    'Full front == rear must retain TWO separate marker arrows');
  run(`applySnapshot({cells:Array(8).fill(null),front:2,rear:2,size:0});`);
  assert.equal(arrayView.querySelector('.queue-size').textContent,'size = 0 / 8 · EMPTY');
  assert.equal(arrayView.querySelectorAll('.queue-order').length,0);
  // Seeking backward and forward restores every marker and every physical slot.
  run(`clearView();structure='array_queue';
    traceInitial={kind:'snapshot',cells:[null,null,null,null],front:0,rear:0,size:0};
    frames=[{kind:'memoryWriteAndSettle',index:0,value:13,snapshot:{kind:'snapshot',cells:[13,null,null,null],front:0,rear:0,size:0}},
      {kind:'memoryWriteAndSettle',name:'rear',value:1,snapshot:{kind:'snapshot',cells:[13,null,null,null],front:0,rear:1,size:0}},
      {kind:'memoryWriteAndSettle',name:'size',value:1,snapshot:{kind:'snapshot',cells:[13,null,null,null],front:0,rear:1,size:1}}];
    jumpTo(3);`);
  assert.equal(run('queueState.size'),1);
  assert.equal(run('queueState.rear'),1);
  assert.equal(run('queueState.cells[0]'),13);
  run('jumpTo(0)');
  assert.equal(run('queueState.size'),0);
  assert.equal(run('queueState.rear'),0);
  assert.equal(run('queueState.cells[0]'),null);
  run('jumpTo(3)');
  assert.equal(run('queueState.cells[0]'),13);
  console.log('PASS: array queue fixed cells, distinct markers, full/empty, wraparound and replay.');
  console.log('PASS: arrow geometry, linked queue head/tail playback, stack top, centred nodes.');
})().catch(error => { console.error(error); process.exitCode=1; });
