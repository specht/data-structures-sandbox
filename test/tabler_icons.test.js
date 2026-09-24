'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('web/index.html');
const js = read('web/app.js');
const host = read('tool/host.dart');
const sprite = read('web/vendor/tabler-icons.svg');
assert.match(read('web/vendor/TABLER-LICENSE'), /MIT License/);
assert.match(host, /'\/vendor\/tabler-icons\.svg'=>'web\/vendor\/tabler-icons\.svg'/);
assert.match(host, /ContentType\('image','svg\+xml'\)/);
const defined = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...(`${html}\n${js}`).matchAll(/tabler-icons\.svg#(ti-[\w-]+)/g)].map(m => m[1]));
assert.ok(defined.size >= 15, 'The selected Tabler glyphs must be bundled locally.');
assert.ok(used.size >= 15, 'The controls must actually use the bundled icons.');
for (const name of used) assert.ok(defined.has(name), `Missing bundled icon ${name}`);
for (const id of ['retry', 'reset', 'validation-run', 'validation-close',
  'validation-rerun', 'source-edit', 'source-save', 'source-discard',
  'zoom-in', 'zoom-out', 'fit-scene', 'first', 'last', 'back', 'next']) {
  const button = html.match(new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/button>`));
  assert.ok(button, `Missing control ${id}`);
  assert.match(button[1], /<use href="\/vendor\/tabler-icons\.svg#ti-/,
    `${id} needs a Tabler icon`);
}
assert.match(js, /tabler-icons\.svg#ti-check/);
assert.match(js, /tabler-icons\.svg#ti-x/);
assert.doesNotMatch(html, /https?:\/\/[^"']*tabler-icons/, 'No third-party icon CDN at runtime.');
console.log('PASS: bundled Tabler sprite, license, server route and accessible icon controls.');
