'use strict';
// WebSocket connection to the Dart host, with reconnection.
// The browser connection is not the Dart process. Workspace proxies may close
// idle WebSockets even while Dart keeps listening. Reconnect without discarding
// the student's saved list, trace, or current playback position.
function connect(){
  if(stopped)return;
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  ui.connection.textContent=reconnectAttempt?'Reconnecting…':'Connecting…';
  const ws=new WebSocket(`${protocol}//${location.host}/ws`);
  socket=ws;
  ws.addEventListener('open',()=>{
    reconnectAttempt=0;initializedCatalog=false;
    ui.connection.textContent='Connected';
    clearInterval(heartbeat);
    // Application-level heartbeats survive proxies that drop idle WS traffic.
    heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({action:'ping'}));},15000);
  });
  ws.addEventListener('message',msg=>{
    try{
      const data=JSON.parse(msg.data);
      if(data.type==='pong')return;
      if(data.type==='sourceFile'||data.type==='sourceSaved'||data.type==='sourceError'){
        window.sandboxEditor?.receive(data);return;
      }
      if(data.type==='sourceFormatted'||data.type==='sourceFormatError'){
        window.sandboxEditor?.receiveFormat(data);return;
      }
      if(data.type==='compileDiagnostics'){
        showCompiling(false);
        ui.connection.textContent='Compilation failed';
        window.sandboxEditor?.receiveDiagnostics(data);
        ui.cmdStatus.textContent='Compilation failed · select an error below the editor.';
        ui.cmdStatus.classList.add('error');return;
      }
      if(data.type.startsWith('progress')){progressMessage(data);return;}
      if(data.type.startsWith('validation')){validationMessage(data);return;}
      if(data.type==='catalog'){receiveCatalog(data);return;}
      if(data.type==='building'||data.type==='sourceChanged'){
        if(data.type==='sourceChanged')window.sandboxEditor?.sourceChanged();
        resetValidation('Implementation changed; previous test results are outdated.');
        showCompiling(data.type==='building'&&data.recompiling===true);
        ui.cmdStatus.textContent=data.message+' Previous trace may be out of date.';
        ui.connection.textContent=data.type==='building'&&data.recompiling===true?
          'Recompiling…':'Starting…';return;
      }
      if(data.type==='executionError'){
        acceptExecutionError(data);return;
      }
      if(data.type==='workerIdle'||data.type==='workerResuming'){
        // The host paused the Dart process of this tab (or is resuming it).
        // The structure's contents are restored on the next call.
        ui.connection.textContent=data.type==='workerIdle'?'Paused':'Resuming…';
        ui.cmdStatus.classList.remove('error');
        ui.cmdStatus.textContent=data.message;return;
      }
      if(data.type==='error'){
        showCompiling(false);
        focusAfterCommand=false;ui.cmdStatus.textContent=data.message;ui.cmdStatus.classList.add('error');return;
      }
      if(data.type==='hello'){
        window.sandboxEditor?.compiled();
        window.sandboxEditor?.ready();
        validationUI.button.disabled=false;
        validationUI.rerun.disabled=false;
        showCompiling(false);
        const initial=data.trace;
        if(data.student)selectedStudent=data.student;
        if(typeof data.variant==='string')variant=data.variant;
        rememberChoice();
        restoreValidation(data.validationRevision);
        if(savedValues===null){acceptTrace(initial);repeatAfterFreshStart();return;}
        if(savedSessionId===(initial.sessionId??null) && JSON.stringify(savedValues)===JSON.stringify(initial.values)){
          ui.connection.textContent='Connected';return;
        }
        acceptTrace(initial);
        ui.cmdStatus.textContent='Session restarted; current list has been reset.';
        repeatAfterFreshStart();
        return;
      }
      if(data.type==='trace')acceptTrace(data);
    }catch(error){ui.cmdStatus.textContent=`Invalid response: ${error.message}`;
      ui.cmdStatus.classList.add('error');console.error(error);}
  });
  ws.addEventListener('close',event=>{
    if(socket!==ws)return;
    clearInterval(heartbeat);heartbeat=null;
    socket=null;
    window.sandboxEditor?.connectionLost();
    if(stopped)return;
    showCompiling(false);
    resetValidation('Connection lost; run the tests again after reconnecting.');
    ui.connection.textContent='Connection lost · reconnecting…';
    console.warn('WebSocket closed',event.code,event.reason||'');
    const delay=Math.min(5000,400*Math.pow(1.8,reconnectAttempt++));
    clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,delay);
  });
  ws.addEventListener('error',()=>{
    showCompiling(false);
    if(socket===ws)ui.connection.textContent='Connection interrupted…';
    // The `close` handler performs the actual reconnection.
  });
}
window.addEventListener('beforeunload',()=>{stopped=true;clearTimeout(reconnectTimer);clearInterval(heartbeat);});
