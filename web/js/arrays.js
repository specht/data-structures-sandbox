'use strict';
// Fixed-memory views: array lists, array stack and circular queue.
// Fixed-capacity list: physical array cells never change positions.
function renderArrayList(){
  ui.stackView.replaceChildren();
  const cells=arrayListState.cells??[], size=arrayListState.size??0;
  if(!cells.length)return;
  const valid=Number.isInteger(size)&&size>=0&&size<=cells.length;
  const subtitle=svg('text',{x:SCENE_WIDTH/2,y:110,
    class:'queue-size','text-anchor':'middle'});
  subtitle.textContent=`${structure==='sorted_array_list'?'SORTED':'UNSORTED'} · size = ${size} / ${cells.length}${valid?'':' · INVALID'}`;
  ui.stackView.append(subtitle);
  const cellWidth=94,start=(SCENE_WIDTH-((cells.length-1)*cellWidth+80))/2,y=235;
  for(let i=0;i<cells.length;i++){
    const x=start+i*cellWidth;
    const classes=['memory-cell'];
    if(i<size)classes.push('queue-occupied');
    if(i===arrayListHot)classes.push('selected');
    const rect=svg('rect',{x,y,width:80,height:65,rx:8,class:classes.join(' ')});
    const value=svg('text',{x:x+40,y:y+38,class:'memory-value'});
    value.textContent=cells[i]===null?'·':String(cells[i]);
    const label=svg('text',{x:x+40,y:y+82,class:'memory-index'});
    label.textContent=`[${i}]`;
    ui.stackView.append(rect,value,label);
  }
  ui.status.textContent=valid?`The list contains ${size} value(s). Cell positions remain fixed during shifts.`:
    'Invalid list size. Check the student implementation.';
}
function instantArrayList(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':
      currentOperation=frame.operation;ui.operation.textContent=currentOperation;
      ui.returnValue.textContent='';ui.result.textContent='Running…';arrayListHot=null;break;
    case 'memoryWriteAndSettle':
      arrayListState={cells:[...frame.snapshot.cells],size:frame.snapshot.size};
      arrayListHot=frame.index??null;break;
    case 'snapshot':
      arrayListState={cells:[...frame.snapshot.cells],size:frame.snapshot.size};
      arrayListHot=null;break;
    case 'operationEnd':
      arrayListHot=null;showReturnValue(frame);ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';
      ui.result.textContent=frame.result;showLine(null);break;
  }
  renderArrayList();
}
async function animateArrayList(frame){
  instantArrayList(frame);
  if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent=frame.index!=null?'ARRAY CELL WRITE':'LIST LENGTH';
    ui.status.textContent=frame.index!=null
      ?`memory[${frame.index}]: ${String(frame.oldValue)} → ${String(frame.value)}`
      :`size: ${frame.oldValue} → ${frame.value}`;
    await tween(420,()=>{});
  }
}
function renderStack(){
  ui.stackView.replaceChildren();
  const cells=stackState.cells??[];
  // Centre the entire memory strip. The top label and arrow share its x.
  const w=94,start=(SCENE_WIDTH-((cells.length-1)*w+80))/2,y=235;
  // The label and arrow are one index indicator, centred over the active cell.
  // For an empty stack there is no arrow to an element.
  const topX=start+Math.max(stackState.top,0)*w+40;
  const index=svg('text',{x:topX,y:169,class:'stack-label','text-anchor':'middle'});
  index.textContent=stackState.top<0?'top = -1 (empty)':`top = ${stackState.top}`;
  ui.stackView.append(index);
  for(let i=0;i<cells.length;i++){
    const x=start+i*w;
    const rect=svg('rect',{x,y,width:80,height:65,rx:8,class:i===stackState.top?'memory-cell selected':'memory-cell'});
    const text=svg('text',{x:x+40,y:y+38,class:'memory-value'});
    text.textContent=cells[i]===null?'·':String(cells[i]);
    const label=svg('text',{x:x+40,y:y+82,class:'memory-index'});label.textContent=`[${i}]`;
    ui.stackView.append(rect,text,label);
    if(i===stackState.top){
      const arrow=makeArrow('ref-arrow');drawArrow(arrow,{x:topX,y:178},{x:topX,y:y-3},'straight');
      ui.stackView.append(arrow);
    }
  }
}
// Circular queue: memory cells NEVER move. The front marker points at the
// next element to remove; rear points at the next cell to write. Their labels
// and arrows occupy different sides even when both indices are equal.
function queueSnapshot(snapshot){
  return {cells:[...(snapshot.cells??[])],front:snapshot.front??0,
    rear:snapshot.rear??0,size:snapshot.size??0};
}
function renderQueue(){
  ui.stackView.replaceChildren();
  const {cells,front,rear,size}=queueState;
  if(!cells.length)return;
  const w=94, y=235, start=(SCENE_WIDTH-((cells.length-1)*w+80))/2;
  const valid=size>=0 && size<=cells.length && front>=0 && front<cells.length &&
    rear>=0 && rear<cells.length;
  const status=svg('text',{x:SCENE_WIDTH/2,y:100,class:'queue-size','text-anchor':'middle'});
  status.textContent=`size = ${size} / ${cells.length}${!valid?' · INVALID':size===0?' · EMPTY':size===cells.length?' · FULL':''}`;
  ui.stackView.append(status);
  for(let i=0;i<cells.length;i++){
    const x=start+i*w;
    // A wrapped queue uses physical indices, not a sliding logical row.
    const distance=valid?(i-front+cells.length)%cells.length:-1;
    const occupied=distance>=0 && distance<size;
    const classes=['memory-cell'];
    if(occupied)classes.push('queue-occupied');
    if(occupied&&i===front)classes.push('queue-front');
    if(i===rear)classes.push('queue-rear');
    const rect=svg('rect',{x,y,width:80,height:65,rx:8,class:classes.join(' ')});
    const value=svg('text',{x:x+40,y:y+38,class:'memory-value'});
    value.textContent=cells[i]===null?'·':String(cells[i]);
    const index=svg('text',{x:x+40,y:y+82,class:'memory-index'});
    index.textContent=`[${i}]`;
    ui.stackView.append(rect,value,index);
    if(occupied){
      const ordinal=svg('text',{x:x+40,y:220,class:'queue-order','text-anchor':'middle'});
      ordinal.textContent=String(distance+1);
      ui.stackView.append(ordinal);
    }
  }
  function indicator(name,position,above){
    if(!Number.isInteger(position)||position<0||position>=cells.length)return;
    const x=start+position*w+40;
    const label=svg('text',{x,y:above?164:385,
      class:`queue-indicator ${name}`,'text-anchor':'middle'});
    label.textContent=`${name} = ${position}`;
    const arrow=makeArrow(`ref-arrow queue-${name}`);
    drawArrow(arrow,above?{x,y:174}:{x,y:365},
      above?{x,y:y-3}:{x,y:y+65+3},'straight');
    ui.stackView.append(label,arrow);
  }
  indicator('front',front,true);
  indicator('rear',rear,false);
}
function instantQueue(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;
      ui.returnValue.textContent='';ui.result.textContent='Running…';break;
    case 'memoryWriteAndSettle':case 'snapshot':queueState=queueSnapshot(frame.snapshot);break;
    case 'operationEnd':showReturnValue(frame);
      ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';ui.result.textContent=frame.result;showLine(null);break;
  }
  renderQueue();
}
async function animateQueue(frame){
  if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent='CIRCULAR QUEUE WRITE';
    ui.status.textContent=frame.index!=null?
      `memory[${frame.index}]: ${String(frame.oldValue)} → ${String(frame.value)}`:
      `${frame.name}: ${frame.oldValue} → ${frame.value}`;
    // Render the exact recorded intermediate marker and cell state. No moving
    // array cells, no relayout, including during wraparound or backward seek.
    queueState=queueSnapshot(frame.snapshot);renderQueue();
    await tween(420,()=>{});return;
  }
  instantQueue(frame);
}
function instantStack(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;ui.returnValue.textContent='';ui.result.textContent='Running…';break;
    case 'memoryWriteAndSettle':case 'snapshot':
      stackState={cells:[...frame.snapshot.cells],top:frame.snapshot.top};break;
    case 'operationEnd':showReturnValue(frame);
      ui.result.textContent=frame.result;showLine(null);break;
  }
  renderStack();
}
async function animateStack(frame){
  if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent=frame.from?'MEMORY':'ARRAY WRITE';
    ui.status.textContent=frame.index!=null?`memory[${frame.index}]: ${String(frame.oldValue)} → ${String(frame.value)}`:
      `top: ${frame.oldValue} → ${frame.value}`;
    // Fixed memory cells never move: only cell contents and top index change.
    stackState={cells:[...frame.snapshot.cells],top:frame.snapshot.top};renderStack();
    await tween(420,()=>{});return;
  }
  instantStack(frame);
  if(frame.kind==='operationEnd')ui.phase.textContent='DONE';
}
