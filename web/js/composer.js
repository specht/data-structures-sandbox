'use strict';
// The call composer: one call or a sequence (insert(1); insert(2); …).
//  - Enter runs, Shift+Enter starts a new line (also a call separator).
//  - The text is remembered per structure kind, so it survives reloads, saves
//    and switching between implementations (recursive vs iterative variants).
//  - Repeat: Run starts from an empty structure, and the calls run again by
//    themselves whenever the structure starts fresh (after a save, a switch
//    of implementation or Retry).
//  - Collect (or Shift+click on a suggestion) adds a suggestion to the text
//    instead of running it.
const MAX_CALLS=20;
const callsStorageKey='data-structure-sandbox.v1.calls';
const repeatStorageKey='data-structure-sandbox.v1.repeat';
let repeatCalls=false;
// The kind whose remembered text is in the input (see updateMethodCatalog).
let callsKind=null;

function commandParts(text){
  const match=/^\s*([A-Za-z_]\w*)\s*\((.*)\)\s*;?\s*$/.exec(text);
  if(!match)throw Error('Enter a method call, e.g. contains(7) or push(5).');
  const descriptor=discovered.get(match[1]);
  if(!descriptor)throw Error(`Method ${match[1]} is not available for this structure.`);
  const raw=match[2].trim();
  let values;
  try{values=raw?JSON.parse(`[${raw}]`):[];}
  catch(_){throw Error(`Check the arguments of ${match[1]}(…): use numbers, true/false or "text".`);}
  const params=descriptor.params??[];
  if(values.length!==params.length)throw Error(`${match[1]} expects ${params.length} argument${params.length===1?'':'s'}.`);
  const arguments_=values.map((value,i)=>{
    if(params[i].type==='int'&&(!Number.isSafeInteger(value)||Math.abs(value)>999))throw Error('Use integers from -999 to 999.');
    if(params[i].type==='bool'&&typeof value!=='boolean')throw Error('Use true or false.');
    if(params[i].type==='String'&&typeof value!=='string')throw Error('Use a quoted string.');
    if(params[i].type==='double'&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Use a finite number.');
    return value;
  });
  return {action:'run',method:match[1],arguments:arguments_};
}
function splitCommandText(text){
  const calls=[];
  let start=0,depth=0,quote=null,escaped=false;
  const flush=end=>{
    const call=text.slice(start,end).trim();
    if(call)calls.push(call);
    start=end+1;
  };
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(char==='\\'){escaped=true;continue;}
      if(char===quote)quote=null;
      continue;
    }
    if(char==='"'||char==="'"){quote=char;continue;}
    if(char==='('){depth++;continue;}
    if(char===')'){depth--;if(depth<0)throw Error('Unexpected closing parenthesis.');continue;}
    if(depth===0&&(char===';'||char==='\n'))flush(i);
  }
  if(quote)throw Error('Close the quoted string in the command list.');
  if(depth!==0)throw Error('Close every method-call parenthesis.');
  const tail=text.slice(start).trim();
  if(tail)calls.push(tail);
  return calls;
}
function commandRequest(text,{reset=false}={}){
  const calls=splitCommandText(text);
  if(!calls.length)throw Error('Enter at least one method call.');
  if(calls.length>MAX_CALLS)throw Error(`Use at most ${MAX_CALLS} calls in one run.`);
  const parsed=calls.map((call,index)=>{
    try{return commandParts(call);}catch(error){
      throw Error(calls.length>1?`Call ${index+1} (${call}): ${error.message}`:error.message);
    }
  });
  const request=parsed.length===1?parsed[0]:{action:'run',commands:parsed.map(call=>({
    method:call.method,arguments:call.arguments,
  }))};
  if(reset)request.reset=true;
  return request;
}

