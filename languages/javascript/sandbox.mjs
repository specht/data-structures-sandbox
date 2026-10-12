// Observable storage for the Data Structure Sandbox (JavaScript version).
//
// These classes are storage, not solutions: students implement their data
// structures in their own `My…` classes and use these building blocks.
//
//   import { FixedMemory, ListMemory, QueueMemory, HeapMemory,
//            ListNode, TreeNode, HashBuckets } from "sandbox";
//
// The recorders below mirror lib/*_sandbox.dart of the Dart version event by
// event, so the browser receives the same traces from every language.

export const MAX_EVENTS = 4000;

export class TraceLimitReached extends Error {
  constructor() {
    super(`Trace limit reached (${MAX_EVENTS} events).`);
    this.name = 'TraceLimitReached';
  }
}

/** The last traced line (for timeouts, errors and progress messages). */
export const Diagnostics = {
  currentLine: null,
  currentTraceIndex: null,
  onLine: null,
  reset() {
    this.currentLine = null;
    this.currentTraceIndex = null;
  },
  atLine(line, traceIndex) {
    this.currentLine = line;
    this.currentTraceIndex = traceIndex;
    this.onLine?.(line, traceIndex);
  },
};

/** A bounded trace: a runaway loop cannot exhaust the browser. */
class EventLog extends Array {
  static get [Symbol.species]() { return Array; }
  add(event) {
    if (event.kind === 'line' && Number.isInteger(event.line)) Diagnostics.atLine(event.line, this.length);
    if (this.length >= MAX_EVENTS) throw new TraceLimitReached();
    this.push(event);
  }
}

let active = null;
export const activeRecorder = () => active;
export const setActive = recorder => { active = recorder; };

const describe = value => (value === null ? 'null' : value === undefined ? 'undefined'
  : typeof value === 'object' ? value.constructor?.name ?? 'an object' : `a ${typeof value}`);

function checkIndex(cells, raw, what) {
  const index = Number(raw);
  if (!Number.isInteger(index)) throw new TypeError(`Indices must be integers, not ${raw}.`);
  if (index < 0 || index >= cells.length) {
    const valid = cells.length === 0 ? 'it is empty' : `valid: 0 … ${cells.length - 1}`;
    throw new RangeError(`Index ${index} is out of range for ${what} (${valid}).`);
  }
  return index;
}

const isInt = value => Number.isInteger(value);
function checkCell(value) {
  if (value !== null && !isInt(value)) throw new TypeError(`A cell holds an integer or null, not ${describe(value)}.`);
  return value;
}

const INDEX = /^-?\d+(?:\.\d+)?$/;

/** Makes obj[i] and obj[i] = v call read/write; everything else is obj's own. */
function indexed(target, read, write) {
  return new Proxy(target, {
    get(object, property, receiver) {
      if (typeof property === 'string' && INDEX.test(property)) return read(property);
      return Reflect.get(object, property, object);
    },
    set(object, property, value) {
      if (typeof property === 'string' && INDEX.test(property)) {
        write(property, value);
        return true;
      }
      return Reflect.set(object, property, value, object);
    },
  });
}

// ------------------------------------------------------------ fixed memories

class Cells {
  constructor(capacity, recorderClass) {
    if (!isInt(capacity) || capacity <= 0) throw new RangeError('The capacity must be a positive integer.');
    this._cells = new Array(capacity).fill(null);
    this._recorderClass = recorderClass;
    return indexed(this,
      raw => this._cells[checkIndex(this._cells, raw, 'memory')],
      (raw, value) => {
        const index = checkIndex(this._cells, raw, 'memory');
        checkCell(value);
        const before = this._cells[index];
        this._cells[index] = value;
        if (active instanceof this._recorderClass()) active.cellWrite(index, before, value);
      });
  }

  /** The number of physical cells. */
  get length() { return this._cells.length; }
  copy() { return [...this._cells]; }
  toString() { return `${this.constructor.name}(${this._cells.length})`; }
}

/** Fixed cells for an array stack: memory[i], memory[i] = value or null. */
export class FixedMemory extends Cells {
  constructor(capacity) { super(capacity, () => StackRecorder); }
}

/** Fixed cells for the array lists; the list class owns its `size`. */
export class ListMemory extends Cells {
  constructor(capacity) { super(capacity, () => ListRecorder); }
}

