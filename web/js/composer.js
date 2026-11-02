'use strict';
// The call composer: one call or a sequence (insert(1); insert(2); …).
//  - Enter runs, Shift+Enter starts a new line (also a call separator).
//  - The text is remembered per structure kind, so it survives reloads, saves
//    and switching between implementations (recursive vs iterative variants).
//  - Shift+click on a suggestion adds that call to the text instead of
//    running it. Rebuilding a structure after a save is the call history's
//    job (history.js), not the field's.
// One request carries at most this many calls; longer sequences are split.
const MAX_CALLS=20;
const callsStorageKey='data-structure-sandbox.v1.calls';
// Older versions had a Repeat toggle; its key is removed.
const repeatStorageKey='data-structure-sandbox.v1.repeat';
// The kind whose remembered text is in the input (see updateMethodCatalog).
let callsKind=null;
const callClear=document.getElementById('call-clear');

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
/** The calls of [text] as {method, arguments}, validated against the catalog. */
function parseCalls(text){
  const calls=splitCommandText(text);
  if(!calls.length)throw Error('Enter at least one method call.');
  if(calls.length>MAX_HISTORY)throw Error(`Use at most ${MAX_HISTORY} calls at once.`);
  return calls.map((call,index)=>{
    try{const {method,arguments:args}=commandParts(call);return {method,arguments:args};}catch(error){
      throw Error(calls.length>1?`Call ${index+1} (${call}): ${error.message}`:error.message);
    }
  });
}
/** One worker request for at most MAX_CALLS calls. */
function callsRequest(calls,{reset=false}={}){
  const request=calls.length===1?{action:'run',method:calls[0].method,arguments:calls[0].arguments}:
    {action:'run',commands:calls.map(call=>({method:call.method,arguments:call.arguments}))};
  if(reset)request.reset=true;
  return request;
}
function commandRequest(text,options){
  const calls=parseCalls(text);
  if(calls.length>MAX_CALLS)throw Error(`Use at most ${MAX_CALLS} calls in one request.`);
  return callsRequest(calls,options);
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
  if(callClear)callClear.hidden=!ui.callInput.value.trim();
  ui.callRun.title=`Run ${count>1?`these ${count} calls`:'this call'} on the current structure (Enter)`;
}
function appendSequenceCall(call){
  try{
    const current=ui.callInput.value.trim();
    if(current&&splitCommandText(current).length>=MAX_HISTORY)throw Error(`Use at most ${MAX_HISTORY} calls at once.`);
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
    const calls=parseCalls(ui.callInput.value);
    rememberCalls();
    runCalls(calls);
  }catch(error){ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');}
}

function clearCalls(){
  ui.callInput.value='';
  updateCommandComposer();rememberCalls();
  ui.callInput.focus();
}
try{localStorage.removeItem(repeatStorageKey);}catch(_){ }
callClear?.addEventListener('click',clearCalls);
ui.callInput.addEventListener('input',()=>{updateCommandComposer();rememberCalls();});
ui.callInput.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&ui.callInput.value){event.preventDefault();clearCalls();return;}
  if(event.key!=='Enter'||event.isComposing)return;
  // Shift+Enter: a new line, which also separates calls.
  if(event.shiftKey&&!(event.ctrlKey||event.metaKey))return;
  event.preventDefault();ui.callForm.requestSubmit();
});
ui.callForm.addEventListener('submit',event=>{
  event.preventDefault();
  runComposer();
});
