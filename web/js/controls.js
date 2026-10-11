'use strict';
// Scene controls (zoom, pan) and the student / structure pickers.
// The four trace-navigation buttons form one semantic and visual group.
// Moving their existing DOM nodes preserves their listeners and shortcuts.
if(ui.first.parentNode){
  const navigation=document.createElement('div');
  navigation.className='step-controls';
  navigation.setAttribute('role','group');
  navigation.setAttribute('aria-label','Trace navigation');
  ui.first.parentNode.insertBefore(navigation,ui.first);
  navigation.append(ui.first,ui.back,ui.next,ui.last);
}
// Animate button-driven camera moves; wheel and pointer dragging stay direct.
ui.zoomIn.addEventListener('click',()=>animateCamera(()=>zoomScene(1/1.35)));
ui.zoomOut.addEventListener('click',()=>animateCamera(()=>zoomScene(1.35)));
ui.fitScene.addEventListener('click',()=>animateCamera(fitScene));
ui.scene.addEventListener('wheel',event=>{
  event.preventDefault();
  cameraAnimationId++;
  zoomScene(event.deltaY>0?1.12:1/1.12,event.clientX,event.clientY);
},{passive:false});
let dragging=null;
ui.scene.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  cameraAnimationId++;
  dragging={id:event.pointerId,x:event.clientX,y:event.clientY};
  ui.scene.setPointerCapture?.(event.pointerId);
});
ui.scene.addEventListener('pointermove',event=>{
  if(!dragging||event.pointerId!==dragging.id)return;
  const rect=ui.scene.getBoundingClientRect();
  if(rect.width>0&&rect.height>0){
    cameraMode='manual';
    viewport.x-=(event.clientX-dragging.x)*viewport.w/rect.width;
    viewport.y-=(event.clientY-dragging.y)*viewport.h/rect.height;
    paintViewport();
  }
  dragging.x=event.clientX;dragging.y=event.clientY;
});
function finishPan(event){
  if(dragging?.id===event.pointerId){dragging=null;ui.scene.releasePointerCapture?.(event.pointerId);}
}
ui.scene.addEventListener('pointerup',finishPan);
ui.scene.addEventListener('pointercancel',finishPan);
ui.retry.addEventListener('click',()=>{
  // Restarting the same implementation must not discard an unsaved draft.
  savedValues=null;selectImplementation();
});
ui.student.addEventListener('change',()=>{
  if(window.sandboxEditor && !window.sandboxEditor.beforeSelection()){
    ui.student.value=selectedStudent;return;
  }
  selectedStudent=ui.student.value;
  updateStructures();
  animationGeneration++;animating=false;playbackToken++;frames=[];rawSteps=[];savedValues=null;
  clearView();sync();selectImplementation();
});
ui.structure.addEventListener('change',()=>{
  if(window.sandboxEditor && !window.sandboxEditor.beforeSelection()){
    ui.structure.value=implementationValue();return;
  }
  ({kind:structure,variant}=parseImplementation(ui.structure.value));
  animationGeneration++;animating=false;playbackToken++;frames=[];rawSteps=[];savedValues=null;
  clearView();sync();ui.cmdStatus.textContent='Switching structure…';
  selectImplementation();
});