// ------------------------------------------------------------ remembering
function storedCalls(){
  try{
    const value=JSON.parse(localStorage.getItem(callsStorageKey)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch(_){return {};}
}
function savedCallsFor(kind){
  const text=storedCalls()[kind];
  return typeof text==='string'?text:null;
}
function rememberCalls(){
  if(!callsKind)return;
  try{
    const all=storedCalls();
    all[callsKind]=ui.callInput.value;
    localStorage.setItem(callsStorageKey,JSON.stringify(all));
  }catch(_){ /* Private windows may refuse storage; the input still works. */ }
}

// ------------------------------------------------------------ toolbar state
function updateCommandComposer(){
  let count=1;
  try{count=Math.max(1,splitCommandText(ui.callInput.value).length);}catch(_){
    count=Math.max(1,ui.callInput.value.split(/[;\n]/).filter(text=>text.trim()).length);
  }
  const lines=Math.max(1,ui.callInput.value.split('\n').length);
  ui.callInput.rows=Math.min(3,lines);
  ui.callForm.classList.toggle('has-multiline',lines>1);
  ui.callRunLabel.textContent=count>1?`Run ${count}`:'Run';
  ui.callRun.title=(repeatCalls?'Start from an empty structure, then run ':'Run ')+
    (count>1?`these ${count} calls`:'this call')+' (Enter)';
}
function setSequenceMode(enabled){
  sequenceMode=enabled;
  ui.sequenceMode.classList.toggle('selected',enabled);
  ui.sequenceMode.setAttribute('aria-pressed',String(enabled));
}
function setRepeatCalls(enabled,{remember=true}={}){
  repeatCalls=enabled;
  ui.repeatCalls.classList.toggle('selected',enabled);
  ui.repeatCalls.setAttribute('aria-pressed',String(enabled));
  if(remember){try{localStorage.setItem(repeatStorageKey,enabled?'1':'0');}catch(_){ }}
  updateCommandComposer();
}
function appendSequenceCall(call){
  try{
    const current=ui.callInput.value.trim();
    if(current&&splitCommandText(current).length>=MAX_CALLS)throw Error(`Use at most ${MAX_CALLS} calls in one run.`);
    ui.callInput.value=current?`${current.replace(/;\s*$/,'')}; ${call}`:call;
    updateCommandComposer();
    rememberCalls();
    ui.callInput.focus();
  }catch(error){
    ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');
  }
}
function runComposer(){
  try{
    const request=commandRequest(ui.callInput.value,{reset:repeatCalls});
    rememberCalls();
    if(repeatCalls)setRuntimeConsole([],null,{autoExpand:false});
    send(request);
  }catch(error){ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');}
}
/**
 * Called when the structure has just started empty (first connection, a
 * save, another implementation, Retry). With Repeat on, the remembered calls
 * run again. Focus stays where it is, e.g. in the code editor after Ctrl+S.
 */
function repeatAfterFreshStart(){
  if(!repeatCalls||!structure)return;
  const text=ui.callInput.value;
  if(!text.trim()||savedCallsFor(structure)!==text)return; // Only the student's own calls.
  let request;
  try{request=commandRequest(text);}catch(error){
    ui.cmdStatus.textContent=`Repeat skipped: ${error.message}`;ui.cmdStatus.classList.add('error');return;
  }
  send(request,{focus:false});
  ui.cmdStatus.textContent='Repeating your calls on the fresh structure…';
}

try{setRepeatCalls(localStorage.getItem(repeatStorageKey)==='1',{remember:false});}catch(_){ }
ui.sequenceMode.addEventListener('click',()=>setSequenceMode(!sequenceMode));
ui.repeatCalls.addEventListener('click',()=>setRepeatCalls(!repeatCalls));
ui.callInput.addEventListener('input',()=>{updateCommandComposer();rememberCalls();});
ui.callInput.addEventListener('keydown',event=>{
  if(event.key!=='Enter'||event.isComposing)return;
  // Shift+Enter: a new line, which also separates calls.
  if(event.shiftKey&&!(event.ctrlKey||event.metaKey))return;
  event.preventDefault();ui.callForm.requestSubmit();
});
ui.callForm.addEventListener('submit',event=>{
  event.preventDefault();
  runComposer();
});
