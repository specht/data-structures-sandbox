// Shared helpers for the Node.js browser tests: the app's scripts in the order
// index.html loads them, and a minimal fake DOM to run them in.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..', '..');

/** Paths (relative to web/) of the app scripts, in index.html order. */
function appFiles({editor = false} = {}) {
  const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
  return [...html.matchAll(/<script src="\/(js\/[a-z0-9-]+\.js)"/g)]
    .map(match => match[1])
    .filter(file => editor || file !== 'js/editor.js');
}

/** All app scripts as one string, for tests that only inspect the source. */
function appSource(options) {
  return appFiles(options)
    .map(file => fs.readFileSync(path.join(root, 'web', file), 'utf8'))
    .join('\n');
}

/**
 * Runs the scripts one after another in [context], like classic scripts in
 * a page: they share top-level declarations, and a script that uses a later
 * script's binding while loading fails here as it would in the browser.
 */
function loadApp(context, options) {
  for (const file of appFiles(options)) {
    vm.runInContext(fs.readFileSync(path.join(root, 'web', file), 'utf8'), context,
      {filename: `web/${file}`});
  }
  return context;
}

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.attrs = {};
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.classList = {
      add: name => this._setClass(name, true),
      remove: name => this._setClass(name, false),
      toggle: (name, on) => this._setClass(name, on),
      contains: name => (this.attrs.class || '').split(' ').includes(name),
    };
  }
  _setClass(name, on) {
    const classes = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
    if (on) classes.add(name); else classes.delete(name);
    this.attrs.class = [...classes].join(' ');
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  append(...parts) { this.children.push(...parts); }
  appendChild(part) { this.children.push(part); return part; }
  replaceChildren(...parts) { this.children = parts; }
  remove() { this.removed = true; }
  addEventListener() {}
  focus() {}
  querySelectorAll(selector) {
    const result = [];
    const matching = child => selector.startsWith('.') &&
      child.classList?.contains(selector.slice(1));
    const walk = e => { for (const c of e.children || []) {
      if (matching(c)) result.push(c);
      walk(c);
    }};
    walk(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

/** A fake page whose elements are created on first lookup by id. */
function fakeBrowser(globals = {}) {
  const ids = new Map();
  const document = {
    getElementById: id => {
      if (!ids.has(id)) ids.set(id, new Element(id));
      return ids.get(id);
    },
    createElementNS: (_, tag) => new Element(tag),
    createElement: tag => new Element(tag),
    createTextNode: text => ({textContent: text}),
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  const context = vm.createContext({
    document, console, location: {protocol: 'http:', host: 'localhost:8081'},
    window: {addEventListener() {}},
    clearInterval: () => {}, setInterval: () => 0, clearTimeout: () => {}, setTimeout: () => 0,
    WebSocket: class { static OPEN = 1; addEventListener() {} send() {} },
    performance: {now: () => 0}, requestAnimationFrame: () => {},
    HTMLInputElement: class {}, HTMLTextAreaElement: class {},
    HTMLSelectElement: class {}, HTMLButtonElement: class {},
    ...globals,
  });
  return {context, document, ids, Element, run: source => vm.runInContext(source, context)};
}

module.exports = {root, appFiles, appSource, loadApp, fakeBrowser, Element};
