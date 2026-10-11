'use strict';
// Hash table: bucket row and observed chains.
// The array row and tree use exactly the same indexed Dart storage snapshot.
// No independent browser heap model, no synthetic pointer/reference edges.
// Fixed bucket row, observed ListNode chains and actual pointer relationships.
// This view has no browser-side hash table: only the Dart snapshot is rendered.
function hashSnapshot(snapshot){
  return {buckets:[...(snapshot.buckets??[])],nodes:[...(snapshot.nodes??[])],
    size:snapshot.size??0,capacity:snapshot.capacity??snapshot.buckets?.length??8};
}
function hashChains(snapshot){
  const byId=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const chains=[],seen=new Set();
  for(let index=0;index<snapshot.buckets.length;index++){
    const chain=[];let id=snapshot.buckets[index];
    while(id!=null&&byId.has(id)&&!seen.has(id)){
      seen.add(id);const node=byId.get(id);chain.push(node);id=node.next;
    }
    chains.push(chain);
  }
  return {chains,orphans:snapshot.nodes.filter(n=>!seen.has(n.id))};
}
function autoFrameHash(steps,force=false){
  if(structure!=='hash'||(!force&&cameraMode!=='auto'))return;
  const snapshots=steps.filter(s=>s.kind==='snapshot'&&Array.isArray(s.buckets));
  const depth=Math.max(0,...snapshots.map(s=>Math.max(0,...hashChains(hashSnapshot(s)).chains.map(c=>c.length))));
  const bottom=220+Math.max(0,depth-1)*112+150;
  // Every physical bucket needs its own space; fit BOTH the table width and
  // the longest collision chain, even when students choose >8 buckets.
  const capacity=Math.max(1,...snapshots.map(s=>s.buckets.length));
  const width=(capacity-1)*126+98+160;
  const ratio=treeSceneRatio(),required=Math.max(1100,width,(bottom+100)*ratio);
  const w=force?required:Math.max(viewport.w,required);
  viewport={x:(1100-w)/2,y:(bottom+20-w/ratio)/2,w,h:w/ratio};
  paintViewport();
}
function renderHash(){
  ui.stackView.replaceChildren();
  const state=hashState,capacity=state.buckets.length;
  const {chains,orphans}=hashChains(state);
  const occupied=chains.filter(c=>c.length>0).length;
  const center=SCENE_WIDTH/2,spacing=126; // Fixed cell width; camera fits chosen count.
  const first=center-(capacity-1)*spacing/2;
  const heading=svg('text',{x:center,y:51,class:'heap-title','text-anchor':'middle'});
  heading.textContent=`HASH TABLE · ${state.size} key${state.size===1?'':'s'} · ${occupied}/${capacity} buckets · α = ${(state.size/Math.max(1,capacity)).toFixed(2)}`;
  ui.stackView.append(heading);
  const note=svg('text',{x:center,y:80,class:'heap-section','text-anchor':'middle'});
  note.textContent='index = student hash(key, capacity) · collision chains';ui.stackView.append(note);
  for(let i=0;i<capacity;i++){
    const x=first+i*spacing,head=chains[i][0];
    ui.stackView.append(svg('rect',{x:x-49,y:106,width:98,height:61,rx:11,
      class:`hash-bucket${hashHotBucket===i?' selected':''}`}));
    const index=svg('text',{x,y:131,class:'hash-index','text-anchor':'middle'});
    index.textContent=`[${i}]`;ui.stackView.append(index);
    const key=svg('text',{x,y:153,class:'hash-key','text-anchor':'middle'});
    key.textContent=head?`#${head.id}`:'null';ui.stackView.append(key);
    if(head)ui.stackView.append(svg('line',{x1:x,y1:167,x2:x,y2:190,class:'hash-edge'}));
    for(let j=0;j<chains[i].length;j++){
      const node=chains[i][j],y=220+j*112;
      const cls=`hash-node${hashHotNode===node.id?' selected':''}`;
      ui.stackView.append(svg('rect',{x:x-43,y:y-27,width:86,height:57,rx:12,class:cls}));
      const value=svg('text',{x,y:y-1,class:'hash-value','text-anchor':'middle'});
      value.textContent=String(node.value);ui.stackView.append(value);
      const id=svg('text',{x,y:y+19,class:'hash-id','text-anchor':'middle'});
      id.textContent=`#${node.id}`;ui.stackView.append(id);
      if(j+1<chains[i].length)ui.stackView.append(svg('line',{x1:x,y1:y+30,x2:x,y2:y+85,class:'hash-edge'}));
    }
  }
  if(orphans.length){
    const y=300+Math.max(0,...chains.map(c=>c.length))*112;
    const caption=svg('text',{x:center,y:y-20,class:'heap-section','text-anchor':'middle'});
    caption.textContent='DETACHED / NEW NODES';ui.stackView.append(caption);
    orphans.forEach((node,i)=>{
      const x=center+(i-(orphans.length-1)/2)*105;
      ui.stackView.append(svg('rect',{x:x-40,y,width:80,height:45,rx:9,class:'hash-node detached'}));
      const label=svg('text',{x,y:y+27,class:'hash-value','text-anchor':'middle'});
      label.textContent=String(node.value);ui.stackView.append(label);
    });
  }
  ui.status.textContent=`${state.size} keys in ${capacity} buckets; load factor ${(state.size/Math.max(1,capacity)).toFixed(2)}.`;
}
function instantHash(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=frame.operation;
      ui.description.textContent=frame.description??'Executing the student Dart method.';
      ui.returnValue.textContent='';hashHotBucket=null;hashHotNode=null;break;
    case 'bucketRead':hashHotBucket=frame.index;hashHotNode=frame.to;break;
    case 'visit':case 'compare':hashHotNode=frame.id;break;
    case 'createNode':hashState.nodes.push({...frame.node});hashHotNode=frame.node.id;break;
    case 'writeAndSettle':case 'memoryWriteAndSettle':
      hashState=hashSnapshot(frame.snapshot);
      hashHotBucket=frame.index??null;
      hashHotNode=frame.to??(Number(/^node:(\d+)/.exec(frame.from??'')?.[1])||null);
      break;
    case 'snapshot':hashState=hashSnapshot(frame.snapshot);hashHotBucket=null;hashHotNode=null;break;
    case 'retireAndSettle':hashState=hashSnapshot(frame.snapshot);hashHotBucket=null;hashHotNode=null;break;
    case 'operationEnd':hashHotBucket=null;hashHotNode=null;
      showReturnValue(frame);
      ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';ui.result.textContent=frame.result;showLine(null);break;
  }
  renderHash();
}
async function animateHash(frame){
  instantHash(frame);
  if(frame.kind==='bucketRead'){
    ui.phase.textContent='BUCKET READ';ui.status.textContent=`Inspect bucket [${frame.index}]`;
    await tween(180,()=>{});
  }else if(frame.kind==='visit'||frame.kind==='compare'){
    ui.phase.textContent='CHAIN TRAVERSAL';await tween(190,()=>{});
  }else if(frame.kind==='writeAndSettle'||frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent='REFERENCE WRITE';await tween(420,()=>{});
  }else if(frame.kind==='createNode'){
    ui.phase.textContent='NEW NODE';await tween(220,()=>{});
  }
}
