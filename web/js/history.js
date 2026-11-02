'use strict';
// The call history: every call that ran on the visualized structure since it
// was last empty, per implementation (student, structure and file). After a
// save, a restart or a page reload the structure starts empty again; with
// "Rebuild after save" on, these calls run again by themselves, so a tree
// built by clicking survives every edit of the code. Reset (or Build sample
// tree) starts a new history.
const historyStorageKey='data-structure-sandbox.v2.history';
const rebuildStorageKey='data-structure-sandbox.v2.rebuild';
const MAX_HISTORY=200;
const SHOWN_HISTORY=8;
const historyUI={
  title:$('history-title'),list:$('call-history'),
  replay:$('history-replay'),copy:$('history-copy'),keep:$('history-keep'),
};
let callHistory=[],historyKey=null;
let rebuildAfterSave=true;
// A rebuild failed (the code changed behavior): wait for the next code change
// instead of failing again after every restart.
let rebuildSuspended=false;
// The run request whose trace is outstanding, and further chunks of a
// sequence longer than one request.
let pendingRun=null,sequenceQueue=[],sequence=null;

const validCall=call=>call&&typeof call.method==='string'&&Array.isArray(call.arguments);
function formatCall(call){
  return `${call.method}(${call.arguments.map(value=>JSON.stringify(value)).join(', ')})`;
}
function storedHistories(){
  try{
    const value=JSON.parse(localStorage.getItem(historyStorageKey)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch(_){return {};}
}
function saveHistory(){
  if(!historyKey)return;
  try{
    const all=storedHistories();
    if(callHistory.length)all[historyKey]=callHistory;else delete all[historyKey];
    localStorage.setItem(historyStorageKey,JSON.stringify(all));
  }catch(_){ /* Storage may be unavailable; the history still works in this tab. */ }
}
/** Switches to the history of the selected implementation. */
function useHistory(){
  const key=`${selectedStudent}/${structure}:${variant}`;
  if(key===historyKey)return;
  historyKey=key;
  const saved=storedHistories()[key];
  callHistory=Array.isArray(saved)?saved.filter(validCall).slice(-MAX_HISTORY):[];
  sequenceQueue=[];sequence=null;pendingRun=null;
  renderHistory();
}
function setHistory(calls){
  callHistory=calls.slice(-MAX_HISTORY);
  saveHistory();renderHistory();
}

function renderHistory(){
  const list=historyUI.list;
  list.replaceChildren();
  const count=callHistory.length;
  historyUI.title.textContent=count?`${count} call${count===1?'':'s'} since empty`:'History';
  historyUI.replay.disabled=!count;
  historyUI.copy.disabled=!count;
  if(!count){
    const empty=document.createElement('li');
    empty.className='history-empty';
    empty.textContent='Calls you run are listed here and come back after every save.';
    list.append(empty);
    return;
  }
  const hidden=Math.max(0,count-SHOWN_HISTORY);
  if(hidden){
    const more=document.createElement('li');
    more.className='history-more';
    more.textContent=`+${hidden} earlier`;
    more.title=callHistory.slice(0,hidden).map(formatCall).join('; ');
    list.append(more);
  }
  callHistory.slice(hidden).forEach((call,offset)=>{
    const index=hidden+offset;
    const item=document.createElement('li');
    const button=document.createElement('button');
    button.type='button';button.className='history-call';
    button.textContent=formatCall(call);
    button.title=index===count-1?'The latest call':
      `Rebuild the structure up to this call (drops the ${count-index-1} later call${count-index-1===1?'':'s'})`;
    button.disabled=index===count-1;
    button.addEventListener('click',()=>rebuildTo(index+1));
    item.append(button);list.append(item);
  });
}
function setRebuildAfterSave(enabled){
  rebuildAfterSave=enabled;
  historyUI.keep.classList.toggle('selected',enabled);
  historyUI.keep.setAttribute('aria-pressed',String(enabled));
  try{localStorage.setItem(rebuildStorageKey,enabled?'1':'0');}catch(_){}
}

// ------------------------------------------------------------ running calls
/**
 * Runs [calls] on the visualized structure, in requests of at most MAX_CALLS.
 * reset: start from an empty structure (a new history). done: a sentence
 * added to the status when the calls have run. replay: the calls are
 * the history itself and are not recorded again. showResult: jump to the
 * final state instead of playing the trace.
 */
function runCalls(calls,{reset=false,replay=false,showResult=false,focus=true,label=null,done=null}={}){
  if(!calls.length)return;
  const chunks=[];
  for(let i=0;i<calls.length;i+=MAX_CALLS)chunks.push(calls.slice(i,i+MAX_CALLS));
  sequence={total:calls.length,replay,showResult,label,focus,done};
  sequenceQueue=chunks.slice(1);
  sendChunk(chunks[0],reset);
}
function sendChunk(calls,reset){
  const options={focus:sequence?.focus??true};
  send(callsRequest(calls,{reset}),{...options,sequence:true});
  if(sequence?.label)ui.cmdStatus.textContent=sequence.label;
}
/** Called by send() for every request to the worker. */
function noteRequest(payload,{sequence:partOfSequence=false}={}){
  // Anything the student does by hand ends a running sequence.
  if(!partOfSequence){sequenceQueue=[];sequence=null;}
  if(payload.action==='reset'){pendingRun={calls:[],reset:true,replay:false};return;}
  if(payload.action!=='run'){pendingRun=null;return;}
  const calls=Array.isArray(payload.commands)?payload.commands.map(call=>({method:call.method,arguments:[...call.arguments]})):
    Array.isArray(payload.values)?payload.values.map(value=>({method:payload.method,arguments:[value]})):
    [{method:payload.method,arguments:[...(payload.arguments??[])]}];
  pendingRun={calls,reset:payload.reset===true,replay:sequence?.replay===true};
}
/** A trace or execution error arrived for the outstanding request. */
function settleRun(data){
  const run=pendingRun;pendingRun=null;
  if(!run)return;
  const error=data.type==='executionError';
  // An execution error reports the calls that completed before it.
  const completed=Number.isInteger(data.calls?.completed)?data.calls.completed:
    error?0:run.calls.length;
  const lastEnd=(data.steps??[]).findLast?.(step=>step.kind==='operationEnd');
  const failed=error||data.calls?.stoppedEarly===true||lastEnd?.ok===false;
  if(!run.replay){
    // Calls that ran changed the structure, also when their check failed.
    setHistory([...(run.reset?[]:callHistory),...run.calls.slice(0,completed)]);
  }
  if(sequenceQueue.length&&!failed&&completed===run.calls.length){
    sendChunk(sequenceQueue.shift(),false);
    return;
  }
  const finished=sequence;sequence=null;sequenceQueue=[];
  // A closing word after the trace's own status (e.g. a recreated test).
  if(finished?.done)ui.cmdStatus.textContent=`${ui.cmdStatus.textContent} ${finished.done}`;
  if(!finished?.replay)return;
  if(failed){
    rebuildSuspended=true;
    // Name the call: a recreated test fails here until the code is fixed.
    const failing=run.calls[Math.max(0,completed-(error?0:1))];
    ui.cmdStatus.textContent=`${failing?formatCall(failing):'A call'} ${error?'stopped with an error':'failed its check'}. `+
      'Fix the code and save to run it again, or Reset to start over.';
    ui.cmdStatus.classList.add('error');
    return;
  }
  ui.cmdStatus.classList.remove('error');
  ui.cmdStatus.textContent=`Rebuilt from your history: ${finished.total} call${finished.total===1?'':'s'}.`;
}
/** The host refused the request: nothing ran, and a sequence stops. */
function abandonRun(){pendingRun=null;sequenceQueue=[];sequence=null;}
/** A rebuild shows its final state instead of animating every call. */
function showsResultOnly(){return sequence?.showResult===true;}

/**
 * The structure has just started empty (first connection, a save, another
 * implementation, Restart). Rebuild it from its history. Focus stays where it
 * is, e.g. in the code editor after Ctrl+S.
 */
function rebuildAfterFreshStart(){
  useHistory();
  if(!rebuildAfterSave||rebuildSuspended||!callHistory.length)return false;
  runCalls(callHistory,{replay:true,showResult:true,focus:false,
    label:`Rebuilding your structure: ${callHistory.length} call${callHistory.length===1?'':'s'}…`});
  return true;
}
/** The student's code changed: a rebuild that failed may work now. */
function codeChanged(){rebuildSuspended=false;}
function rebuildTo(count){
  const calls=callHistory.slice(0,count);
  setHistory(calls);
  rebuildSuspended=false;
  runCalls(calls,{reset:true,replay:true,showResult:true,
    label:`Rebuilding up to call ${count}: ${formatCall(calls.at(-1))}…`});
}

historyUI.replay.addEventListener('click',()=>{
  if(!callHistory.length)return;
  rebuildSuspended=false;
  // Step mode at the start of the trace, so the student can watch it grow.
  runCalls(callHistory,{reset:true,replay:true,label:`Replaying ${callHistory.length} calls from empty…`});
});
historyUI.copy.addEventListener('click',()=>{
  ui.callInput.value=callHistory.map(formatCall).join('; ');
  updateCommandComposer();rememberCalls();
  ui.callInput.focus();
  ui.cmdStatus.classList.remove('error');
  ui.cmdStatus.textContent='Your history is in the Method calls field: edit it, then Reset and Run.';
});
historyUI.keep.addEventListener('click',()=>setRebuildAfterSave(!rebuildAfterSave));
try{setRebuildAfterSave(localStorage.getItem(rebuildStorageKey)!=='0');}catch(_){setRebuildAfterSave(true);}
renderHistory();
