'use strict';
// Discovered methods, argument form and incoming traces.
// Method signatures are supplied by the Dart AST-based generator; no method
// names or argument counts are hardcoded in the browser.
let discovered = new Map();
let sequenceMode=false;
function selectedDescriptor(){return discovered.get(ui.method.value)??null;}
function renderArguments(){
  const descriptor=selectedDescriptor();if(!descriptor)return;
  const params=descriptor.params??[];
  ui.singleArg.style.display=params.length===1?'flex':'none';
  ui.multiArgs.replaceChildren();
  if(params.length===1){
    const p=params[0];ui.argLabel.textContent=`${p.name} · ${p.type}`;
    ui.values.value=p.type==='int'?'25':p.type==='double'?'2.5':p.type==='bool'?'true':'example';
    ui.values.placeholder=p.type==='int'?'25 or 10, 20, 30':p.name;
  } else {
    params.forEach((p,i)=>{
      const wrapper=document.createElement('span');wrapper.className='argument-field';
      const label=document.createElement('label');label.textContent=`${p.name} · ${p.type}`;
      const input=document.createElement('input');input.dataset.argument=String(i);
      input.setAttribute('aria-label',`${p.name} (${p.type})`);
      input.value=p.type==='int'?'0':p.type==='double'?'0.0':p.type==='bool'?'false':'';
      wrapper.append(label,input);ui.multiArgs.append(wrapper);
    });
  }
}
function updateMethodCatalog(catalog){
  if(!Array.isArray(catalog))return;
  // Another structure kind: bring back the calls remembered for it.
  if(callsKind!==structure){
    callsKind=structure;
    const saved=savedCallsFor(structure);
    if(saved!==null)ui.callInput.value=saved;
  }
  let typedNames=[];
  try{
    typedNames=splitCommandText(ui.callInput.value).map(call=>
      /^\s*([A-Za-z_]\w*)\s*\(/.exec(call)?.[1]??null);
  }catch(_){ }
  const selected=ui.method.value;
  discovered=new Map(catalog.map(m=>[m.name,m]));
  ui.method.replaceChildren();
  for(const method of catalog){
    const option=document.createElement('option');option.value=method.name;
    option.textContent=`${method.name}(${(method.params??[]).map(p=>`${p.type} ${p.name}`).join(', ')})`;
    ui.method.append(option);
  }
  ui.method.value=discovered.has(selected)?selected:(catalog[0]?.name??'');
  // New structure/student may not have the previously displayed method.
  // Preserve a custom call only if the chosen implementation exposes it.
  if(!typedNames.length||typedNames.some(name=>!name||!discovered.has(name))){
    const preferred=catalog.find(m=>['push','enqueue','insert','addVertex','contains'].includes(m.name))??catalog[0];
    const example=preferred?.params?.map(p=>p.type==='String'?'"hello"':
      p.type==='bool'?'true':p.type==='double'?'1.5':'25')??[];
    ui.callInput.value=preferred?`${preferred.name}(${example.join(', ')})`:'';
    ui.callInput.placeholder=preferred?`Enter a ${(globalThis.selectedLanguage?.()??{label:'Dart',print:'print(...)'}).label} method call`:'No callable methods available';
  }
  updateCommandComposer();
  ui.invoke.disabled=!catalog.length;renderArguments();
  renderSuggestions();
}
function parseArgument(value,type){
  const text=value.trim();
  if(type==='String')return value;
  if(type==='bool'){if(text==='true')return true;if(text==='false')return false;throw Error('Enter true or false.');}
  if(type==='int'){if(!/^-?\d+$/.test(text))throw Error('Enter a whole number.');
    const n=Number(text);if(!Number.isSafeInteger(n)||Math.abs(n)>999)throw Error('Use an integer between -999 and 999.');return n;}
  if(type==='double'){const n=Number(text);if(!text||!Number.isFinite(n))throw Error('Enter a decimal number.');return n;}
  throw Error(`Unsupported argument type: ${type}`);
}
ui.method.addEventListener('change',renderArguments);
// Long linked chains need a wider view rather than squeezing node cards and
// clipping head/tail/local pointers. Like trees, frame once per whole trace.
function autoFrameLinked(steps){
  if(!['sorted_linked_list','unsorted_linked_list','linked_stack','linked_queue'].includes(structure)||cameraMode!=='auto')return;
  const snapshots=steps.filter(step=>step.kind==='snapshot'&&Array.isArray(step.nodes));
  if(!snapshots.length)return;
  let left=Infinity,right=-Infinity,maxRefs=1;
  const targets=new Map();
  for(const event of steps){
    if(event.kind!=='variableWrite'||event.to==null)continue;
    if(!targets.has(event.to))targets.set(event.to,new Set());
    targets.get(event.to).add(event.name);
  }
  maxRefs=Math.max(1,...[...targets.values()].map(names=>names.size+1));
  for(const snap of snapshots){
    const byId=new Map(snap.nodes.map(node=>[node.id,node]));
    let cursor=snap.head,count=0;
    const seen=new Set();
    while(cursor!=null&&byId.has(cursor)&&!seen.has(cursor)){
      seen.add(cursor);cursor=byId.get(cursor).next;count++;
    }
    if(!count)continue;
    const gap=count>1?Math.min(GAP,Math.max(144,(SCENE_WIDTH-140-WIDTH)/(count-1))):GAP;
    const firstX=(SCENE_WIDTH-WIDTH-(count-1)*gap)/2;
    left=Math.min(left,firstX-100);
    right=Math.max(right,firstX+(count-1)*gap+WIDTH+100);
  }
  if(!Number.isFinite(left)){left=0;right=SCENE_WIDTH;}
  const top=Math.min(0,156-70-(maxRefs-1)*30-42),bottom=510;
  const ratio=treeSceneRatio();
  const required=Math.max(SCENE_WIDTH,right-left,(bottom-top)*ratio);
  const w=Math.max(viewport.w,required),h=w/ratio;
  viewport={x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};
  paintViewport();
}
function acceptTrace(data){
  if(!data.source?.lines||!Array.isArray(data.steps)||data.steps[0]?.kind!=='snapshot')throw Error('Invalid trace from the worker.');
  cameraAnimationId++; // A new trace owns the viewport, not an old Fit animation.
  animationGeneration++;animating=false;
  if(data.structure&&data.structure!==structure){structure=data.structure;showSelection();}
  if(data.methods)updateMethodCatalog(data.methods);
  const previousValues=savedValues;
  source=data.source;rawSteps=data.steps;traceInitial=data.steps[0];
  frames=makeFrames(rawSteps,ui.traceMode.value);
  setRuntimeConsole(data.console??[],data.error??null,
    {autoExpand:(data.console?.length??0)>0||data.error!=null,append:true});
  // Reframe once at the command boundary, using the final reachable state.
  // The SVG viewBox then stays unchanged throughout the entire recorded trace.
  ensureViewport(structure);
  autoFrameTree(rawSteps);
  autoFrameLinked(rawSteps);
  autoFrameHeap(rawSteps);
  autoFrameHash(rawSteps);
  playbackToken++;
  renderSource(source);restore(0);
  if(playbackMode==='result')jumpTo(frames.length);
  else if(playbackMode==='play'&&focusAfterCommand)void playTrace(playbackToken);
  savedValues=[...data.values];savedCapacity=data.capacity??8;savedSessionId=data.sessionId??null;renderSuggestions();
  if(focusAfterCommand){focusAfterCommand=false;if(commandTakesFocus)ui.next.focus({preventScroll:true});}
  ui.connection.textContent='Connected';ui.cmdStatus.classList.remove('error');
  showCompiling(false);
  ui.cmdStatus.textContent=frames.length?`${frames.length} steps ready · ${structure} · [${data.values.join(', ')}]. Use ← / →.`:
    'Ready. Choose an operation above.';
  const calls=data.calls;
  if(calls?.stoppedEarly){
    const skipped=calls.planned-calls.completed;
    ui.cmdStatus.textContent=`Stopped at call ${calls.completed} of ${calls.planned}: its check failed, `+
      `so the remaining ${skipped===1?'call was':`${skipped} calls were`} not run.`;
    ui.cmdStatus.classList.add('error');
  }else if(calls&&(calls.planned>1||calls.fromEmpty)){
    ui.cmdStatus.textContent=`Ran ${calls.planned} call${calls.planned===1?'':'s'}${calls.fromEmpty?' from empty':''}`+
      ` · ${frames.length} steps · [${data.values.join(', ')}]. Use ← / →.`;
    // Repeat is the only way a Run from the text field discards the previous
    // contents; say so loudly instead of letting them vanish.
    if(calls.fromEmpty&&previousValues?.length){
      ui.cmdStatus.textContent=`Repeat is on, so this Run started from an empty structure and discarded `+
        `[${previousValues.join(', ')}]. Turn Repeat off to keep building on your structure. `+
        ui.cmdStatus.textContent;
      ui.cmdStatus.classList.add('error');
    }
  }
}
function acceptExecutionError(data){
  showCompiling(false);focusAfterCommand=false;
  stopPlayback();
  const hasTrace=data.source?.lines&&Array.isArray(data.steps)&&data.steps[0]?.kind==='snapshot';
  if(hasTrace){
    acceptTrace(data);
    // Errors belong to the final recorded step. Start there so the synchronized
    // Console and source highlight show the failure immediately; rewinding will
    // still hide it until that step is reached again.
    jumpTo(frames.length);
  }else{
    setRuntimeConsole(data.console??[],data.error??null,
      {autoExpand:true,forceVisible:true,append:true});
    const line=Number.isInteger(data.error?.line)?data.error.line:null;
    if(line!==null)window.sandboxEditor?.highlight(line);
  }
  ui.connection.textContent='Runner stopped';
  ui.cmdStatus.textContent='Execution stopped · details are in the Console.';
  ui.cmdStatus.classList.remove('error');
}
// focus:false keeps the keyboard focus where it is (Repeat after Ctrl+S in
// the code editor must not move it to the step controls).
function send(payload,{focus=true}={}){
  if(!socket||socket.readyState!==WebSocket.OPEN){ui.cmdStatus.textContent='The sandbox server is not connected.';return;}
  // Even if the user is halfway through an animation, allow another command.
  animationGeneration++;animating=false;playbackToken++;
  if(frames.length)restore(stepIndex);
  focusAfterCommand=true;commandTakesFocus=focus;
  socket.send(JSON.stringify(payload));ui.cmdStatus.textContent=`${(globalThis.selectedLanguage?.()??{label:'Dart',print:'print(...)'}).label} is executing…`;
}
ui.form.addEventListener('submit',event=>{
  event.preventDefault();
  const method=selectedDescriptor();
  if(!method){ui.cmdStatus.textContent='Waiting for method discovery…';return;}
  const params=method.params??[];
  try{
    if(params.length===1 && params[0].type==='int'){
      const raw=ui.values.value.trim();
      const values=raw.split(',').map(part=>parseArgument(part,'int'));
      if(!values.length||values.length>MAX_CALLS)throw Error(`Use 1–${MAX_CALLS} values.`);
      send({action:'run',method:method.name,values});
    }else{
      const raw=params.length===1?[ui.values.value]:
        [...ui.multiArgs.querySelectorAll('input')].map(input=>input.value);
      if(raw.length!==params.length)throw Error('Missing argument.');
      send({action:'run',method:method.name,arguments:raw.map((v,i)=>parseArgument(v,params[i].type))});
    }
  }catch(error){ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');}
});
