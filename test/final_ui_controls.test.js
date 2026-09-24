'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'web/style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
for(const [id,name] of [['back','Previous'],['next','Next']]){
  const button=html.match(new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/button>`));
  assert.ok(button,`${id} navigation button exists`);
  assert.match(button[0],new RegExp(`aria-label="${name} step"`));
  assert.match(button[1],/tabler-icons\.svg#ti-chevron-(left|right)/);
  assert.doesNotMatch(button[1],/Previous|Next/);
}
assert.match(css,/\.timeline \.playback-modes,\.timeline \.step-controls,\.timeline \.trace-settings\{/);
assert.match(css,/height:36px!important;min-height:36px/);
assert.match(css,/\.timeline \.trace-settings #trace-mode\{[\s\S]*?border:1px solid #3e577a/);
assert.match(css,/\.suggestion-rows \.call-suggestion\.has-present-argument\{[\s\S]*?background:#3c3157/);
assert.match(js,/button\.classList\.add\('has-present-argument'\)/);
assert.match(css,/\.operation-result strong,\.operation-result #return-value\{[\s\S]*?font-family:"0xProto Nerd Font"/);
console.log('PASS: compact icon navigation, equal heights, dropdown, existing-value contrast, matching mono fonts');
