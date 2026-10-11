'use strict';
// Trace state, source view and the renderer for linked nodes and references.
let animationGeneration = 0, animating = false;
let playbackMode=['step','play','result'].includes(playbackPreferences.mode)?playbackPreferences.mode:'play', playbackToken=0;
const CANCELLED = Symbol('animation interrupted');
let lastResult = 'Ready', currentOperation = 'Ready', activeLine = null;
let hotNode = null, hotLink = null, hotReference = null;
let linkedListSize = 0;
let head = null, tailId = null, rootId = null, structure='unsorted_array_list', arrayListState={cells:Array(8).fill(null),size:0},arrayListHot=null, stackState={cells:Array(8).fill(null),top:-1}, queueState={cells:Array(8).fill(null),front:0,rear:0,size:0}, heapState={cells:[],heapOrder:true},heapHot=[],hashState={buckets:Array(8).fill(null),nodes:[],size:0,capacity:8},hashHotBucket=null,hashHotNode=null, savedCapacity=8, references = {}, override = null, viewWidth = 1100;
const nodes = new Map(), nodeViews = new Map(), links = new Map();

function syntaxColor(line, destination) {
  const tokens = /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:class|int|bool|void|final|return|while|if|else|true|false|null|set|get|this)\b|\b(?:ListNode|TreeNode|FixedMemory|QueueMemory|MyBST|MyArrayStack|MyArrayQueue|MySortedLinkedList|Recorder|QueueRecorder)\b|\b-?\d+\b)/g;
  let offset=0;
  for (const m of line.matchAll(tokens)) {
    if(m.index>offset) destination.append(document.createTextNode(line.slice(offset,m.index)));
    const token=m[0], span=document.createElement('span');
    span.className=token.startsWith('//')?'syntax-comment':token.startsWith('"')||token.startsWith("'")?'syntax-string':/^-?\d+$/.test(token)?'syntax-number':/^(ListNode|TreeNode|FixedMemory|QueueMemory|MyBST|MyArrayStack|MyArrayQueue|MySortedLinkedList|Recorder|QueueRecorder)$/.test(token)?'syntax-type':'syntax-keyword';
    span.textContent=token;destination.append(span);offset=m.index+token.length;
  }
  destination.append(document.createTextNode(line.slice(offset)||'\u00a0'));
}
function renderSource(src) {
  // Source paths may be absolute, and --students may point anywhere on disk.
  // The class folder is the student's repository root: show only the student's
  // relative filename, never a local /home/... or /workspace/... path.
  const fileName=String(src.file??'').replaceAll('\\','/').split('/').pop();
  ui.file.textContent=selectedStudent?`${selectedStudent}/${fileName}`:fileName;
  if(window.sandboxEditor?.renderSource){
    window.sandboxEditor.renderSource(src);activeLine=null;return;
  }
  ui.code.replaceChildren();
  src.lines.forEach((line,i)=>{
    const row=document.createElement('div');row.className='code-line';row.dataset.line=String(i+1);
    const no=document.createElement('span');no.className='line-number';no.textContent=String(i+1).padStart(2);
    const contents=document.createElement('span');contents.className='line-text';syntaxColor(line,contents);
    row.append(no,contents);ui.code.append(row);
  });ui.codeScroll.scrollTop=0;activeLine=null;
}
function showLine(line) {
  if(line===activeLine)return;
  if(window.sandboxEditor?.highlight){
    activeLine=Number.isInteger(line)?line:null;
    window.sandboxEditor.highlight(activeLine);return;
  }
  if(activeLine!==null)ui.code.querySelector(`[data-line="${activeLine}"]`)?.classList.remove('active');
  activeLine=Number.isInteger(line)?line:null;
  if(activeLine===null)return;
  const row=ui.code.querySelector(`[data-line="${line}"]`);if(!row)return;
  row.classList.add('active');const rr=row.getBoundingClientRect(),pr=ui.codeScroll.getBoundingClientRect();
  if(rr.top<pr.top+20||rr.bottom>pr.bottom-20)ui.codeScroll.scrollTop+=rr.top-pr.top-pr.height*.32;
}
function newNode(data, initial=false) {
  if(nodes.has(data.id))return nodes.get(data.id);
  const marker=references.current??references.previous;
  const around=nodes.get(marker)??[...nodes.values()].at(-1);
  const node={id:data.id,value:data.value,next:data.next??null,left:data.left??null,right:data.right??null,
    height:data.height??1,balance:null,avlInvalid:false,heapIndex:null,heapInvalid:false,
    x:initial?(isTree()?SCENE_WIDTH/2-36:SCENE_WIDTH/2-WIDTH/2):
      (around?.x??(isTree()?SCENE_WIDTH/2-36:SCENE_WIDTH/2-WIDTH/2))+55,
    y:initial?ROW:135,
    opacity:initial?1:0,detached:false,wasReachable:false};nodes.set(node.id,node);
  const group=svg('g',{class:'node'});
  group.append(svg('rect',{class:'card',x:0,y:0,width:WIDTH,height:HEIGHT,rx:10}),
    svg('line',{class:'divider',x1:77,y1:0,x2:77,y2:HEIGHT}),
    svg('rect',{class:'port',x:80,y:19,width:24,height:29,rx:5}));
  const value=svg('text',{class:'value',x:38,y:33});value.textContent=String(data.value);
  const id=svg('text',{class:'node-id',x:38,y:53});id.textContent='#'+data.id;
  const pointer=svg('text',{class:'pointer-label',x:92,y:37});
  const avlInfo=svg('text',{class:'avl-info',x:36,y:61});
  group.append(value,id,pointer,avlInfo);
  if(isTree()){
    if(structure==='avl'||structure==='node_heap'){value.setAttribute('y',27);id.setAttribute('y',44);}
    group.querySelector('.card').setAttribute('width',72);
    group.querySelector('.card').setAttribute('height',72);
    group.querySelector('.card').setAttribute('rx',36);
    group.querySelector('.divider').setAttribute('display','none');
    group.querySelector('.port').setAttribute('display','none');
    pointer.setAttribute('display','none');
  }
  ui.nodes.append(group);nodeViews.set(node.id,group);
  renderNode(node);return node;
}
function renderNode(node){
  const view=nodeViews.get(node.id);if(!view)return;
  view.querySelector('.value').textContent=String(node.value);
  view.setAttribute('transform',`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`);
  view.setAttribute('opacity',node.opacity.toFixed(3));
  view.classList.toggle('hot',hotNode===node.id);view.classList.toggle('detached',node.detached);
  view.classList.toggle('avl-invalid',(structure==='avl'&&node.avlInvalid)||(structure==='node_heap'&&node.heapInvalid));
  view.querySelector('.avl-info').textContent=structure==='avl'
    ?`h${node.height} · b${node.balance==null?'?':node.balance>0?'+'+node.balance:node.balance}`
    :structure==='node_heap'&&node.heapIndex!=null?`slot ${node.heapIndex}`:'';
  const nil=!isTree()&&node.next==null && override?.from!==`node:${node.id}.next`;
  const pointer=view.querySelector('.pointer-label');
  pointer.textContent=isTree()?'':(nil?'null':'→');
  pointer.classList.toggle('is-null',nil);
}
// The outline an arrow to this node aims at (see geometry.js).
function nodeTarget(node){
  if(isTree()){const c=treeCentre(node);return circleTarget(c.x,c.y,TREE_RADIUS);}
  return boxTarget(node.x,node.y,WIDTH,HEIGHT,10);
}
// The target of a `next` pointer: the node, or a point for null.
function linkTarget(id,fallback){
  const node=nodes.get(id);
  return node?nodeTarget(node):pointTarget(fallback.x,fallback.y);
}
// A `next` arrow. It leaves the pointer field to the right and arrives from
// the most natural side: from the left when the target lies to the right,
// from above when it lies in a lower row, from below when it sits above the
// pointer field, and with a loop when it points back to an earlier node. The last stretch
// always runs straight towards the target's centre, and the tip sits where
// it meets the outline.
function linkGeometry(start,target){
  if(insideTarget(target,start))return null;
  const left=target.cx-target.w/2,right=target.cx+target.w/2;
  let c1,direction,reach=null,alignedAt=null;
  if(left>=start.x+24){
    const bend=Math.max(28,(left-start.x)*.45);
    c1={x:start.x+bend,y:start.y};direction={x:1,y:0};reach=bend;
  }else if(target.cy-start.y>target.h/2+24||
      (right>start.x-24&&start.y-target.cy>target.h/2+24)){
    // In a lower row, or above the pointer field: come in vertically.
    const down=target.cy>start.y,gap=Math.abs(target.cy-start.y)-target.h/2;
    // Drop (or rise) beside the source first, so the curve clears its card.
    c1={x:start.x+40,y:start.y+(down?1:-1)*gap*.8};direction={x:0,y:down?1:-1};reach=Math.max(30,gap*.5);
  }else if(target.cy<start.y-HEIGHT/2){
    // Back to an earlier node higher up: loop over the top, come down into it.
    const top=Math.min(start.y-HEIGHT/2,target.cy-target.h/2)-50;
    c1={x:start.x+48,y:top};direction={x:0,y:1};alignedAt=top;
  }else{
    // Back to an earlier node in the same row: loop underneath, come up into it.
    const bottom=Math.max(start.y,target.cy+target.h/2)+50;
    c1={x:start.x+48,y:bottom};direction={x:0,y:-1};alignedAt=bottom;
  }
  return arrowGeometry(start,approachTarget(target,direction),c1,
    approachControl(target,direction,reach,alignedAt));
}
function drawLink(group,start,target){
  const geometry=linkGeometry(start,target);
  group.setAttribute('visibility',geometry?'visible':'hidden');
  if(!geometry)return null;
  group.querySelector('.arrow-shaft').setAttribute('d',geometry.d);
  group.querySelector('.arrow-tip').setAttribute('points',geometry.points);
  return geometry.tip;
}
// A shaft plus an explicit closed triangle avoids browser-specific SVG marker
// offsets/scaling. The triangle TIP is the endpoint supplied by the layout:
// the outside boundary of the target, never its centre or an arbitrary gap.
const fmt=n=>Number(n.toFixed(2));
function makeArrow(className){
  const group=svg('g',{class:className});
  group.append(svg('path',{class:'arrow-shaft'}),svg('polygon',{class:'arrow-tip'}));
  return group;
}
function drawArrow(group,start,tip,kind='edge',backward=false){
  let c1,c2;
  if(kind==='reference'){
    c1={x:start.x,y:start.y+Math.max(26,(tip.y-start.y)*.55)};
    c2={x:tip.x,y:tip.y-Math.max(23,(tip.y-start.y)*.42)};
  }else if(backward){
    const bottom=Math.max(start.y,tip.y)+84;
    c1={x:start.x+48,y:bottom};c2={x:tip.x-50,y:bottom};
  }else{
    const bend=Math.max(28,Math.abs(tip.x-start.x)*.45);
    c1={x:start.x+bend,y:start.y};c2={x:tip.x-bend,y:tip.y};
  }
  // For a STRAIGHT arrow the endpoint tangent is the line itself, not the
  // unused Bezier control point. Otherwise vertical top/root arrows can have
  // a sideways or collapsed triangle, disconnected from their shaft.
  let dx=kind==='straight'?tip.x-start.x:tip.x-c2.x;
  let dy=kind==='straight'?tip.y-start.y:tip.y-c2.y;
  let length=Math.hypot(dx,dy);
  if(length<.001){dx=tip.x-start.x;dy=tip.y-start.y;length=Math.hypot(dx,dy);}
  const ux=length>.001?dx/length:0,uy=length>.001?dy/length:1;
  const base={x:tip.x-ux*12,y:tip.y-uy*12};
  const left={x:base.x-uy*5.4,y:base.y+ux*5.4};
  const right={x:base.x+uy*5.4,y:base.y-ux*5.4};
  group.querySelector('.arrow-shaft').setAttribute('d',kind==='straight'
    ? `M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(base.x)} ${fmt(base.y)}`
    : `M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(base.x)} ${fmt(base.y)}`);
  group.querySelector('.arrow-tip').setAttribute('points',
    `${fmt(tip.x)},${fmt(tip.y)} ${fmt(left.x)},${fmt(left.y)} ${fmt(right.x)},${fmt(right.y)}`);
}
function renderEdges(){
  if(isTree()){renderTreeEdges();return;}
  if(structure==='stack'||structure==='array_queue')return;
  const active=new Set();
  for(const node of nodes.values()){
    const from=`node:${node.id}.next`;
    const event=override?.from===from?override:null;
    const fallback={x:node.x+WIDTH+26,y:node.y+HEIGHT/2};
    // During a pointer animation the target morphs from the old to the new one.
    const target=event?(event.target??pointTarget(event.x,event.y)):linkTarget(node.next,fallback);
    if(!event&&node.next===null)continue;
    active.add(node.id);
    let edge=links.get(node.id);
    if(!edge){edge=makeArrow('edge');ui.edges.append(edge);links.set(node.id,edge);}
    const src={x:node.x+WIDTH+1,y:node.y+HEIGHT/2};
    drawLink(edge,src,target);
    edge.setAttribute('opacity',Math.min(1,node.opacity*(nodes.get(node.next)?.opacity??1)).toFixed(3));
    edge.classList.toggle('hot',hotLink===from);
  }
  for(const [id,edge] of links)if(!active.has(id)){edge.remove();links.delete(id);}
}
const DOCKS={root:{x:56,y:62},head:{x:56,y:62},tail:{x:1010,y:62},current:{x:245,y:62},previous:{x:451,y:62},fresh:{x:643,y:62}};
const TARGET_OFFSETS={head:.18,current:.45,previous:.78,fresh:.62};
function dockFor(name){
  if(!DOCKS[name]){
    const count=Object.keys(DOCKS).length-5;
    DOCKS[name]={x:785+count*135,y:62};
    TARGET_OFFSETS[name]=.28+(count%4)*.15;
  }
  return DOCKS[name];
}
const NULL_RAIL_TOP=123;
// References to real objects live beside those objects. Only a null reference
// uses a fixed dock and the shared null rail. This is also used by Fit.
function referenceValues(){
  const actual={ [isTree()?'root':'head']:isTree()?rootId:head,
    ...(structure==='linked_queue'?{tail:tailId}:{}),...references};
  if(override?.from.startsWith('var:')){
    const pending=override.from.slice(4);
    if(!(pending in actual))actual[pending]=null;
  }
  return actual;
}
function referenceLabel(name){
  return name==='head'&&structure==='linked_stack'?'head (top)':
    name==='root'&&structure==='node_heap'?'root (min)':name;
}
function referenceAnchors(actual){
  const groups=new Map(),anchors=new Map();
  for(const [name,id] of Object.entries(actual)){
    if(id==null||!nodes.has(id))continue;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(name);
  }
  for(const [id,names] of groups){
    const n=nodes.get(id),centre=n.x+(isTree()?TREE_RADIUS:WIDTH/2);
    // Put two labels on each row, on opposite sides of the target. Stacking
    // labels directly above one another makes an upper pointer pass through
    // the lower label (e.g. head/current). Keep the labels close to their node
    // but leave a small gap for the arrows and neighboring node references.
    const firstY=n.y-(isTree()?65:50);
    for(let i=0;i<names.length;i+=2){
      const first=names[i],second=names[i+1],y=firstY-(i/2)*42;
      if(second==null){anchors.set(first,{x:centre,y});continue;}
      const firstWidth=Math.max(40,referenceLabel(first).length*9);
      const secondWidth=Math.max(40,referenceLabel(second).length*9);
      const offset=(firstWidth+secondWidth)/4+10;
      anchors.set(first,{x:centre-offset,y});
      anchors.set(second,{x:centre+offset,y});
    }
  }
  return anchors;
}
// Where a reference arrow starts: just below its label.
function referenceStart(name,id){
  const n=nodes.get(id);
  const anchor=referenceAnchors(referenceValues()).get(name)??
    {x:n.x+(isTree()?TREE_RADIUS:WIDTH/2),y:n.y-(isTree()?65:50)};
  return {x:anchor.x,y:anchor.y+10};
}
// The tip of a reference arrow: aimed from the label at the node's centre and
// clipped at its outline. Labels side by side therefore get separate tips.
function referencePoint(name,id){
  const n=nodes.get(id),dock=dockFor(name);
  if(!n)return {x:dock.x,y:NULL_RAIL_TOP};
  const geometry=arrowGeometry(referenceStart(name,id),nodeTarget(n));
  return geometry?.tip??{x:n.x+(isTree()?TREE_RADIUS:WIDTH/2),y:n.y-1};
}
function pointerBounds(actual=referenceValues()){
  const anchors=referenceAnchors(actual),bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  function include(x0,y0,x1,y1){
    bounds.minX=Math.min(bounds.minX,x0);bounds.minY=Math.min(bounds.minY,y0);
    bounds.maxX=Math.max(bounds.maxX,x1);bounds.maxY=Math.max(bounds.maxY,y1);
  }
  const nullNames=Object.keys(actual).filter(name=>actual[name]==null);
  if(override?.nullTarget){
    const name=override.from.replace(/^(root|var):/,'');
    if(!nullNames.includes(name)){dockFor(name);nullNames.push(name);}
  }
  for(const [name,id] of Object.entries(actual)){
    const moving=(override?.from===`root:${name}`||override?.from===`var:${name}`) &&
      Number.isFinite(override.x)&&Number.isFinite(override.y);
    const anchor=moving?{x:override.x,y:override.y-70}:anchors.get(name)??dockFor(name);
    const textWidth=Math.max(40,referenceLabel(name).length*9);
    include(anchor.x-textWidth/2,anchor.y-17,anchor.x+textWidth/2,anchor.y+13);
    const tip=moving?{x:override.x,y:override.y}:referencePoint(name,id);
    include(Math.min(anchor.x,tip.x)-12,Math.min(anchor.y,tip.y)-8,
      Math.max(anchor.x,tip.x)+12,Math.max(anchor.y,tip.y)+12);
  }
  if(nullNames.length){
    const railWidth=Math.max(690,...nullNames.map(name=>dockFor(name).x+35));
    include(28,NULL_RAIL_TOP,railWidth+55,NULL_RAIL_TOP+27);
  }
  return bounds;
}
function renderReferences(){
  if(structure==='stack'||structure==='array_queue')return;
  ui.references.replaceChildren();ui.nullRail.replaceChildren();
  const actual=referenceValues(),anchors=referenceAnchors(actual);
  Object.keys(actual).forEach(dockFor);
  // Null remains an absence of a target; all null references share one rail.
  const nullNames=Object.keys(actual).filter(name=>actual[name]==null);
  if(override?.nullTarget){
    const name=override.from.replace(/^(root|var):/,'');
    if(!nullNames.includes(name)){dockFor(name);nullNames.push(name);}
  }
  if(nullNames.length){
    const railWidth=Math.max(690,...nullNames.map(name=>dockFor(name).x+35));
    ui.nullRail.append(svg('rect',{x:28,y:NULL_RAIL_TOP,width:railWidth-28,height:25,rx:9,class:'null-rail'}));
    const caption=svg('text',{x:railWidth+14,y:NULL_RAIL_TOP+17,class:'null-rail-label'});
    caption.textContent='null';ui.nullRail.append(caption);
    for(const name of nullNames){
      const x=DOCKS[name].x;
      ui.nullRail.append(svg('line',{x1:x,y1:NULL_RAIL_TOP+4,x2:x,y2:NULL_RAIL_TOP+18,class:'null-slot'}));
    }
  }
  const labels=[];
  for(const [name,id] of Object.entries(actual)){
    const moving=(override?.from===`root:${name}`||override?.from===`var:${name}`) &&
      Number.isFinite(override.x)&&Number.isFinite(override.y);
    const anchor=moving?{x:override.x,y:override.y-70}:anchors.get(name)??dockFor(name);
    const active=hotReference===name, label=svg('text',{x:anchor.x,y:anchor.y,class:`ref-label ${(name==='head'||name==='root'||name==='tail')?'':'local'} ${active?'active':''}`});
    label.textContent=referenceLabel(name);labels.push(label);
    const target=override?.from===`root:${name}`||override?.from===`var:${name}`
      ?{x:override.x,y:override.y}:referencePoint(name,id);
    const arrow=makeArrow(`ref-arrow ${(name==='head'||name==='root'||name==='tail')?'':'local'} ${active?'hot':''}`);
    const stationary=id!=null&&nodes.has(id)&&override?.from!==`root:${name}`&&override?.from!==`var:${name}`;
    if(stationary)drawArrowTo(arrow,{x:anchor.x,y:anchor.y+10},nodeTarget(nodes.get(id)));
    else drawArrow(arrow,{x:anchor.x,y:anchor.y+10},target,'reference');
    ui.references.append(arrow);
  }
  ui.references.append(...labels); // Text stays above intersecting pointer paths.
}
function renderAll(){
  if(structure==='unsorted_linked_list'||structure==='sorted_linked_list'){
    ui.stackView.replaceChildren();
    const label=svg('text',{x:SCENE_WIDTH-94,y:89,
      class:'queue-size','text-anchor':'end'});
    label.textContent=`size = ${linkedListSize}`;
    ui.stackView.append(label);
  }
  if(isArrayList()){renderArrayList();return;}
  if(structure==='stack'){renderStack();return;}if(structure==='array_queue'){renderQueue();return;}if(structure==='array_heap'){renderHeap();return;}if(structure==='hash'){renderHash();return;}for(const node of nodes.values())renderNode(node);renderEdges();renderReferences();
}
function layoutFor(snapshot){
  if(isTree())return treeLayout(snapshot);
  const byId=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const targets=new Map(),seen=new Set(),ordered=[];let cursor=snapshot.head,index=0;
  while(cursor!==null&&byId.has(cursor)&&!seen.has(cursor)){
    seen.add(cursor);ordered.push(cursor);
    cursor=byId.get(cursor).next;index++;
  }
  // Position the whole reachable chain as one centred group. Recompute these
  // slots only when settling, never while an individual pointer is changing.
  const gap=ordered.length>1
    ?Math.min(GAP,Math.max(144,(SCENE_WIDTH-140-WIDTH)/(ordered.length-1))):GAP;
  const firstX=(SCENE_WIDTH-WIDTH-(ordered.length-1)*gap)/2;
  ordered.forEach((id,i)=>targets.set(id,{x:firstX+i*gap,y:ROW,opacity:1,detached:false}));
  let detachedIndex=0;
  for(const item of snapshot.nodes){if(seen.has(item.id))continue;
    const former=nodes.get(item.id);
    // A newly allocated object must remain above the row until it has ever
    // belonged to the list, even before the local `fresh` is assigned.
    const pending=!former?.wasReachable;
    targets.set(item.id,{x:former?.x??SCENE_WIDTH/2-WIDTH/2+detachedIndex*140,
      y:pending?156:431,opacity:pending?1:.37,detached:!pending});detachedIndex++;
  }
  // Never change the viewBox halfway through an operation: that would scale
  // every node and arrow at once and look like an unexplained position jump.
  return {targets,count:index,cycle:cursor!==null&&seen.has(cursor)};
}
function applySnapshot(snapshot,animate=false){
  if(isArrayList()){arrayListState={cells:[...snapshot.cells],size:snapshot.size};renderArrayList();return {targets:new Map(),count:snapshot.size,cycle:false};}
  if(structure==='stack'){stackState={cells:[...snapshot.cells],top:snapshot.top};renderStack();return {targets:new Map(),count:snapshot.top+1,cycle:false};}
  if(structure==='array_queue'){queueState=queueSnapshot(snapshot);renderQueue();return {targets:new Map(),count:queueState.size,cycle:false};}
  if(structure==='array_heap'){heapState=heapSnapshot(snapshot);renderHeap();return {targets:new Map(),count:heapState.cells.length,cycle:false};}
  if(structure==='hash'){hashState=hashSnapshot(snapshot);renderHash();return {targets:new Map(),count:hashState.size,cycle:false};}
  if(isTree())rootId=snapshot.root;else head=snapshot.head;
  if(structure==='unsorted_linked_list'||structure==='sorted_linked_list'){
    linkedListSize=snapshot.size??0;
  }
  if(structure==='linked_queue')tailId=snapshot.tail??null;
  for(const data of snapshot.nodes){
    const node=newNode(data,true);node.value=data.value;node.next=data.next??null;
    node.left=data.left??null;node.right=data.right??null;
    node.height=data.height??1;
    const audit=snapshot.avl?.nodes?.[String(data.id)];
    node.balance=audit?.balance??null;
    node.avlInvalid=!!audit && (audit.heightOk===false||audit.balanceOk===false);
     const heapAudit=snapshot.nodeHeap?.nodes?.[String(data.id)];
    node.heapIndex=heapAudit?.index??null;
    node.heapInvalid=heapAudit?.orderOk===false;
  }
  const {targets,count,cycle}=layoutFor(snapshot);
  // Reachability is historical: a newly created detached node floats above
  // the row; a node removed from the row may drift below it.
  for(const data of snapshot.nodes){
    if(targets.get(data.id)?.y===ROW)nodes.get(data.id).wasReachable=true;
  }
  if(!animate){for(const [id,t] of targets)Object.assign(nodes.get(id),t);renderAll();}
  return {targets,count,cycle};
}