/** Fixed cells plus the observable circular-queue markers front, rear (the
 *  NEXT free slot) and size. */
export class QueueMemory extends Cells {
  constructor(capacity) {
    const proxy = super(capacity, () => QueueRecorder);
    this._front = 0;
    this._rear = 0;
    this._size = 0;
    return proxy;
  }

  _marker(name, value) {
    if (!isInt(value)) throw new TypeError(`${name} must be an integer.`);
    const before = this[`_${name}`];
    this[`_${name}`] = value;
    if (active instanceof QueueRecorder) active.indexWrite(name, before, value);
  }

  get front() { return this._front; }
  set front(value) { this._marker('front', value); }
  get rear() { return this._rear; }
  set rear(value) { this._marker('rear', value); }
  get size() { return this._size; }
  set size(value) { this._marker('size', value); }
}

/** Contiguous, growing storage for an array heap: children of index i live
 *  at 2*i+1 and 2*i+2; there are no node objects. */
export class HeapMemory {
  constructor() {
    this._cells = [];
    return indexed(this,
      raw => {
        const index = checkIndex(this._cells, raw, 'the heap');
        const value = this._cells[index];
        if (active instanceof HeapRecorder) active.read(index, value);
        return value;
      },
      (raw, value) => {
        const index = checkIndex(this._cells, raw, 'the heap');
        if (!isInt(value)) throw new TypeError(`A heap cell holds an integer, not ${describe(value)}.`);
        const before = this._cells[index];
        this._cells[index] = value;
        if (active instanceof HeapRecorder) active.change('heapWrite', {index, oldValue: before, value});
      });
  }

  get length() { return this._cells.length; }
  get isEmpty() { return this._cells.length === 0; }

  add(value) {
    if (!isInt(value)) throw new TypeError(`A heap cell holds an integer, not ${describe(value)}.`);
    this._cells.push(value);
    if (active instanceof HeapRecorder) active.change('heapAppend', {index: this._cells.length - 1, value});
  }

  removeLast() {
    if (this._cells.length === 0) throw new RangeError('removeLast() on an empty heap.');
    const index = this._cells.length - 1;
    const value = this._cells.pop();
    if (active instanceof HeapRecorder) active.change('heapRemove', {index, value});
    return value;
  }

  swap(a, b) {
    a = checkIndex(this._cells, a, 'the heap');
    b = checkIndex(this._cells, b, 'the heap');
    if (a === b) return;
    const oldA = this._cells[a], oldB = this._cells[b];
    this._cells[a] = oldB;
    this._cells[b] = oldA;
    if (active instanceof HeapRecorder) active.change('heapSwap', {a, b, oldA, oldB});
  }

  copy() { return [...this._cells]; }
  toString() { return `HeapMemory(${this._cells.length})`; }
}

export function heapOrderValid(values) {
  for (let i = 1; i < values.length; i++) if (values[(i - 1) >> 1] > values[i]) return false;
  return true;
}

// --------------------------------------------------------------------- nodes

/** A node of a singly linked chain: node.value and node.next. */
export class ListNode {
  static _nextId = 0;
  static registry = new Map();
  static resetIds() { ListNode._nextId = 0; ListNode.registry.clear(); }

  constructor(value) {
    if (!isInt(value)) throw new TypeError(`A ListNode holds an integer, not ${describe(value)}.`);
    this._id = ++ListNode._nextId;
    this._value = value;
    this._next = null;
    if (active instanceof Recorder) active.createNode(this);
  }

  get id() { return this._id; }
  get value() {
    if (active instanceof Recorder) active.visit(this);
    return this._value;
  }
  set value(value) {
    if (!isInt(value)) throw new TypeError(`A ListNode holds an integer, not ${describe(value)}.`);
    this._value = value;
  }
  get next() { return this._next; }
  set next(target) {
    if (target !== null && !(target instanceof ListNode)) {
      throw new TypeError(`next must be a ListNode or null, not ${describe(target)}.`);
    }
    const before = this._next;
    this._next = target;
    if (active instanceof Recorder) active.pointerWrite(`node:${this._id}.next`, before, target);
  }
  toString() { return `ListNode(${this._value})`; }
}

/** A binary tree node: value, left, right and height (a leaf has height 1). */
export class TreeNode {
  static _nextId = 0;
  static registry = new Map();
  static resetIds() { TreeNode._nextId = 0; TreeNode.registry.clear(); }

