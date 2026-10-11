'use strict';
// Element lookups shared by all scripts.
const $ = id => document.getElementById(id);
const ui = {
  code:$('code'), codeScroll:$('code-scroll'), file:$('filename'),
  operation:$('operation'), description:$('description'), phase:$('phase'),
  connection:$('connection'), status:$('scene-status'), result:$('result'),
  stepLabel:$('step-label'), seek:$('seek'), next:$('next'), back:$('back'),
  first:$('first'), last:$('last'), traceMode:$('trace-mode'),
  speed:$('speed'),speedOutput:$('speed-output'),compileSpinner:$('compile-spinner'),
  scene:$('scene'), edges:$('edges'), references:$('references'),
  nullRail:$('null-rail'), nodes:$('nodes'), form:$('invoke'), method:$('method'), values:$('values'),
  reset:$('reset'), suggestions:$('method-suggestions'), cmdStatus:$('command-status'), invoke:$('invoke-button'),
  singleArg:$('single-argument'), argLabel:$('arg-label'), multiArgs:$('multi-arguments'),
  zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),fitScene:$('fit-scene'),
  student:$('student'),structure:$('structure'),retry:$('retry'), callForm:$('call-form'),callInput:$('call-input'),returnValue:$('return-value'),stackView:$('stack-view'),
  sequenceMode:$('sequence-mode'),callRunLabel:$('call-run-label'),
  callRun:$('call-run'),repeatCalls:$('repeat-calls'),
  runtimeConsole:$('runtime-console'),consoleToggle:$('console-toggle'),
  consoleOutput:$('console-output'),consoleCount:$('console-count'),
  consoleContext:$('console-context'),consoleClear:$('console-clear'),
  playbackModes:[...document.querySelectorAll('[data-playback-mode]')],
};
