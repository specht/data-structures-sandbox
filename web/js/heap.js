'use strict';
// Array heap: array row plus the implied tree.
function heapSnapshot(snapshot){
  return {cells:[...(snapshot.cells??[])],heapOrder:snapshot.heapOrder!==false};
}
function heapArrayRows(n){return Math.ceil(Math.max(1,n)/10);}
function heapTreeTop(n){return 350+(heapArrayRows(n)-1)*78;}
function heapTreeWidth(n){
  if(!n)return 880;
  const deepest=Math.floor(Math.log2(n));
  return Math.max(880,Math.pow(2,deepest)*78);
}
function heapTreePosition(i,n){
  const level=Math.floor(Math.log2(i+1));
  const offset=i-(Math.pow(2,level)-1);
  return {x:SCENE_WIDTH/2+((offset+.5)/Math.pow(2,level)-.5)*heapTreeWidth(n),
    y:heapTreeTop(n)+level*100};
}
function autoFrameHeap(steps,force=false){
  if(structure!=='array_heap'||(!force&&cameraMode!=='auto'))return;
  const sizes=steps.filter(frame=>frame.kind==='snapshot'&&Array.isArray(frame.cells))
    .map(frame=>frame.cells.length);
  const n=force?(sizes.at(-1)??0):Math.max(0,...sizes);
  const ratio=treeSceneRatio(),width=heapTreeWidth(n);
  const depth=n?Math.floor(Math.log2(n)):0;
  const bottom=heapTreeTop(n)+depth*100+105;
  const required=Math.max(SCENE_WIDTH,width+160,bottom*ratio);
  const w=force?required:Math.max(viewport.w,required),h=w/ratio;
  viewport={x:(SCENE_WIDTH-w)/2,y:(bottom-h)/2-30,w,h};
  paintViewport();
}
function renderHeap(){
  ui.stackView.replaceChildren();
  const cells=heapState.cells,n=cells.length,highlight=new Set(heapHot);
  const heading=svg('text',{x:SCENE_WIDTH/2,y:70,class:'heap-title','text-anchor':'middle'});
  heading.textContent=`MIN-HEAP · ${n} element${n===1?'':'s'}${heapState.heapOrder?'':' · HEAP ORDER VIOLATED'}`;
  ui.stackView.append(heading);
  const arrayHeading=svg('text',{x:SCENE_WIDTH/2,y:105,class:'heap-section','text-anchor':'middle'});
  arrayHeading.textContent='ARRAY STORAGE · index i';ui.stackView.append(arrayHeading);
  const count=n;
  for(let i=0;i<count;i++){
    const row=Math.floor(i/10),col=i%10,cols=Math.min(10,count-row*10);
    const x=SCENE_WIDTH/2-(cols*86-10)/2+col*86,y=122+row*78;
    const cls=`memory-cell heap-cell${highlight.has(i)?' selected':''}`;
    ui.stackView.append(svg('rect',{x,y,width:76,height:52,rx:7,class:cls}));
    const value=svg('text',{x:x+38,y:y+32,class:'heap-cell-value','text-anchor':'middle'});
    value.textContent=String(cells[i]);ui.stackView.append(value);
    const index=svg('text',{x:x+38,y:y+68,class:'memory-index','text-anchor':'middle'});
    index.textContent=`[${i}]`;ui.stackView.append(index);
  }
  const top=heapTreeTop(n);
  const label=svg('text',{x:SCENE_WIDTH/2,y:top-55,class:'heap-section','text-anchor':'middle'});
  label.textContent='SAME ARRAY · binary-tree projection';ui.stackView.append(label);
  // Edges are index relationships, never references. Both projections show
  // exactly cells[i], including duplicate values at different indices.
  for(let i=1;i<n;i++){
    const parent=heapTreePosition((i-1)>>1,n),child=heapTreePosition(i,n);
    ui.stackView.append(svg('line',{x1:parent.x,y1:parent.y+22,x2:child.x,y2:child.y-22,class:'heap-index-edge'}));
  }
  for(let i=0;i<n;i++){
    const {x,y}=heapTreePosition(i,n);
    const cls=`heap-node${highlight.has(i)?' heap-hot':''}`;
    ui.stackView.append(svg('circle',{cx:x,cy:y,r:27,class:cls}));
    const value=svg('text',{x,y:y+2,class:'heap-node-value','text-anchor':'middle'});
    value.textContent=String(cells[i]);ui.stackView.append(value);
    const index=svg('text',{x,y:y+17,class:'heap-node-index','text-anchor':'middle'});
    index.textContent=`[${i}]`;ui.stackView.append(index);
  }
  ui.status.textContent=n?`The same ${n} indexed values appear in the array and tree.`:
    'The heap is empty. Insert a value to begin.';
}
function instantHeap(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;
      ui.returnValue.textContent='';ui.result.textContent='Running…';heapHot=[];break;
    case 'heapRead':heapHot=[frame.index];break;
    case 'memoryWriteAndSettle':heapState=heapSnapshot(frame.snapshot);
      heapHot=frame.a!=null?[frame.a,frame.b]:[frame.index];break;
    case 'snapshot':heapState=heapSnapshot(frame.snapshot);heapHot=[];break;
    case 'operationEnd':heapHot=[];showReturnValue(frame);
      ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';ui.result.textContent=frame.result;showLine(null);break;
  }
  renderHeap();
}
async function animateHeap(frame){
  instantHeap(frame);
  if(frame.kind==='heapRead'){
    ui.phase.textContent='ARRAY READ';ui.status.textContent=`Read cells[${frame.index}] = ${frame.value}`;
    await tween(180,()=>{});
  }else if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent=frame.a!=null?'SWAP TWO INDICES':frame.kind==='heapRemove'?'REMOVE LAST CELL':'ARRAY WRITE';
    ui.status.textContent=frame.a!=null?`Swap cells[${frame.a}] ↔ cells[${frame.b}]`:
      `Array index ${frame.index} changed. Both projections show the same cell.`;
    await tween(440,()=>{});
  }
}
