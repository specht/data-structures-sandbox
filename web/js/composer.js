'use strict';
// The free-form call composer (single calls and sequences).
function commandParts(text){
  const match=/^\s*([A-Za-z_]\w*)\s*\((.*)\)\s*;?\s*$/.exec(text);
  if(!match)throw Error('Enter a method call, e.g. contains(7) or push(5).');
  const descriptor=discovered.get(match[1]);
  if(!descriptor)throw Error(`Method ${match[1]} is not available for this structure.`);
  const raw=match[2].trim();
  const values=raw?JSON.parse(`[${raw}]`):[];
  const params=descriptor.params??[];
  if(values.length!==params.length)throw Error(`Expected ${params.length} arguments.`);
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
function commandRequest(text){
  const calls=splitCommandText(text);
  if(!calls.length)throw Error('Enter at least one method call.');
  if(calls.length>12)throw Error('Use at most 12 calls in one sequence.');
  const parsed=calls.map((call,index)=>{
    try{return commandParts(call);}catch(error){throw Error(`Call ${index+1}: ${error.message}`);}
  });
  if(parsed.length===1)return parsed[0];
  return {action:'run',commands:parsed.map(call=>({
    method:call.method,arguments:call.arguments,
  }))};
}
function updateCommandComposer(){
  let count=1;
  try{count=Math.max(1,splitCommandText(ui.callInput.value).length);}catch(_){
    count=Math.max(1,ui.callInput.value.split(/[;\n]/).filter(Boolean).length);
  }
  const lines=Math.max(1,ui.callInput.value.split('\n').length);
  ui.callInput.rows=Math.min(3,lines);
  ui.callForm.classList.toggle('has-multiline',lines>1);
  ui.sequenceCount.hidden=count<2;
  ui.sequenceCount.textContent=String(count);
  ui.callRunLabel.textContent=count>1?`Run ${count}`:'Run';
}
function setSequenceMode(enabled){
  sequenceMode=enabled;
  ui.sequenceMode.classList.toggle('selected',enabled);
  ui.sequenceMode.setAttribute('aria-pressed',String(enabled));
  ui.sequenceMode.title=enabled?
    'Suggestion buttons now add calls to the sequence':'Build a sequence by choosing method suggestions';
}
function appendSequenceCall(call){
  try{
    const current=ui.callInput.value.trim();
    if(current&&splitCommandText(current).length>=12)throw Error('Use at most 12 calls in one sequence.');
    ui.callInput.value=current?`${current.replace(/;\s*$/,'')}; ${call}`:call;
    updateCommandComposer();
    ui.callInput.focus();
  }catch(error){
    ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');
  }
}
ui.sequenceMode.addEventListener('click',()=>setSequenceMode(!sequenceMode));
ui.callInput.addEventListener('input',updateCommandComposer);
ui.callInput.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){
    event.preventDefault();ui.callForm.requestSubmit();
  }
});
ui.callForm.addEventListener('submit',event=>{
  event.preventDefault();
  try{send(commandRequest(ui.callInput.value));}catch(error){ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');}
});
