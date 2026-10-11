// Arrows aim at the centre of their target and end on its outline:
// node test/arrow_geometry.test.js
'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {fakeBrowser,loadApp}=require('./helpers/browser');
const {context}=fakeBrowser();
loadApp(context);
const run=source=>vm.runInContext(source,context);
const near=(a,b,message,tolerance=.02)=>assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`);
const geometry=(start,target,c1=null,c2=null)=>run(
  `arrowGeometry(${JSON.stringify(start)},${target},${JSON.stringify(c1)},${JSON.stringify(c2)})`);
const head=g=>g.points.split(' ').map(p=>p.split(',').map(Number));

// A node card: approaching from the left at mid height ends 1px before the
// left edge, horizontally.
let g=geometry({x:0,y:134},'boxTarget(200,100,112,68,10)');
near(g.tip.x,199,'tip on the left outline');near(g.tip.y,134,'tip at mid height');

// A diagonal reference from above-left still points at the card's centre:
// the head's axis passes through the centre, and the tip lies on the outline.
g=geometry({x:150,y:20},'boxTarget(200,100,112,68,10)');
let [[tx,ty],[lx,ly],[rx,ry]]=head(g);
const base={x:(lx+rx)/2,y:(ly+ry)/2},centre={x:256,y:134};
const cross=(tx-base.x)*(centre.y-base.y)-(ty-base.y)*(centre.x-base.x);
near(cross/Math.hypot(tx-base.x,ty-base.y)/Math.hypot(centre.x-base.x,centre.y-base.y),0,'head aims at the centre',.002);
const onOutline=(target,tip,c)=>{
  const toward=(f)=>JSON.stringify({x:tip.x+(c.x-tip.x)*f,y:tip.y+(c.y-tip.y)*f});
  return run(`insideTarget(${target},${toward(0.01)})`)&&!run(`insideTarget(${target},${toward(-0.01)})`);
};
assert.ok(onOutline('boxTarget(200,100,112,68,10)',g.tip,centre),'tip touches the outline');

// A circle (tree node): the tip is radius + 1 from the centre.
g=geometry({x:40,y:300},'circleTarget(300,120,36)');
near(Math.hypot(g.tip.x-300,g.tip.y-120),37,'tip on the circle');

// A list link back to an earlier node loops underneath and enters from below.
run(`structure='sorted_linked_list';`);
g=run(`(()=>{const target=boxTarget(100,268,112,68,10),start={x:600+WIDTH+1,y:302};
  return linkGeometry(start,target);})()`);
near(g.tip.x,156,'backward link aims at the centre from below');near(g.tip.y,337,'tip on the bottom outline');

// A bare point (null, or a moving arrow) is hit exactly.
g=geometry({x:0,y:0},'pointTarget(80,40)');
assert.deepEqual({...g.tip},{x:80,y:40});
// Overlapping objects draw no arrow instead of a misleading one.
assert.equal(geometry({x:256,y:134},'boxTarget(200,100,112,68,10)'),null);

// Pointer animations morph between targets and end exactly on them.
assert.deepEqual({...run(`mixTargets(boxTarget(0,0,112,68),pointTarget(500,50),1)`)},{...run(`pointTarget(500,50)`)});

// Heap projection lines: centre to centre, clipped at both circles.
const line=run(`centreLine(circleTarget(100,100,27),circleTarget(160,180,27))`);
near(Math.hypot(line.x1-100,line.y1-100),28,'line starts on the parent circle');
near(Math.hypot(line.x2-160,line.y2-180),28,'line ends on the child circle');
near((line.y2-line.y1)/(line.x2-line.x1),80/60,'line is collinear with both centres');

// Rendered list and reference arrows use the same geometry.
run(`clearView();references={};applySnapshot({head:1,nodes:[{id:1,value:3,next:2},{id:2,value:8,next:null}]});
  references={current:1,previous:1};renderAll();`);
const tips=run(`['head','current','previous'].map(name=>referencePoint(name,1))`);
assert.equal(new Set(tips.map(t=>t.x)).size,3,'labels side by side keep separate tips');
const card=run('nodeTarget(nodes.get(1))');
for(const tip of tips)assert.ok(onOutline('nodeTarget(nodes.get(1))',tip,{x:card.cx,y:card.cy}),'reference tip on the outline');
console.log('PASS: arrows aim at node centres and end on the outline (cards, circles, loops, points, heap lines).');
