'use strict';
// Animation, trace frames, stepping and keyboard navigation.
const easing=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const lerp=(a,b,t)=>a+(b-a)*t;
function tween(milliseconds,update){
  const generation=animationGeneration;
  return new Promise((resolve,reject)=>{
    const start=performance.now();
    function frame(now){
      if(generation!==animationGeneration){reject(CANCELLED);return;}
      const speed=Number(ui.speed.value);
      const progress=Math.min(1,(now-start)*(Number.isFinite(speed)?speed:1000)/milliseconds);
      update(easing(progress));
      if(progress>=1)resolve();else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
async function animateCreate(data){const node=newNode(data);const startY=node.y;ui.phase.textContent='NEW OBJECT';
  ui.status.textContent=`Node #${node.id} created. It is not yet linked into the list.`;
  await tween(430,t=>{node.y=lerp(startY,156,t);node.opacity=t;renderAll();});
}
async function animateReference(name,to){
  const old=name==='head'?head:name==='tail'?tailId:name==='root'?rootId:references[name];
  const dock=dockFor(name);
  const start=referencePoint(name,old);
  const end=referencePoint(name,to);
  hotReference=name;override={from:['head','tail','root'].includes(name)?`root:${name}`:`var:${name}`,...start,nullTarget:to==null};
  ui.phase.textContent=(name==='head'||name==='tail'||name==='root')?'ROOT POINTER':'LOCAL POINTER';
  ui.status.textContent=`${name}: ${old==null?'null':'#'+old} → ${to==null?'null':'#'+to}. Nodes remain stationary.`;
  await tween(570,t=>{override={from:override.from,x:lerp(start.x,end.x,t),y:lerp(start.y,end.y,t),nullTarget:to==null};renderReferences();});
  if(name==='head')head=to;else if(name==='tail')tailId=to;else if(name==='root')rootId=to;else references[name]=to;
  override=null;hotReference=null;renderAll();
}
async function animateWrite(step){
  if(step.from==='root:head'||step.from==='root:root'||step.from==='root:tail'){await animateReference(step.from.slice(5),step.to);return;}
  const parsed=/^node:(\d+)\.(next|left|right)$/.exec(step.from);
  if(!parsed)throw Error(`Unrecognized pointer origin ${step.from}`);
  const node=nodes.get(Number(parsed[1]));if(!node)throw Error('Missing pointer source.');
  const field=parsed[2];
  if(node[field]!==step.oldTo)throw Error(`Pointer mismatch: ${step.from} was ${node[field]}, trace expected ${step.oldTo}`);
  const nullPoint={x:node.x+WIDTH+26,y:node.y+HEIGHT/2};
  // Lists: morph the target outline, so the arrow keeps aiming at a centre and
  // starts and ends exactly like the static drawing.
  const from=isTree()?null:linkTarget(step.oldTo,nullPoint),to=isTree()?null:linkTarget(step.to,nullPoint);
  const start=isTree()?treeTargetPoint(step.oldTo,field,treeCentre(node)):{x:from.cx,y:from.cy};
  const end=isTree()?treeTargetPoint(step.to,field,treeCentre(node)):{x:to.cx,y:to.cy};
  override={from:step.from,...start,...(isTree()?{}:{target:from})};hotLink=step.from;hotNode=node.id;
  ui.phase.textContent='POINTER CHANGE';ui.phase.classList.add('hot');
  ui.status.textContent=`${step.from}: ${step.oldTo==null?'null':'#'+step.oldTo} → ${step.to==null?'null':'#'+step.to}. The layout is unchanged.`;
  await tween(700,t=>{override={from:step.from,x:lerp(start.x,end.x,t),y:lerp(start.y,end.y,t),
      ...(isTree()?{}:{target:mixTargets(from,to,t)})};
    if(isTree())treeEdgeMotion=Math.sin(Math.PI*t);
    renderEdges();});
  node[field]=step.to;override=null;treeEdgeMotion=0;renderAll();
}
async function animateSettle(snapshot){
  // The pointer has already moved. ONLY NOW calculate new node slots.
  const {targets,count,cycle}=applySnapshot(snapshot,true);
  const starts=new Map([...nodes].map(([id,n])=>[id,{x:n.x,y:n.y,opacity:n.opacity}]));
  ui.phase.textContent='SETTLING';ui.phase.classList.remove('hot');
  ui.status.textContent='Pointer change complete. The reachable list now rearranges smoothly.';
  await tween(850,t=>{
    for(const [id,target] of targets){const node=nodes.get(id),start=starts.get(id);
      node.x=lerp(start.x,target.x,t);node.y=lerp(start.y,target.y,t);
      node.opacity=lerp(start.opacity,target.opacity,t);node.detached=target.detached;}
    if(isTree())treeEdgeMotion=Math.sin(Math.PI*t);
    renderAll();
  });
  treeEdgeMotion=0;hotNode=null;hotLink=null;renderAll();
  ui.status.textContent=cycle?'Cycle detected. Traversal stopped.':`${count} node(s) reachable from head.`;
}
function clearView(){treeEdgeMotion=0;nodes.clear();nodeViews.clear();links.clear();ui.nodes.replaceChildren();ui.edges.replaceChildren();ui.references.replaceChildren();ui.nullRail.replaceChildren();
  head=null;tailId=null;rootId=null;linkedListSize=0;references={};override=null;ui.stackView.replaceChildren();stackState={cells:Array(savedCapacity).fill(null),top:-1};queueState={cells:Array(savedCapacity).fill(null),front:0,rear:0,size:0};arrayListState={cells:[],size:0};arrayListHot=null;heapState={cells:[],heapOrder:true};heapHot=[];hashState={buckets:Array(8).fill(null),nodes:[],size:0,capacity:8};hashHotBucket=null;hashHotNode=null;ui.returnValue.textContent='';hotNode=null;hotLink=null;hotReference=null;activeLine=null;
  currentOperation='Ready';lastResult='Ready';ui.operation.textContent='Ready';ui.description.textContent='Step through the recorded execution.';
  ui.phase.textContent='READY';ui.phase.classList.remove('hot');ui.result.textContent='Ready';
  ui.code.querySelector('.code-line.active')?.classList.remove('active');
}
function makeFrames(raw, mode='conceptual'){
  const result=[];
  let pendingLine=null;
  for(let i=1;i<raw.length;i++){
    const s=raw[i];
    if(s.kind==='line'){
      pendingLine=s.line;
      if(mode==='detailed')result.push({...s,rawEnd:i});
      continue;
    }
    if(s.kind==='retire'&&raw[i+1]?.kind==='snapshot'){result.push({...s,kind:'retireAndSettle',snapshot:raw[++i],line:s.line??pendingLine,rawEnd:i});pendingLine=null;continue;}
    if(s.kind==='snapshot'){
      result.push({kind:'snapshot',snapshot:s,line:pendingLine,rawEnd:i});
      pendingLine=null;
      continue;
    }
    if(s.kind==='localsClear')continue;
    if((s.kind==='pointerWrite'||s.kind==='bucketWrite'||s.kind==='cellWrite'||s.kind==='indexWrite'||s.kind==='heightWrite'||['heapWrite','heapAppend','heapRemove','heapSwap'].includes(s.kind))&&raw[i+1]?.kind==='snapshot'){
      result.push({...s,kind:s.kind==='pointerWrite'?'writeAndSettle':s.kind==='heightWrite'?'heightAndSettle':'memoryWriteAndSettle',snapshot:raw[++i],line:s.line??pendingLine,rawEnd:i});
    } else result.push({...s,line:s.line??pendingLine,rawEnd:i});
    pendingLine=null;
  }
  return result;
}
function instant(frame){
  if(frame.line!=null)showLine(frame.line);
  if(frame.kind==='executionError'){
    lastResult=`Runtime error: ${frame.message}`;ui.result.textContent=lastResult;
    ui.operation.textContent='Execution stopped';ui.phase.textContent='RUNTIME ERROR';
    ui.phase.classList.add('hot');ui.status.textContent=lastResult;renderAll();return;
  }
  if(isArrayList()){instantArrayList(frame);return;}
  if(structure==='stack'){instantStack(frame);return;}
  if(structure==='array_queue'){instantQueue(frame);return;}
  if(structure==='array_heap'){instantHeap(frame);return;}
  if(structure==='hash'){instantHash(frame);return;}
  switch(frame.kind){
    case 'line':break;
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;ui.returnValue.textContent='';ui.description.textContent=frame.description;break;
    case 'createNode':{const n=newNode(frame.node);n.opacity=1;n.y=156;break;}
    case 'variableWrite':references[frame.name]=frame.to;break;
    case 'visit':hotNode=frame.id;break;
    case 'compare':hotNode=frame.id;break;
    case 'writeAndSettle':{
      if(frame.from==='root:head')head=frame.to;
      else if(frame.from==='root:tail')tailId=frame.to;
      else if(frame.from==='root:root')rootId=frame.to;
      else{const match=/^node:(\d+)\.(next|left|right)$/.exec(frame.from);if(match&&nodes.has(Number(match[1])))nodes.get(Number(match[1]))[match[2]]=frame.to;}
      applySnapshot(frame.snapshot);break;
    }
    case 'heightAndSettle':hotNode=frame.id;applySnapshot(frame.snapshot);break;
    case 'snapshot':applySnapshot(frame.snapshot);break;
    case 'memoryWriteAndSettle':applySnapshot(frame.snapshot);break;
    case 'retireAndSettle':retireNodes(frame.ids);applySnapshot(frame.snapshot);break;
    case 'operationEnd':references={};hotNode=null;lastResult=frame.result;ui.result.textContent=lastResult;showReturnValue(frame);showLine(null);break;
  }
  renderAll();
}
function restore(index){clearView();applySnapshot(traceInitial);
  for(let i=0;i<index;i++)instant(frames[i]);stepIndex=index;
  ui.phase.textContent=index?'REVISIT':'READY';ui.phase.classList.remove('hot');
  ui.status.textContent=index?'Previous recorded state restored.':frames.length?'At the start of the trace. Step forward to inspect the operation.':'Choose a method above to begin.';
  sync();
}
let traceInitial=null;
async function animate(frame){
  if(frame.line!=null)showLine(frame.line);
  if(frame.kind==='executionError'){
    lastResult=`Runtime error: ${frame.message}`;ui.result.textContent=lastResult;
    ui.operation.textContent='Execution stopped';ui.phase.textContent='RUNTIME ERROR';
    ui.phase.classList.add('hot');ui.status.textContent=lastResult;renderAll();return;
  }
  if(isArrayList()){await animateArrayList(frame);return;}
  if(structure==='stack'){await animateStack(frame);return;}
  if(structure==='array_queue'){await animateQueue(frame);return;}
  if(structure==='array_heap'){await animateHeap(frame);return;}
  if(structure==='hash'){await animateHash(frame);return;}
  switch(frame.kind){
    case 'line':ui.phase.textContent='SOURCE LINE';break;
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=frame.operation;ui.returnValue.textContent='';
      ui.description.textContent=frame.description;lastResult='Running…';ui.result.textContent=lastResult;
      hotNode=null;ui.phase.textContent='METHOD CALL';ui.phase.classList.remove('hot');renderAll();break;
    case 'visit':hotNode=frame.id;ui.phase.textContent='VISIT';
      ui.status.textContent=`Visiting node #${frame.id} (value ${nodes.get(frame.id)?.value??'?'})`;
      renderAll();await tween(190,()=>{});break;
    case 'compare':hotNode=frame.id;ui.phase.textContent='COMPARE';
      ui.status.textContent=`${nodes.get(frame.id)?.value??'?'} ${frame.equal?'=':'≠'} ${frame.target}`;
      renderAll();break;
    case 'variableWrite':await animateReference(frame.name,frame.to);break;
    case 'createNode':await animateCreate(frame.node);break;
    case 'writeAndSettle':await animateWrite(frame);await animateSettle(frame.snapshot);break;
    case 'heightAndSettle':
      hotNode=frame.id;ui.phase.textContent='HEIGHT WRITE';
      ui.status.textContent=`Node #${frame.id}: height ${frame.before} → ${frame.to}.`;
      applySnapshot(frame.snapshot);renderAll();await tween(230,()=>{});break;
    case 'snapshot':await animateSettle(frame.snapshot);break;
    case 'memoryWriteAndSettle':
      applySnapshot(frame.snapshot);renderAll();
      ui.phase.textContent='LIST SIZE';
      ui.status.textContent=`Student-owned size: ${frame.oldValue} → ${frame.value}`;
      await tween(220,()=>{});break;
    case 'retireAndSettle':await animateRetire(frame.ids,frame.snapshot);break;
    case 'operationEnd':references={};hotNode=null;showReturnValue(frame);ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';
      lastResult=frame.result;ui.result.textContent=lastResult;ui.status.textContent=frame.result;showLine(null);renderAll();break;
    default:throw Error('Unknown event '+frame.kind);
  }
}
function sync(){
  ui.next.disabled=!frames.length||stepIndex>=frames.length;
  ui.back.disabled=stepIndex===0;
  ui.first.disabled=stepIndex===0;
  ui.last.disabled=!frames.length||stepIndex===frames.length;
  ui.stepLabel.textContent=`Step ${stepIndex} / ${frames.length}`;
  ui.seek.max=String(frames.length);
  ui.seek.value=String(stepIndex);
  renderRuntimeConsole();
}
// The logical trace position is updated immediately. A second navigation input
// invalidates the old requestAnimationFrame tween and restores the requested
// snapshot without waiting for the original movement to finish.
function jumpTo(index){
  animationGeneration++;
  animating=false;
  restore(Math.max(0,Math.min(frames.length,index)));
}
function updatePlaybackButtons(){
  for(const button of ui.playbackModes){
    const selected=button.dataset.playbackMode===playbackMode;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
}
function stopPlayback(){
  playbackToken++;
  playbackMode='step';
  updatePlaybackButtons();
}
async function playTrace(token){
  while(playbackMode==='play'&&token===playbackToken&&stepIndex<frames.length){
    const oldIndex=stepIndex;
    await forward();
    if(playbackMode!=='play'||token!==playbackToken||stepIndex<=oldIndex)return;
    // Give users time to understand each mutation; source-only events are quicker.
    const delay=frames[oldIndex]?.kind==='line'?140:260;
    await new Promise(resolve=>setTimeout(resolve,delay/Math.max(.1,Number(ui.speed.value)||1)));
  }
}
function choosePlaybackMode(mode){
  if(!['step','play','result'].includes(mode))return;
  playbackToken++;
  playbackMode=mode;
  updatePlaybackButtons();
  rememberPlaybackPreferences();
  if(mode==='step'){
    if(animating)jumpTo(stepIndex);
  }else if(mode==='result'){
    jumpTo(frames.length);
  }else if(frames.length){
    if(animating)jumpTo(stepIndex);
    if(stepIndex===frames.length)jumpTo(0);
    void playTrace(playbackToken);
  }
}
ui.playbackModes.forEach(button=>button.addEventListener('click',()=>choosePlaybackMode(button.dataset.playbackMode)));
function navigate(action){stopPlayback();return action();}

async function forward(){
  if(!frames.length||stepIndex>=frames.length)return;
  const target=stepIndex+1;
  if(animating||ui.speed.value==='instant'){
    jumpTo(target);
    return;
  }
  animationGeneration++;
  const generation=animationGeneration;
  stepIndex=target;
  animating=true;
  sync();
  try{
    await animate(frames[target-1]);
  }catch(error){
    if(error!==CANCELLED){
      ui.cmdStatus.textContent=`Trace error: ${error.message}`;
      ui.cmdStatus.classList.add('error');console.error(error);
      if(generation===animationGeneration)jumpTo(target);
    }
  }finally{
    if(generation===animationGeneration){animating=false;sync();}
  }
}
// A normal backward step plays the inverse visual change. For a structural
// write, restore the old geometry FIRST, then retarget the pointer back.
// Repeated navigation cancels the tween and jumps immediately, so rapid
// stepping never waits for an unfinished animation.
async function backward(){
  if(stepIndex<=0)return;
  const target=stepIndex-1;
  if(animating||ui.speed.value==='instant'){jumpTo(target);return;}
  animationGeneration++;
  const generation=animationGeneration;
  animating=true;
  const frame=frames[target];
  const currentIndex=stepIndex;
  // Sample the exact preceding state without presenting intermediate frames.
  // Both restores happen in one JS task, before the browser has painted.
  restore(target);
  const previous=new Map([...nodes].map(([id,n])=>[id,{...n}]));
  const oldReference=frame.kind==='variableWrite'?references[frame.name]:null;
  restore(currentIndex);
  if(frame.kind==='retireAndSettle'){
    for(const id of frame.ids){
      const old=previous.get(id);
      if(!old||nodes.has(id))continue;
      const n=newNode(old,true);
      Object.assign(n,old,{y:old.y+45,opacity:0,detached:true});
    }
    renderAll();
  }
  stepIndex=target;sync();
  try{
    if(frame.kind==='writeAndSettle'||frame.kind==='snapshot'||frame.kind==='retireAndSettle'||frame.kind==='memoryWriteAndSettle'){
      ui.phase.textContent='REWIND · SETTLING';
      const starts=new Map([...nodes].map(([id,n])=>[id,{x:n.x,y:n.y,opacity:n.opacity}]));
      await tween(650,t=>{
        for(const [id,n] of nodes){const a=starts.get(id),b=previous.get(id);
          if(!b)continue;
          n.x=lerp(a.x,b.x,t);n.y=lerp(a.y,b.y,t);
          n.opacity=lerp(a.opacity,b.opacity,t);
        }
        if(isTree())treeEdgeMotion=Math.sin(Math.PI*t);
        renderAll();
      });
      treeEdgeMotion=0;renderAll();
      if(frame.kind==='retireAndSettle'){
        ui.phase.textContent='REWIND · RESTORING OBJECT';
        ui.status.textContent='Restoring an earlier, still-referenced object.';
      }
      if(frame.kind==='writeAndSettle'){
        ui.phase.textContent='REWIND · POINTER';
        await animateWrite({from:frame.from,oldTo:frame.to,to:frame.oldTo});
      }
    } else if(frame.kind==='variableWrite'){
      await animateReference(frame.name,oldReference??null);
    } else if(frame.kind==='createNode'){
      const node=nodes.get(frame.node.id);
      if(node){const startY=node.y,startOpacity=node.opacity;
        ui.phase.textContent='REWIND · OBJECT';
        await tween(380,t=>{node.y=lerp(startY,startY-42,t);node.opacity=lerp(startOpacity,0,t);renderAll();});
      }
    }
    if(generation===animationGeneration)restore(target);
  }catch(error){
    if(error!==CANCELLED){console.error(error);ui.cmdStatus.textContent=`Reverse trace error: ${error.message}`;
      ui.cmdStatus.classList.add('error');if(generation===animationGeneration)restore(target);}
  }finally{if(generation===animationGeneration){animating=false;sync();}}
}
function nextOperation(){
  const next=frames.findIndex((f,i)=>i>=stepIndex&&f.kind==='operationStart');
  jumpTo(next>=0?next+1:frames.length);
}
function previousOperation(){
  let previous=0;
  for(let i=0;i<Math.max(0,stepIndex-1);i++){
    if(frames[i].kind==='operationStart')previous=i+1;
  }
  jumpTo(previous);
}
ui.next.addEventListener('click',()=>navigate(forward));
ui.back.addEventListener('click',()=>navigate(backward));
ui.first.addEventListener('click',()=>navigate(()=>jumpTo(0)));
ui.last.addEventListener('click',()=>navigate(()=>jumpTo(frames.length)));
ui.seek.addEventListener('input',()=>navigate(()=>jumpTo(Number(ui.seek.value))));
ui.traceMode.addEventListener('change',()=>{
  animationGeneration++;animating=false;
  frames=makeFrames(rawSteps,ui.traceMode.value);
  restore(0);
  if(playbackMode==='result')jumpTo(frames.length);
  else if(playbackMode==='play')void playTrace(++playbackToken);
  ui.cmdStatus.textContent=`${ui.traceMode.value==='detailed'?'Detailed':'Key-event'} trace selected. Use ← / → or drag the timeline.`;
});
document.addEventListener('keydown',event=>{
  if(validationUI.dialog.open)return; // Let the native test dialog handle its own keys.
  // A focused editor must retain its own cursor, Home/End and Space keys.
  if(event.target?.closest?.('#source-editor'))return;
  if(event.altKey)return;
  // Ctrl/Cmd+Home/End works even while the method field has focus. Plain
  // Home/End still belongs to a text editor or native select when editing.
  if((event.ctrlKey||event.metaKey)&&(event.key==='Home'||event.key==='End')){
    event.preventDefault();navigate(()=>jumpTo(event.key==='Home'?0:frames.length));return;
  }
  if(event.ctrlKey||event.metaKey)return;
  // Buttons (especially Run and suggestion buttons) must not swallow arrows.
  // Native text inputs/selectors retain their editing keys. The speed slider
  // is not a text editor: Home/End continue to navigate the trace there too.
  if((event.target instanceof HTMLInputElement && (event.target.type??'text')!=='range')||
     event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement||event.target?.isContentEditable)return;
  // Arrow keys on a focused slider adjust that slider. Home/End still jump
  // to the start/end of the recorded trace as requested.
  if(event.target instanceof HTMLInputElement && event.target.type==='range' &&
     ['ArrowLeft','ArrowRight'].includes(event.key))return;
  if(event.key==='ArrowRight'){event.preventDefault();navigate(()=>event.shiftKey?nextOperation():forward());}
  else if(event.key==='ArrowLeft'){event.preventDefault();navigate(()=>event.shiftKey?previousOperation():backward());}
  else if(event.key==='Home'){event.preventDefault();navigate(()=>jumpTo(0));}
  else if(event.key==='End'){event.preventDefault();navigate(()=>jumpTo(frames.length));}
  else if(event.key===' '){event.preventDefault();choosePlaybackMode(playbackMode==='play'?'step':'play');}
});
