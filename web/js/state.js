'use strict';
// Small SVG helpers and the connection/trace state shared by all scripts.
const svg = (name, attrs={}) => {
  const element = document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
  return element;
};
function showReturnValue(frame){
  // A failed check explains itself: the worker's message ends with the reason.
  const reason=frame.ok===false?/CHECK FAILED: (.*)$/.exec(frame.result??'')?.[1]??'':null;
  ui.description.hidden=!reason;
  ui.description.classList.toggle('check-failed',!!reason);
  ui.description.textContent=reason??'';
  const parts=[];
  if(!frame.returnedVoid){
    const arrow=svg('svg',{viewBox:'0 0 24 24',width:16,height:16,
      class:'ui-icon return-arrow','aria-hidden':'true'});
    arrow.append(svg('use',{href:'/vendor/tabler-icons.svg#ti-arrow-right'}));
    parts.push(arrow,document.createTextNode(Array.isArray(frame.value)?`[${frame.value.join(', ')}]`:String(frame.value)));
  }
  if(frame.ok===false){
    const failed=document.createElement('span');failed.className='check-failed-badge';
    failed.textContent='Check failed';parts.push(failed);
  }else if(frame.returnedVoid){
    const check=svg('svg',{viewBox:'0 0 24 24',width:16,height:16,
      class:'ui-icon completion-icon','aria-hidden':'true'});
    check.append(svg('use',{href:'/vendor/tabler-icons.svg#ti-check'}));
    parts.push(check,document.createTextNode('Completed'));
  }
  ui.returnValue.replaceChildren(...parts);
}
let socket = null, frames = [], rawSteps = [], source = null, stepIndex = 0;
let savedValues = null, savedSessionId = null, reconnectTimer = null, reconnectAttempt = 0, heartbeat = null;
let focusAfterCommand = false, commandTakesFocus = true, stopped = false;
let runtimeConsoleEntries=[],consoleExpanded=false;
