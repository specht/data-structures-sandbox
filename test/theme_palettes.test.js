// Color themes: four per mode from themes.css, chosen with swatches and kept
// per mode in this browser; a swatch of the other mode also switches mode.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');

const root = path.join(__dirname, '..');
const themesCss = fs.readFileSync(path.join(root, 'web/themes.css'), 'utf8');
const list = mode => /--themes-(\w+):"([^"]*)"/g;
const lists = {};
for (const [, mode, value] of themesCss.matchAll(list())) lists[mode] = value;
for (const mode of ['dark', 'light']) {
  assert.equal(lists[mode].split(',').length, 4, `Four ${mode} themes`);
  for (const entry of lists[mode].split(',')) {
    const id = entry.split(':')[0];
    assert.match(themesCss, new RegExp(`\\[data-swatch-mode="${mode}"\\]\\[data-swatch="${id}"\\]\\{--swatch-panel`),
      `${mode}/${id} has swatch colors`);
  }
}
// Every non-default theme covers the hot node (a scoped theme must repeat
// the specific rules, or its general .node .card rule would win).
for (const [mode, ids] of [['dark', ['tars', 'wopr', 'clemenza']],
  ['light', ['shermer', 'kellermans', 'hallorann', 'toxie']]]) {
  for (const id of ids) {
    assert.ok(themesCss.includes(`:root[data-theme="${mode}"][data-palette="${id}"] .node.hot .card`),
      `${mode}/${id} styles the hot node`);
  }
}
// themes.css is generated: it matches a fresh run of the generator.
const fresh = path.join(require('node:os').tmpdir(), `themes-${process.pid}.css`);
execFileSync(process.execPath, [path.join(root, 'tool/themes.mjs'), path.join(root, 'web/style.css'), fresh]);
assert.equal(fs.readFileSync(fresh, 'utf8'), themesCss, 'web/themes.css is up to date (run tool/themes.mjs)');
fs.unlinkSync(fresh);

class Element {
  constructor(id) {
    this.id = id; this.children = []; this.attrs = {}; this.dataset = {}; this.hidden = id === 'palette-menu';
    this.listeners = {}; this.textContent = ''; this.title = '';
    const classes = new Set();
    this.classList = {add: c => classes.add(c), remove: c => classes.delete(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: c => classes.has(c)};
  }
  set className(value) { this._class = value; }
  get className() { return this._class; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  focus() {}
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const cls = selector.replace(/^\./, '').split(/[.\s]/)[0];
    const found = [];
    const visit = node => { for (const child of node.children ?? []) {
      if (child._class?.split(' ').includes(cls)) found.push(child); visit(child); } };
    visit(this);
    return found;
  }
}
const elements = new Map();
const byId = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
const toggle = byId('palette-toggle');
const dot = new Element('dot'); dot._class = 'palette-swatch-dot'; toggle.append(dot);
const html = {dataset: {theme: 'dark'}};
const storage = new Map(), puts = [];
const context = vm.createContext({
  document: {documentElement: html, readyState: 'complete', getElementById: byId,
    createElement: () => new Element(), addEventListener() {}},
  getComputedStyle: () => ({getPropertyValue: name => `"${lists[name.replace('--themes-', '')]}"`}),
  localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v))},
  fetch: (url, options) => { puts.push(JSON.parse(options.body)); return Promise.resolve(); },
  window: {dispatchEvent() {}}, CustomEvent: class { constructor(type, init) { this.detail = init?.detail; } },
});
vm.runInContext(fs.readFileSync(path.join(root, 'web/js/theme.js'), 'utf8'), context);

assert.equal(html.dataset.palette, 'silencio', 'The first dark theme is the default');
const menu = byId('palette-menu');
const swatches = menu.querySelectorAll('.palette-swatch');
assert.equal(swatches.length, 8, 'Four swatches per mode');
const swatch = (mode, id) => swatches.find(s => s.dataset.swatchMode === mode && s.dataset.swatch === id);
assert.equal(swatch('dark', 'silencio').getAttribute('aria-checked'), 'true');
assert.equal(swatch('light', 'kellermans').querySelector('.palette-name').textContent, "Kellerman's",
  'Labels keep their punctuation');

swatch('dark', 'wopr').listeners.click();
assert.equal(html.dataset.palette, 'wopr');
assert.deepEqual(JSON.parse(storage.get('data-structure-sandbox.v1.palette')), {dark: 'wopr'});
assert.equal(puts.length, 0, 'A theme of the current mode does not touch the shared settings');
assert.equal(dot.dataset.swatch, 'wopr', 'The toggle shows the chosen theme');
assert.match(toggle.title, /^Theme: WOPR \(dark\)/);

swatch('light', 'toxie').listeners.click();
assert.equal(html.dataset.theme, 'light', 'A light swatch switches to the light mode');
assert.equal(html.dataset.palette, 'toxie');
assert.deepEqual(puts.at(-1), {theme: 'light'});
// The next page load in dark mode brings back the dark choice.
html.dataset.theme = 'dark';
vm.runInContext(fs.readFileSync(path.join(root, 'web/js/theme.js'), 'utf8'), context);
assert.equal(html.dataset.palette, 'wopr', 'Each mode keeps its own theme');
// In every theme, a suggestion whose argument is already stored (violet in
// the default theme) stays clearly distinct from an ordinary suggestion.
(async () => {
  const {themeColor, THEMES} = await import('../tool/themes.mjs');
  const {toOklab} = await import('../tool/light-theme.mjs');
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const distance = (x, y) => { const [a, b] = [toOklab(x), toOklab(y)]; return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
  // The default theme TARS is the reference: every theme keeps at least 85%
  // of its separation, for background and border alike.
  const pairs = [['background', '#203348', '#3c3157'], ['border-color', '#385671', '#ab91e6']];
  const separation = (mode, theme, [property, plain, present]) =>
    distance(themeColor(rgb(plain), mode, theme, property), themeColor(rgb(present), mode, theme, property));
  for (const [mode, list] of Object.entries(THEMES)) {
    for (const theme of list) {
      for (const pair of pairs) {
        const d = separation(mode, theme, pair), reference = separation(mode, {}, pair);
        assert.ok(d >= reference * 0.85,
          `${mode}/${theme.id}: "already stored" ${pair[0]} too close to a plain suggestion (${d.toFixed(3)} < ${reference.toFixed(3)})`);
      }
    }
  }
  console.log('PASS: four color themes per mode, chosen with swatches and kept per mode.');
})();