  constructor(value) {
    if (!isInt(value)) throw new TypeError(`A TreeNode holds an integer, not ${describe(value)}.`);
    this._id = ++TreeNode._nextId;
    this._value = value;
    this._height = 1;
    this._left = null;
    this._right = null;
    if (active instanceof TreeRecorder) active.createNode(this);
  }

  get id() { return this._id; }
  get value() {
    if (active instanceof TreeRecorder) active.visit(this);
    return this._value;
  }
  set value(value) {
    if (!isInt(value)) throw new TypeError(`A TreeNode holds an integer, not ${describe(value)}.`);
    this._value = value;
    if (active instanceof TreeRecorder) active.valueWrite(this);
  }
  get height() { return this._height; }
  set height(value) {
    if (!isInt(value)) throw new TypeError(`height must be an integer, not ${describe(value)}.`);
    const before = this._height;
    this._height = value;
    if (active instanceof TreeRecorder) active.heightWrite(this, before, value);
  }
  _link(side, target) {
    if (target !== null && !(target instanceof TreeNode)) {
      throw new TypeError(`${side} must be a TreeNode or null, not ${describe(target)}.`);
    }
    const before = this[`_${side}`];
    this[`_${side}`] = target;
    if (active instanceof TreeRecorder) active.pointerWrite(`node:${this._id}.${side}`, before, target);
  }
  get left() { return this._left; }
  set left(target) { this._link('left', target); }
  get right() { return this._right; }
  set right(target) { this._link('right', target); }
  toString() { return `TreeNode(${this._value})`; }
}

/** The buckets of a hash table with separate chaining. The student chooses
 *  the bucket count and the hash function hash(key, capacity) -> index. */
export class HashBuckets {
  constructor(capacity, hash) {
    if (!isInt(capacity) || capacity < 1) throw new RangeError('A hash table needs at least one bucket.');
    if (typeof hash !== 'function') throw new TypeError('The second argument must be the hash function.');
    this._cells = new Array(capacity).fill(null);
    this._hash = hash;
    return indexed(this,
      raw => {
        const index = checkIndex(this._cells, raw, 'the buckets');
        const value = this._cells[index];
        if (active instanceof HashRecorder) active.bucketRead(index, value);
        return value;
      },
      (raw, value) => {
        const index = checkIndex(this._cells, raw, 'the buckets');
        if (value !== null && !(value instanceof ListNode)) {
          throw new TypeError(`A bucket holds a ListNode or null, not ${describe(value)}.`);
        }
        const before = this._cells[index];
        this._cells[index] = value;
        if (active instanceof HashRecorder) active.bucketWrite(index, before, value);
      });
  }

  get length() { return this._cells.length; }

  indexFor(key) {
    const index = this._hash(key, this._cells.length);
    if (!isInt(index) || index < 0 || index >= this._cells.length) {
      throw new RangeError(`hash(${key}) returned ${index}; the student hash function must return a valid ` +
        `bucket index 0 … ${this._cells.length - 1}.`);
    }
    return index;
  }

  get heads() { return [...this._cells]; }
  toString() { return `HashBuckets(${this._cells.length})`; }
}

const idOf = node => (node === null || node === undefined ? null : node._id);

/** Dart's toString for values in messages: null, true, 0.5, 1.0 for doubles. */
export function show(value) {
  if (value === null || value === undefined) return 'null';
  return String(value);
}

// ----------------------------------------------------------------- recorders

