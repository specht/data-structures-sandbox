'use strict';
// Small SVG helpers and the connection/trace state shared by all scripts.
const svg = (name, attrs={}) => {
  const element = document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
  return element;
};
function showReturnValue(frame){
  if(!frame.returnedVoid){
    const arrow=svg('svg',{viewBox:'0 0 24 24',width:16,height:16,
      class:'ui-icon return-arrow','aria-hidden':'true'});
    arrow.append(svg('use',{href:'/vendor/tabler-icons.svg#ti-arrow-right'}));
    ui.returnValue.replaceChildren(arrow,document.createTextNode(String(frame.value)));
    return;
  }
  if(frame.ok===false){ui.returnValue.textContent='Check failed';return;}
  const check=svg('svg',{viewBox:'0 0 24 24',width:16,height:16,
    class:'ui-icon completion-icon','aria-hidden':'true'});
  check.append(svg('use',{href:'/vendor/tabler-icons.svg#ti-check'}));
  ui.returnValue.replaceChildren(check,document.createTextNode('Completed'));
}
let socket = null, frames = [], rawSteps = [], source = null, stepIndex = 0;
let savedValues = null, savedSessionId = null, reconnectTimer = null, reconnectAttempt = 0, heartbeat = null;
let focusAfterCommand = false, stopped = false;
let runtimeConsoleEntries=[],consoleExpanded=false;
