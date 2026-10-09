'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('web/index.html','utf8');
const css=fs.readFileSync('web/style.css','utf8');

for(const dialog of ['validation','progress']){
  const markup=html.match(new RegExp(
    `<dialog[^>]+id="${dialog}-dialog"[\\s\\S]*?<\\/dialog>`,
  ));
  assert.ok(markup,`${dialog} dialog exists`);
  assert.match(markup[0],/class="app-dialog [^"]*dialog"/);

  const close=markup[0].match(new RegExp(
    `<button[^>]+id="${dialog}-close"[^>]*>([\\s\\S]*?)<\\/button>`,
  ));
  assert.ok(close,`${dialog} dialog has a close control`);
  assert.match(close[0],/class="icon-button dialog-close"/);
  assert.match(close[0],/aria-label="Close [^"]+"/);
  assert.match(close[0],/title="Close [^"]+"/);
  assert.match(close[1],/tabler-icons\.svg#ti-x/);
  assert.doesNotMatch(close[1],/Close/,'The top-right close control is icon-only.');

  assert.match(markup[0],/class="dialog-footer"/);
  assert.match(markup[0],/class="dialog-actions"/);
}

assert.match(css,/\.dialog-header \.dialog-close\{/);
assert.match(css,/\.dialog-actions\{[\s\S]*?justify-content:flex-end/);
assert.match(css,/\.dialog-primary-action\{[\s\S]*?background:#3776c7/);

console.log('PASS: dialogs share one header, icon close, and bottom-right action pattern.');