class Base {
  constructor({silent = false} = {}) {
    this.steps = new EventLog();
    if (silent) this.steps.add = () => {};
    this.sourceLine = 0;
  }
  atLine(line) {
    this.sourceLine = line;
    this.steps.add({kind: 'line', line});
  }
  begin(name, args) {
    this.steps.add({kind: 'operationStart', operation: `${name}(${args.map(show).join(', ')})`, line: 0});
  }
  indexWrite(name, before, after) {
    this.steps.add({kind: 'indexWrite', name, oldValue: before, value: after, line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  end(value, ok, returnedVoid = false, message = null) {
    this.steps.add({kind: 'operationEnd', value, returnedVoid, ok,
      result: message ?? `Result: ${show(value)}`, line: 0});
  }
}

/** Linked chains (lists, linked stack and queue): lib/sandbox.dart. */
export class Recorder extends Base {
  constructor(options) {
    super(options);
    this.root = null;
    this.tail = null;
    this.size = null;
  }
  begin(name, args, line = 0) {
    this.sourceLine = line;
    this.steps.add({kind: 'operationStart', operation: `${name}(${args.map(show).join(', ')})`,
      description: 'Executing the student method.', line});
  }
  reference(name, node) {
    this.steps.add({kind: 'variableWrite', name, to: idOf(node), line: this.sourceLine});
  }
  visit(node) { this.steps.add({kind: 'visit', id: node._id, line: this.sourceLine}); }
  createNode(node) {
    ListNode.registry.set(node._id, node);
    this.steps.add({kind: 'createNode', node: {id: node._id, value: node._value, next: null}, line: this.sourceLine});
  }
  pointerWrite(from, before, after) {
    this.steps.add({kind: 'pointerWrite', from, oldTo: idOf(before), to: idOf(after), line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    const result = {kind: 'snapshot', head: idOf(this.root?.())};
    if (this.tail) result.tail = idOf(this.tail());
    if (this.size) result.size = this.size();
    result.nodes = [...ListNode.registry.values()].map(node => ({id: node._id, value: node._value, next: idOf(node._next)}));
    return result;
  }
  alive() {
    const alive = new Set();
    let cursor = this.root?.() ?? null;
    while (cursor !== null && !alive.has(cursor._id)) {
      alive.add(cursor._id);
      cursor = cursor._next;
    }
    return alive;
  }
  end(value, ok, returnedVoid = false, message = null) {
    this.steps.add({kind: 'localsClear', line: this.sourceLine});
    const alive = this.alive();
    const retired = [...ListNode.registry.keys()].filter(id => !alive.has(id));
    if (retired.length) {
      this.steps.add({kind: 'retire', ids: retired, line: 0});
      for (const id of retired) ListNode.registry.delete(id);
      this.steps.add(this.snapshot());
    }
    this.steps.add({kind: 'operationEnd', ok, value, returnedVoid,
      result: message ?? `${ok ? '✓' : '✗'} Result: ${show(value)}`, line: this.sourceLine});
  }
}

/** Hash tables: lib/hash_sandbox.dart. */
export class HashRecorder extends Recorder {
  constructor(options) {
    super(options);
    this.memory = null;
    this.count = null;
  }
  bucketRead(index, target) {
    this.steps.add({kind: 'bucketRead', index, to: idOf(target), line: this.sourceLine});
  }
  bucketWrite(index, before, after) {
    this.steps.add({kind: 'bucketWrite', index, oldTo: idOf(before), to: idOf(after), line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    const result = super.snapshot();
    const heads = this.memory?.()?.heads ?? [];
    result.buckets = heads.map(idOf);
    result.size = this.count?.() ?? 0;
    result.capacity = heads.length;
    return result;
  }
  alive() {
    const alive = new Set();
    for (const start of this.memory?.()?.heads ?? []) {
      let cursor = start;
      while (cursor !== null && !alive.has(cursor._id)) {
        alive.add(cursor._id);
        cursor = cursor._next;
      }
    }
    return alive;
  }
}

/** Binary search and AVL trees: lib/tree_sandbox.dart. */
export class TreeRecorder extends Base {
  constructor(options) {
    super(options);
    this.root = null;
    this.avl = false;
  }
  reference(name, node) {
    this.steps.add({kind: 'variableWrite', name, to: idOf(node), line: this.sourceLine});
  }
  visit(node) { this.steps.add({kind: 'visit', id: node._id, line: this.sourceLine}); }
  createNode(node) {
    TreeNode.registry.set(node._id, node);
    this.steps.add({kind: 'createNode', node: {id: node._id, value: node._value, height: node._height}, line: this.sourceLine});
  }
  valueWrite() { this.steps.add(this.snapshot()); }
  heightWrite(node, before, after) {
    this.steps.add({kind: 'heightWrite', id: node._id, before, to: after, line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  pointerWrite(from, before, after) {
    this.steps.add({kind: 'pointerWrite', from, oldTo: idOf(before), to: idOf(after), line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    const root = this.root?.() ?? null;
    const result = {kind: 'snapshot', root: idOf(root),
      nodes: [...TreeNode.registry.values()].map(node => ({id: node._id, value: node._value,
        left: idOf(node._left), right: idOf(node._right), height: node._height}))};
    if (this.avl) result.avl = auditAvl(root);
    return result;
  }
  end(value, ok, returnedVoid = false, message = null) {
    const alive = new Set();
    const pending = [this.root?.() ?? null];
    while (pending.length) {
      const node = pending.pop();
      if (node === null || alive.has(node._id)) continue;
      alive.add(node._id);
      pending.push(node._left, node._right);
    }
    const retired = [...TreeNode.registry.keys()].filter(id => !alive.has(id));
    if (retired.length) {
      this.steps.add({kind: 'retire', ids: retired, line: 0});
      for (const id of retired) TreeNode.registry.delete(id);
      this.steps.add(this.snapshot());
    }
    super.end(value, ok, returnedVoid, message);
  }
}

/** True heights from the pointer graph; iterative and cycle-safe. */
export function auditAvl(root) {
  const calculated = new Map();
  const details = {};
  const seen = new Set();
  let acyclic = true, ordered = true, heights = true, balanced = true;
  const pending = root === null ? [] : [{node: root, done: false, low: null, high: null}];
  while (pending.length) {
    const {node, done, low, high} = pending.pop();
    if (!done) {
      if (seen.has(node._id)) { acyclic = false; continue; }
      seen.add(node._id);
      if ((low !== null && node._value <= low) || (high !== null && node._value >= high)) ordered = false;
      pending.push({node, done: true, low, high});
      if (node._right !== null) pending.push({node: node._right, done: false, low: node._value, high});
      if (node._left !== null) pending.push({node: node._left, done: false, low, high: node._value});
      continue;
    }
    const left = node._left, right = node._right;
    if ((left !== null && !calculated.has(left._id)) || (right !== null && !calculated.has(right._id))) acyclic = false;
    const lh = left === null ? 0 : calculated.get(left._id) ?? 0;
    const rh = right === null ? 0 : calculated.get(right._id) ?? 0;
    const expected = 1 + Math.max(lh, rh), balance = lh - rh;
    const heightOk = node._height === expected, balanceOk = Math.abs(balance) <= 1;
    if (!heightOk) heights = false;
    if (!balanceOk) balanced = false;
    calculated.set(node._id, expected);
    details[String(node._id)] = {height: node._height, expectedHeight: expected, balance, heightOk, balanceOk};
  }
  return {acyclic, ordered, heights, balanced, nodes: details};
}

/** Fixed-array stack: lib/stack_sandbox.dart. */
export class StackRecorder extends Base {
  constructor(options) { super(options); this.memory = null; this.top = null; }
  cellWrite(index, before, value) {
    this.steps.add({kind: 'cellWrite', index, oldValue: before, value, line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    return {kind: 'snapshot', cells: this.memory?.()?.copy() ?? [], top: this.top?.() ?? -1};
  }
}

/** Array lists: lib/list_sandbox.dart. */
export class ListRecorder extends Base {
  constructor(options) { super(options); this.memory = null; this.size = null; }
  cellWrite(index, before, value) {
    this.steps.add({kind: 'cellWrite', index, oldValue: before, value, line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    return {kind: 'snapshot', cells: this.memory?.()?.copy() ?? [], size: this.size?.() ?? 0};
  }
}

/** Circular array queue: lib/queue_sandbox.dart. */
export class QueueRecorder extends Base {
  constructor(options) { super(options); this.memory = null; }
  cellWrite(index, before, value) {
    this.steps.add({kind: 'cellWrite', index, oldValue: before, value, line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    const memory = this.memory?.() ?? null;
    return {kind: 'snapshot', cells: memory?.copy() ?? [], front: memory?._front ?? 0,
      rear: memory?._rear ?? 0, size: memory?._size ?? 0};
  }
}

/** Array min-heap: lib/heap_sandbox.dart. */
export class HeapRecorder extends Base {
  constructor(options) { super(options); this.memory = null; }
  read(index, value) { this.steps.add({kind: 'heapRead', index, value, line: this.sourceLine}); }
  change(kind, fields) {
    this.steps.add({kind, ...fields, line: this.sourceLine});
    this.steps.add(this.snapshot());
  }
  snapshot() {
    const cells = this.memory?.()?.copy() ?? [];
    return {kind: 'snapshot', cells, size: cells.length, heapOrder: heapOrderValid(cells)};
  }
}
