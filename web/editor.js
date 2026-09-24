'use strict';
// A focused, dependency-free editor for the selected student Dart file.
// The server, not this client, chooses and validates the writable path.
(() => {
  const $ = id => document.getElementById(id);
  const edit = $('source-edit'), save = $('source-save'), discard = $('source-discard');
  const editor = $('source-editor'), view = $('code-scroll');
  const area = $('source-textarea'), gutter = $('source-line-numbers');
  const status = $('source-edit-status');
  let mode = false, loading = false, saving = false, dirty = false, revision = null;
  let original = '', selection = null;
  const locationKey = () => `${selectedStudent}/${structure}`;
  function updateLines() {
    const count = area.value.split('\n').length;
    if (gutter.dataset.count !== String(count)) {
      gutter.dataset.count = String(count);
      gutter.textContent = Array.from({length:count}, (_,i)=>String(i+1)).join('\n');
    }
  }
  function updateDirty() {
    dirty = area.value !== original;
    save.disabled = !dirty || loading || saving;
    status.textContent = dirty ? 'Unsaved changes · Ctrl+S to save' : 'Saved';
    updateLines();
  }
  function leave() {
    mode=false;loading=false;saving=false;
    view.hidden=false;editor.hidden=true;
    edit.hidden=false;edit.disabled=!selectedStudent||!structure;
    save.hidden=true;discard.hidden=true;status.hidden=true;
    area.value='';original='';revision=null;selection=null;dirty=false;
  }
  function canLeave() {
    return !dirty || window.confirm('Discard the unsaved changes to this Dart file?');
  }
  function insert(text, start, end=start) {
    area.setRangeText(text,start,end,'end');
    area.dispatchEvent(new Event('input', {bubbles:true}));
  }
  function begin() {
    if(mode||loading||!selectedStudent||!structure||!socket||socket.readyState!==WebSocket.OPEN)return;
    loading=true;edit.disabled=true;status.hidden=false;
    status.textContent='Loading the student file…';
    socket.send(JSON.stringify({action:'readSource'}));
  }
  function receive(message) {
    if(message.type==='sourceFile') {
      if(!loading||message.student!==selectedStudent||message.structure!==structure)return;
      loading=false;mode=true;selection=locationKey();
      revision=message.revision;original=message.content;area.value=original;
      view.hidden=true;editor.hidden=false;edit.hidden=true;
      save.hidden=false;discard.hidden=false;status.hidden=false;
      gutter.scrollTop=0;area.scrollTop=0;area.focus();updateDirty();
    } else if(message.type==='sourceSaved') {
      if(!saving||selection!==locationKey())return;
      saving=false;original=message.content;revision=message.revision;
      dirty=false;leave();
      ui.cmdStatus.textContent='Saved to the class repository · preparing Dart…';
    } else if(message.type==='sourceError') {
      loading=false;saving=false;edit.disabled=false;
      if(mode)save.disabled=false;
      status.hidden=false;status.textContent=message.message;
      status.classList.add('source-edit-error');
    }
  }
  function saveChanges() {
    if(!mode||!dirty||saving||!revision||selection!==locationKey()||
       !socket||socket.readyState!==WebSocket.OPEN)return;
    saving=true;save.disabled=true;status.classList.remove('source-edit-error');
    status.textContent='Saving…';
    socket.send(JSON.stringify({action:'saveSource',revision,content:area.value}));
  }
  edit.addEventListener('click',begin);
  save.addEventListener('click',saveChanges);
  discard.addEventListener('click',()=>{if(canLeave())leave();});
  area.addEventListener('input',()=>{status.classList.remove('source-edit-error');updateDirty();});
  area.addEventListener('scroll',()=>{gutter.scrollTop=area.scrollTop;});
  area.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){
      event.preventDefault();saveChanges();return;
    }
    if(event.key==='Tab'){
      event.preventDefault();
      const start=area.selectionStart,end=area.selectionEnd;
      if(event.shiftKey){
        const lineStart=area.value.lastIndexOf('\n',start-1)+1;
        const lead=/^ {1,2}/.exec(area.value.slice(lineStart))?.[0].length??0;
        if(lead){area.setRangeText('',lineStart,lineStart+lead,'preserve');
          area.selectionStart=Math.max(lineStart,start-lead);
          area.selectionEnd=Math.max(lineStart,end-lead);area.dispatchEvent(new Event('input'));}
      }else insert('  ',start,end);
    }else if(event.key==='Enter'){
      event.preventDefault();
      const start=area.selectionStart,end=area.selectionEnd;
      const before=area.value.slice(area.value.lastIndexOf('\n',start-1)+1,start);
      const indent=/^\s*/.exec(before)?.[0]??'';
      insert('\n'+indent+(before.trimEnd().endsWith('{')?'  ':''),start,end);
    }
  });
  document.addEventListener('keydown',event=>{
    if(!mode||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='s')return;
    event.preventDefault();saveChanges();
  });
  window.addEventListener('beforeunload',event=>{
    if(!dirty)return;
    event.preventDefault();event.returnValue='';
  });
  window.sandboxEditor={
    receive,canLeave,
    beforeSelection(){if(!canLeave())return false;leave();return true;},
    sourceChanged(){if(mode){status.hidden=false;
      status.textContent=dirty?'File changed outside this editor. Save will require resolving the conflict.':'File changed outside this editor; reopen Edit to load the new version.';
    }else if(loading){loading=false;edit.disabled=false;}},
    ready(){edit.disabled=false;},
    clear(){if(!mode)leave();else status.textContent='The selected file is no longer available. Your draft is still here.';},
  };
  leave();
})();
