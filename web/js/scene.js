'use strict';
// The SVG scene camera: viewport, zoom, Fit and automatic framing of trees.
// Browser renders a trace sent by a persistent Dart server. No browser-side
// simulation of list operations: node IDs and reference writes come from Dart.
const NS = 'http://www.w3.org/2000/svg';
// Keep a single camera for each trace: frame new tree growth at the command
// boundary, never halfway through a pointer or rotation animation.
const SCENE_WIDTH = 1100, WIDTH = 112, HEIGHT = 68, ROW = 276, START_X = 112, GAP = 184;
// Manual zoom/pan takes precedence until Fit is pressed. Auto framing uses
// the final reachable tree, not transient unlinked nodes or the whole registry.
let viewport={x:0,y:0,w:1100,h:510},viewportKind=null,cameraMode='auto';
function paintViewport(){
  ui.scene.setAttribute('viewBox',`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`);
}
function ensureViewport(kind){
  if(viewportKind!==kind){
    viewportKind=kind;
    cameraMode='auto';
    viewport={x:0,y:0,w:1100,h:kind==='array_heap'?810:kind==='hash'?720:(kind==='tree'||kind==='avl'||kind==='node_heap')?620:510};
  }
  paintViewport();
}
// Zoom around the cursor's world-space point. SVG's default "meet" alignment
// may add gutters: account for them before converting screen to world units.
function zoomScene(factor,clientX=null,clientY=null){
  cameraMode='manual';
  let u=.5,v=.5;
  const bounds=ui.scene.getBoundingClientRect?.();
  if(Number.isFinite(clientX)&&Number.isFinite(clientY)&&bounds?.width>0&&bounds?.height>0){
    const scale=Math.min(bounds.width/viewport.w,bounds.height/viewport.h);
    const gutterX=(bounds.width-viewport.w*scale)/2;
    const gutterY=(bounds.height-viewport.h*scale)/2;
    u=Math.max(0,Math.min(1,(clientX-(bounds.left??0)-gutterX)/(viewport.w*scale)));
    v=Math.max(0,Math.min(1,(clientY-(bounds.top??0)-gutterY)/(viewport.h*scale)));
  }
  const w=Math.max(230,Math.min(200000,viewport.w*factor));
  const h=viewport.h*w/viewport.w;
  viewport={x:viewport.x+u*(viewport.w-w),y:viewport.y+v*(viewport.h-h),w,h};
  paintViewport();
}
function treeSceneRatio(){
  const bounds=ui.scene.getBoundingClientRect?.();
  return bounds?.width>0 && bounds?.height>0
    ?bounds.width/bounds.height:SCENE_WIDTH/620;
}
function fitScene(){
  cameraMode='auto';
  if(structure==='array_heap'){autoFrameHeap([{kind:'snapshot',cells:heapState.cells}],true);return;}
  if(structure==='hash'){autoFrameHash([{kind:'snapshot',...hashState}],true);return;}
  const visible=[...nodes.values()].filter(n=>n.opacity>.01);
  if(!visible.length){viewportKind=null;ensureViewport(structure);return;}
  const marker=pointerBounds(),right=isTree()?72:WIDTH;
  const x0=Math.min(Math.min(...visible.map(n=>n.x))-85,marker.minX-28);
  const x1=Math.max(Math.max(...visible.map(n=>n.x+right))+85,marker.maxX+28);
  const y0=Math.min(Math.min(...visible.map(n=>n.y))-48,marker.minY-26);
  const y1=Math.max(Math.max(...visible.map(n=>n.y+HEIGHT))+70,marker.maxY+28);
  const ratio=treeSceneRatio();
  const w=Math.max(isTree()?880:460,x1-x0,(y1-y0)*ratio);
  const h=w/ratio;
  viewport={x:(x0+x1-w)/2,y:(y0+y1-h)/2,w,h};
  paintViewport();
}
let cameraAnimationId=0;
function animateCamera(action){
  const before={...viewport};
  const token=++cameraAnimationId;
  action();
  const after={...viewport};
  if(typeof requestAnimationFrame!=='function'||
     (typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
  viewport=before;paintViewport();
  const start=performance.now();
  function frame(now){
    if(token!==cameraAnimationId)return;
    const t=Math.max(0,Math.min(1,(now-start)/220));
    const eased=1-Math.pow(1-t,3);
    viewport={
      x:before.x+(after.x-before.x)*eased,
      y:before.y+(after.y-before.y)*eased,
      w:before.w+(after.w-before.w)*eased,
      h:before.h+(after.h-before.h)*eased,
    };
    paintViewport();
    if(t<1)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Compute the eventual reachable tree's world-space bounds BEFORE playback.
// A single camera update here avoids per-step jumps and keeps pointer-first
// rotations smooth. Preserve the previous scale when the tree gets smaller;
// Reset (empty tree) and Fit can zoom in again.
function autoFrameTree(steps){
  if(!isTree()||cameraMode!=='auto')return;
  const snapshots=steps.filter(step=>step.kind==='snapshot'&&Array.isArray(step.nodes));
  const final=snapshots.at(-1);
  if(!final)return;
  const targets=treeLayout(final).targets;
  const byId=new Map(final.nodes.map(node=>[node.id,node]));
  const pending=[final.root],reachable=new Set(),positions=[];
  while(pending.length){
    const id=pending.pop();
    if(id==null||reachable.has(id)||!byId.has(id))continue;
    reachable.add(id);
    positions.push(targets.get(id));
    const node=byId.get(id);
    pending.push(node.left,node.right);
  }
  if(!positions.length){
    viewport={x:0,y:0,w:SCENE_WIDTH,h:620};
    paintViewport();
    return;
  }
  // Include the node outline, root label/arrow and breathing room at every
  // side. Extents are independent of SVG's clipping and of the browser width.
  const refNames=new Map();
  if(final.root!=null)refNames.set(final.root,new Set(['root']));
  for(const event of steps){
    if(event.kind!=='variableWrite'||event.to==null)continue;
    if(!refNames.has(event.to))refNames.set(event.to,new Set());
    refNames.get(event.to).add(event.name);
  }
  // Each additional reference to one node occupies its own labelled slot.
  const widest=Math.max(0,...[...refNames.values()].flatMap(names=>[...names].map(name=>referenceLabel(name).length*9)));
  const stacked=Math.max(1,...[...refNames.values()].map(names=>names.size));
  const side=Math.max(74,widest/2+36);
  const x0=Math.min(...positions.map(p=>p.x))-side;
  const x1=Math.max(...positions.map(p=>p.x+TREE_RADIUS*2))+side;
  const y0=Math.min(...positions.map(p=>p.y))-(110+(stacked-1)*30);
  const y1=Math.max(...positions.map(p=>p.y+TREE_RADIUS*2))+78;
  const ratio=treeSceneRatio();
  const requiredW=Math.max(SCENE_WIDTH,x1-x0,(y1-y0)*ratio);
  const w=Math.max(viewport.w,requiredW),h=w/ratio;
  // Keep the scale while centering the final reachable structure on EVERY
  // command; zoom out only when the new bounds genuinely need more room.
  viewport={x:(x0+x1-w)/2,y:(y0+y1-h)/2,w,h};
  paintViewport();
}
