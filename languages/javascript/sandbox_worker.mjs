// Worker process for one JavaScript data structure (one revision of one file).
//
// Started by the host as
//
//   node sandbox_worker.mjs BUILD_DIRECTORY
//
// where the directory holds structure.mjs (the instrumented copy written by
// sandbox_daemon.mjs), source.txt (the student's file as built) and build.json
// ({kind, className, sourcePath, methods}).
// It reproduces the Dart worker (lib/worker/session.dart and
// lib/structures/*.dart) message by message: the same requests (run, reset,
// validateCall, ping), the same trace events, the same reference models and
// structural checks. languages/python/sandbox_worker.py is the same port for
// Python; both are kept line by line in step.
//
// The instrumented copy calls __sandbox.enter(line) when a method starts and
// __sandbox.at(line, frame, locals) before each statement. Accessor properties
// on the student's object report `top`, `size`, `head`, `root` and `tail`
// assignments: exactly the events the Dart instrumenter inserts.
import {readFileSync, readSync, realpathSync, writeSync} from 'node:fs';
import {StringDecoder} from 'node:string_decoder';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {format} from 'node:util';

const HERE = fileURLToPath(new URL('.', import.meta.url));
// The same URL as the rewritten import in structure.mjs: one module instance.
const sandbox = await import(pathToFileURL(realpathSync(`${HERE}sandbox.mjs`)).href);
const {
  Diagnostics, HashRecorder, HeapRecorder, ListNode, ListRecorder, QueueRecorder, Recorder, StackRecorder,
  TraceLimitReached, TreeNode, TreeRecorder, activeRecorder, auditAvl, heapOrderValid, setActive, show,
} = sandbox;

const MAX_OPERATIONS = 20;
const MAX_VALUE = 999;
const INVALID_MARKER = 10000000;
const EXPORT_NAME = '__sandboxStructure';

Error.stackTraceLimit = 60;

// ---------------------------------------------------------------- protocol

const sleeper = new Int32Array(new SharedArrayBuffer(4));
const sleep = milliseconds => Atomics.wait(sleeper, 0, 0, milliseconds);

function writeAll(text) {
  const bytes = Buffer.from(text, 'utf8');
  let offset = 0;
  while (offset < bytes.length) {
    try {
      offset += writeSync(1, bytes, offset, bytes.length - offset);
    } catch (error) {
      if (error.code !== 'EAGAIN') throw error;
      sleep(2);
    }
  }
}

function post(message) {
  let encoded;
  try {
    encoded = JSON.stringify(message);
  } catch (error) {
    encoded = JSON.stringify({type: 'error', message: `Could not encode a worker message: ${error.message}`});
  }
  writeAll(`${encoded}\n`);
}

const decoder = new StringDecoder('utf8');
const chunk = Buffer.alloc(65536);
let pending = '';

/** The next line from the host, or null when the host closed the pipe. */
function readLine() {
  for (;;) {
    const newline = pending.indexOf('\n');
    if (newline >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      return line;
    }
    let count;
    try {
      count = readSync(0, chunk, 0, chunk.length, null);
    } catch (error) {
      if (error.code === 'EAGAIN') {
        sleep(2);
        continue;
      }
      if (error.code === 'EOF') return null;
      throw error;
    }
    if (count === 0) return null;
    pending += decoder.write(chunk.subarray(0, count));
  }
}

/** Dart's FormatException: an invalid request, not a student error. */
class RequestError extends Error {
  toString() { return `FormatException: ${this.message}`; }
}

const isInt = value => Number.isInteger(value);
const isNumber = value => typeof value === 'number';
const nullish = value => (value === undefined ? null : value);

/** Dart's == for the JSON values that methods return: true is not 1. */
const same = (a, b) => nullish(a) === nullish(b);

const singleInt = args => (args.length === 1 && isInt(args[0]) ? args[0] : null);
const joined = values => values.map(String).join(',');
const minimum = values => values.reduce((a, b) => (b < a ? b : a));
const ascending = (a, b) => a - b;

/** Dart's toString in messages; a double keeps its fraction (1.0). */
function showTyped(value, type) {
  if (type === 'double' && isInt(value)) return `${value}.0`;
  return show(value);
}

// --------------------------------------------------------------- the adapters
// One per structure, ported from lib/structures/*.dart.

class Adapter {
  constructor(create) {
    this.create = create;
    this.reference = [];
    this.instance = null;
    this.kind = '';
    this.recorderClass = Recorder;
    // Student-owned fields whose assignments the Dart instrumenter records.
    this.indexFields = [];
    this.pointerFields = [];
    this.standardMethods = new Set();
    this.unorderedContents = false;
    this.insertReturnsVoid = false;
    this.insertTakesIndex = false;
    this.capacityCells = false;
  }

  get s() { return this.instance; }

  resetIds() {}

  reset() {
    this.reference = [];
    this.resetIds();
    setActive(null);
    this.instance = this.create();
    installFieldHooks(this.instance, this);
  }

  createRecorder() { return new this.recorderClass(); }

  get capacity() { return this.capacityCells ? this.s.memory.length : null; }

  executionProblems() { return []; }

  structuralChecks() {}

  returnMatches(name, expected, returned) { return same(expected, returned); }

  requiredMethodSignature(name) {
    let returns;
    if (name === 'insert' && this.insertReturnsVoid) returns = 'void';
    else if (['insert', 'push', 'enqueue', 'contains', 'remove', 'isEmpty', 'isFull'].includes(name)) returns = 'bool';
    else if (['get', 'removeAt', 'pop', 'peek', 'dequeue', 'removeMin'].includes(name)) returns = 'int?';
    else if (name === 'length') returns = 'int';
    else if (name === 'loadFactor') returns = 'double';
    else throw new Error(`No required signature for ${this.kind}.${name}`);
    let args;
    if (name === 'insert' && this.insertTakesIndex) args = 'int, int';
    else if (['pop', 'peek', 'dequeue', 'removeMin', 'isEmpty', 'isFull', 'length', 'loadFactor'].includes(name)) args = '';
    else args = 'int';
    return `${returns} ${name}(${args})`;
  }

  expectedReturn(name, args) {
    const value = args.length && isInt(args[args.length - 1]) ? args[args.length - 1] : null;
    const index = this.insertTakesIndex && args.length ? args[0] : null;
    const reference = this.reference;
    if (name === 'get' || name === 'removeAt') {
      return index !== null && index >= 0 && index < reference.length ? reference[index] : null;
    }
    if (name === 'pop') return reference.length ? reference[reference.length - 1] : null;
    if (name === 'peek' || name === 'dequeue') return reference.length ? reference[0] : null;
    if (name === 'removeMin') return reference.length ? minimum(reference) : null;
    if (name === 'remove' || name === 'contains') return reference.includes(value);
    if (name === 'length') return reference.length;
    if (name === 'isEmpty') return reference.length === 0;
    if (name === 'isFull') return reference.length === 8;
    throw new Error(`No reference contract for ${this.kind}.${name}`);
  }

  static chainValues(head) {
    const values = [];
    const seen = new Set();
    let node = nullish(head);
    while (node !== null && !seen.has(node._id)) {
      seen.add(node._id);
      values.push(node._value);
      node = node._next;
    }
    if (node !== null) values.push(INVALID_MARKER);
    return values;
  }
}

class ArrayStackAdapter extends Adapter {
  constructor(create) {
    super(create);
    this.kind = 'stack';
    this.recorderClass = StackRecorder;
    this.indexFields = ['top'];
    this.standardMethods = new Set(['push', 'pop', 'peek', 'isEmpty']);
    this.capacityCells = true;
  }

  createRecorder() {
    const recorder = new StackRecorder();
    recorder.memory = () => this.s.memory;
    recorder.top = () => this.s.top;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name === 'push' || name === 'insert') return this.reference.length < 8;
    if (name === 'peek') return this.reference.length ? this.reference[this.reference.length - 1] : null;
    return super.expectedReturn(name, args);
  }

  actualValues() {
    const memory = this.s.memory, top = this.s.top;
    const values = [];
    for (let i = 0; i <= top && i < memory.length; i++) {
      const v = memory._cells[i];
      if (v !== null) values.push(v);
    }
    return values;
  }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const stack = this.reference;
    if (name === 'push' && value !== null) {
      const expected = stack.length < 8;
      if (expected) stack.push(value);
      return same(returned, expected);
    }
    if (name === 'pop') return same(returned, stack.length ? stack.pop() : null);
    if (name === 'peek') return same(returned, stack.length ? stack[stack.length - 1] : null);
    if (name === 'isEmpty') return same(returned, stack.length === 0);
    this.reference = this.actualValues();
    return true;
  }

  storageValid() {
    const memory = this.s.memory, top = this.s.top;
    if (!isInt(top) || top < -1 || top >= memory.length) return false;
    for (let i = 0; i < memory.length; i++) if ((i <= top) !== (memory._cells[i] !== null)) return false;
    return true;
  }

  executionProblems() { return this.storageValid() ? [] : ['stack cells or top index']; }

  structuralChecks(check) {
    check('Fixed capacity', 8, this.s.memory.length);
    check('Top index', this.reference.length - 1, nullish(this.s.top));
    check('Stack storage', true, this.storageValid());
  }
}

class LinkedStackAdapter extends Adapter {
  constructor(create) {
    super(create);
    this.kind = 'linked_stack';
    this.pointerFields = ['head'];
    this.standardMethods = new Set(['push', 'pop', 'peek', 'isEmpty']);
  }

  resetIds() { ListNode.resetIds(); }

  createRecorder() {
    const recorder = new Recorder();
    recorder.root = () => this.s.head;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name === 'push' || name === 'insert') return true;
    if (name === 'pop') return this.reference.length ? this.reference[0] : null;
    return super.expectedReturn(name, args);
  }

  actualValues() { return Adapter.chainValues(this.s.head); }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const reference = this.reference;
    if (name === 'push' && value !== null) {
      reference.unshift(value);
      return same(returned, true);
    }
    if (name === 'pop') return same(returned, reference.length ? reference.shift() : null);
    if (name === 'peek') return same(returned, reference.length ? reference[0] : null);
    if (name === 'isEmpty') return same(returned, reference.length === 0);
    this.reference = this.actualValues();
    return true;
  }

  structuralChecks(check) {
    const seen = new Set();
    let node = nullish(this.s.head);
    while (node !== null && !seen.has(node._id)) {
      seen.add(node._id);
      node = node._next;
    }
    check('Acyclic stack chain', true, node === null);
  }
}

class ArrayQueueAdapter extends Adapter {
  constructor(create) {
    super(create);
    this.kind = 'array_queue';
    this.recorderClass = QueueRecorder;
    this.standardMethods = new Set(['enqueue', 'dequeue', 'peek', 'isEmpty', 'isFull']);
    this.capacityCells = true;
  }

  createRecorder() {
    const recorder = new QueueRecorder();
    recorder.memory = () => this.s.memory;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name === 'enqueue' || name === 'insert') return this.reference.length < 8;
    return super.expectedReturn(name, args);
  }

  markers() {
    const memory = this.s.memory;
    return [memory, memory.length, memory._front, memory._rear, memory._size];
  }

  actualValues() {
    const [memory, n, front, , size] = this.markers();
    if (n <= 0 || front < 0 || front >= n || size < 0 || size > n) return [INVALID_MARKER];
    const values = [];
    for (let i = 0; i < size; i++) {
      const v = memory._cells[(front + i) % n];
      if (v === null) return [INVALID_MARKER];
      values.push(v);
    }
    return values;
  }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const values = this.reference;
    if (name === 'enqueue' && value !== null) {
      const expected = values.length < this.s.memory.length;
      if (expected) values.push(value);
      return same(returned, expected);
    }
    if (name === 'dequeue') return same(returned, values.length ? values.shift() : null);
    if (name === 'peek') return same(returned, values.length ? values[0] : null);
    if (name === 'isEmpty') return same(returned, values.length === 0);
    if (name === 'isFull') return same(returned, values.length === this.s.memory.length);
    this.reference = this.actualValues();
    return true;
  }

  storageValid() {
    const [memory, n, front, rear, size] = this.markers();
    if (n <= 0 || front < 0 || front >= n || rear < 0 || rear >= n || size < 0 || size > n
        || rear !== (front + size) % n) return false;
    for (let i = 0; i < n; i++) if ((((i - front + n) % n) < size) !== (memory._cells[i] !== null)) return false;
    return true;
  }

  executionProblems() { return this.storageValid() ? [] : ['circular queue storage']; }

  structuralChecks(check) {
    check('Fixed capacity', 8, this.s.memory.length);
    check('Logical size', this.reference.length, this.s.memory._size);
    check('Circular queue storage', true, this.storageValid());
  }
}

class LinkedQueueAdapter extends Adapter {
  constructor(create) {
    super(create);
    this.kind = 'linked_queue';
    this.pointerFields = ['head', 'tail'];
    this.standardMethods = new Set(['enqueue', 'dequeue', 'peek', 'isEmpty']);
  }

  resetIds() { ListNode.resetIds(); }

  createRecorder() {
    const recorder = new Recorder();
    recorder.root = () => this.s.head;
    recorder.tail = () => this.s.tail;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name === 'enqueue' || name === 'insert') return true;
    return super.expectedReturn(name, args);
  }

  actualValues() { return Adapter.chainValues(this.s.head); }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const reference = this.reference;
    if (name === 'enqueue' && value !== null) {
      reference.push(value);
      return same(returned, true);
    }
    if (name === 'dequeue') return same(returned, reference.length ? reference.shift() : null);
    if (name === 'peek') return same(returned, reference.length ? reference[0] : null);
    if (name === 'isEmpty') return same(returned, reference.length === 0);
    this.reference = this.actualValues();
    return true;
  }

  pointersValid() {
    const head = nullish(this.s.head), tail = nullish(this.s.tail);
    if (head === null) return tail === null;
    if (tail === null) return false;
    const visited = new Set();
    let last = null, cursor = head;
    while (cursor !== null && !visited.has(cursor._id)) {
      visited.add(cursor._id);
      last = cursor;
      cursor = cursor._next;
    }
    return cursor === null && last === tail && tail._next === null;
  }

  executionProblems() { return this.pointersValid() ? [] : ['head/tail pointers']; }

  structuralChecks(check) { check('Head/tail and acyclic chain', true, this.pointersValid()); }
}

function updateListReference(reference, name, args, returned, positional, capacityLimited) {
  const value = singleInt(args);
  const index = positional && args.length ? args[0] : null;
  const item = positional && args.length === 2 ? args[1] : value;
  if (name === 'insert') {
    if (item === null) return false;
    const allowed = (!capacityLimited || reference.length < 8)
      && (!positional || (index !== null && index >= 0 && index <= reference.length));
    if (allowed) {
      if (positional) {
        reference.splice(index, 0, item);
      } else {
        let at = 0;
        while (at < reference.length && reference[at] <= item) at++;
        reference.splice(at, 0, item);
      }
    }
    return same(returned, allowed);
  }
  if (name === 'get') {
    if (index === null) return false;
    return same(returned, index >= 0 && index < reference.length ? reference[index] : null);
  }
  if (name === 'removeAt') {
    if (index === null) return false;
    const expected = index >= 0 && index < reference.length ? reference.splice(index, 1)[0] : null;
    return same(returned, expected);
  }
  if (name === 'remove') {
    if (item === null) return false;
    const at = reference.indexOf(item);
    if (at >= 0) reference.splice(at, 1);
    return same(returned, at >= 0);
  }
  if (name === 'contains') return item !== null && same(returned, reference.includes(item));
  if (name === 'length') return same(returned, reference.length);
  return false;
}

const UNSORTED_METHODS = ['insert', 'get', 'removeAt', 'contains', 'length'];
const SORTED_METHODS = ['insert', 'contains', 'remove', 'length'];

class ArrayListAdapter extends Adapter {
  constructor(create, sorted) {
    super(create);
    this.sorted = sorted;
    this.kind = sorted ? 'sorted_array_list' : 'unsorted_array_list';
    this.recorderClass = ListRecorder;
    this.indexFields = ['size'];
    this.standardMethods = new Set(sorted ? SORTED_METHODS : UNSORTED_METHODS);
    this.insertTakesIndex = !sorted;
  }

  createRecorder() {
    const recorder = new ListRecorder();
    recorder.memory = () => this.s.memory;
    recorder.size = () => this.s.size;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name !== 'insert') return super.expectedReturn(name, args);
    if (this.sorted) return this.reference.length < 8;
    const index = args.length ? args[0] : null;
    return this.reference.length < 8 && index !== null && index >= 0 && index <= this.reference.length;
  }

  actualValues() {
    const cells = this.s.memory.copy();
    const size = this.s.size;
    if (!isInt(size) || size < 0 || size > cells.length) return [INVALID_MARKER];
    const values = [];
    for (let i = 0; i < size; i++) {
      if (cells[i] === null) return [INVALID_MARKER];
      values.push(cells[i]);
    }
    return values;
  }

  updateReference(name, args, returned) {
    return updateListReference(this.reference, name, args, returned, !this.sorted, true);
  }

  storageValid() {
    const memory = this.s.memory, size = this.s.size;
    if (!isInt(size) || size < 0 || size > memory.length || size !== this.reference.length) return false;
    const cells = memory.copy();
    for (let i = 0; i < cells.length; i++) {
      if ((i < size) !== (cells[i] !== null)) return false;
      if (this.sorted && i > 0 && i < size && cells[i - 1] > cells[i]) return false;
    }
    return true;
  }

  executionProblems() { return this.storageValid() ? [] : ['list storage, length or order']; }

  structuralChecks(check) {
    check('Logical size', this.reference.length, nullish(this.s.size));
    check('List storage and ordering', true, this.storageValid());
    check('Fixed capacity', 8, this.s.memory.length);
  }
}

class LinkedListAdapter extends Adapter {
  constructor(create, sorted) {
    super(create);
    this.sorted = sorted;
    this.kind = sorted ? 'sorted_linked_list' : 'unsorted_linked_list';
    this.indexFields = ['size'];
    this.pointerFields = ['head'];
    this.standardMethods = new Set(sorted ? SORTED_METHODS : UNSORTED_METHODS);
    this.insertTakesIndex = !sorted;
  }

  resetIds() { ListNode.resetIds(); }

  createRecorder() {
    const recorder = new Recorder();
    recorder.root = () => this.s.head;
    recorder.size = () => this.s.size;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name !== 'insert') return super.expectedReturn(name, args);
    if (this.sorted) return true;
    const index = args.length ? args[0] : null;
    return index !== null && index >= 0 && index <= this.reference.length;
  }

  actualValues() { return Adapter.chainValues(this.s.head); }

  updateReference(name, args, returned) {
    const reference = this.reference;
    if (!this.sorted) return updateListReference(reference, name, args, returned, true, false);
    if (name === 'length') return same(returned, reference.length);
    const value = singleInt(args);
    if (value === null) {
      this.reference = this.actualValues();
      return true;
    }
    const present = reference.includes(value);
    if (name === 'insert') {
      let index = reference.findIndex(v => v >= value);
      if (index < 0) index = reference.length;
      reference.splice(index, 0, value);
      return same(returned, true);
    }
    if (name === 'contains') return same(returned, present);
    if (name === 'remove') {
      if (present) reference.splice(reference.indexOf(value), 1);
      return same(returned, present);
    }
    this.reference = this.actualValues();
    return true;
  }

  storageValid() {
    const size = this.s.size;
    if (!isInt(size) || size < 0) return false;
    const seen = new Set();
    let node = nullish(this.s.head);
    let previous = null;
    while (node !== null) {
      if (seen.has(node._id)) return false;
      seen.add(node._id);
      if (seen.size > size) return false;
      if (this.sorted && previous !== null && node._value < previous) return false;
      previous = node._value;
      node = node._next;
    }
    return seen.size === size && size === this.reference.length;
  }

  executionProblems() { return this.storageValid() ? [] : ['list storage, length or order']; }

  structuralChecks(check) {
    check('Logical size', this.reference.length, nullish(this.s.size));
    check('List storage and ordering', true, this.storageValid());
  }
}

class TreeAdapter extends Adapter {
  constructor(create, avl) {
    super(create);
    this.avl = avl;
    this.kind = avl ? 'avl' : 'tree';
    this.recorderClass = TreeRecorder;
    this.pointerFields = ['root'];
    this.standardMethods = new Set(['insert', 'contains', 'remove']);
    this.insertReturnsVoid = true;
  }

  resetIds() { TreeNode.resetIds(); }

  createRecorder() {
    const recorder = new TreeRecorder();
    recorder.root = () => nullish(this.s.root);
    recorder.avl = this.avl;
    return recorder;
  }

  expectedReturn(name, args) { return name === 'insert' ? null : super.expectedReturn(name, args); }

  actualValues() {
    const values = [];
    const seen = new Set();
    const pending = [];
    let current = nullish(this.s.root);
    while (current !== null || pending.length) {
      while (current !== null) {
        if (seen.has(current._id)) {
          values.push(INVALID_MARKER);
          return values;
        }
        seen.add(current._id);
        pending.push(current);
        current = current._left;
      }
      const node = pending.pop();
      values.push(node._value);
      current = node._right;
    }
    return values;
  }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const reference = this.reference;
    if (value === null) {
      this.reference = this.actualValues();
      return true;
    }
    const present = reference.includes(value);
    if (name === 'insert') {
      if (!present) {
        reference.push(value);
        reference.sort(ascending);
      }
      return true;
    }
    if (name === 'contains') return same(returned, present);
    if (name === 'remove') {
      if (present) reference.splice(reference.indexOf(value), 1);
      return same(returned, present);
    }
    this.reference = this.actualValues();
    return true;
  }

  executionProblems() {
    if (!this.avl) return [];
    const audit = auditAvl(nullish(this.s.root));
    const faults = [['acyclic', 'cycle/shared child'], ['ordered', 'BST order'], ['heights', 'stored heights'],
      ['balanced', 'balance factor']].filter(([key]) => audit[key] !== true).map(([, label]) => label);
    return faults.length ? [`AVL: ${faults.join(', ')}`] : [];
  }

  structuralChecks(check) {
    const audit = auditAvl(nullish(this.s.root));
    check('Acyclic tree', true, audit.acyclic);
    check('BST ordering', true, audit.ordered);
    if (this.avl) {
      check('Stored subtree heights', true, audit.heights);
      check('AVL balance', true, audit.balanced);
    }
  }
}

class ArrayHeapAdapter extends Adapter {
  constructor(create) {
    super(create);
    this.kind = 'array_heap';
    this.recorderClass = HeapRecorder;
    this.standardMethods = new Set(['insert', 'removeMin', 'peek', 'isEmpty']);
    this.unorderedContents = true;
    this.insertReturnsVoid = true;
  }

  createRecorder() {
    const recorder = new HeapRecorder();
    recorder.memory = () => this.s.memory;
    return recorder;
  }

  expectedReturn(name, args) {
    if (name === 'insert') return null;
    if (name === 'peek') return this.reference.length ? minimum(this.reference) : null;
    return super.expectedReturn(name, args);
  }

  actualValues() { return this.s.memory.copy(); }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const reference = this.reference;
    if (name === 'insert' && value !== null) {
      reference.push(value);
      reference.sort(ascending);
      return true;
    }
    if (name === 'removeMin') return same(returned, reference.length ? reference.shift() : null);
    if (name === 'peek') return same(returned, reference.length ? reference[0] : null);
    if (name === 'isEmpty') return same(returned, reference.length === 0);
    this.reference = this.s.memory.copy().sort(ascending);
    return true;
  }

  storageValid() { return heapOrderValid(this.s.memory.copy()); }

  executionProblems() { return this.storageValid() ? [] : ['min-heap order']; }

  structuralChecks(check) { check('Min-heap ordering', true, this.storageValid()); }
}

/** Physical placement checked with the STUDENT'S hash function. Not a student
 *  traversal: nothing is recorded meanwhile. */
function auditHash(buckets, size) {
  const previous = activeRecorder();
  setActive(null);
  try {
    const seen = new Set(), keys = new Set(), values = [], lengths = [];
    let acyclic = true, placement = true, unique = true;
    buckets.heads.forEach((head, i) => {
      let length = 0;
      let cursor = head;
      while (cursor !== null) {
        if (seen.has(cursor._id)) {
          acyclic = false;
          break;
        }
        seen.add(cursor._id);
        const key = cursor._value;
        try {
          if (buckets.indexFor(key) !== i) placement = false;
        } catch {
          placement = false; // An invariant failure.
        }
        if (keys.has(key)) unique = false;
        keys.add(key);
        values.push(key);
        length++;
        cursor = cursor._next;
      }
      lengths.push(length);
    });
    return {acyclic, placement, unique, sizeOk: size === values.length, size, capacity: buckets.length,
      loadFactor: size / buckets.length, lengths, values};
  } finally {
    setActive(previous);
  }
}

class HashAdapter extends Adapter {
  constructor(create) {
    super(create);
    this.kind = 'hash';
    this.recorderClass = HashRecorder;
    this.standardMethods = new Set(['insert', 'remove', 'contains', 'isEmpty', 'loadFactor']);
    this.unorderedContents = true;
  }

  resetIds() { ListNode.resetIds(); }

  createRecorder() {
    const recorder = new HashRecorder();
    recorder.memory = () => this.s.buckets;
    recorder.count = () => this.s.size;
    return recorder;
  }

  audit() { return auditHash(this.s.buckets, this.s.size); }

  expectedReturn(name, args) {
    const value = args.length && isInt(args[args.length - 1]) ? args[args.length - 1] : null;
    if (name === 'insert') return !this.reference.includes(value);
    if (name === 'loadFactor') return this.reference.length / this.s.buckets.length;
    return super.expectedReturn(name, args);
  }

  returnMatches(name, expected, returned) {
    if (name === 'loadFactor') return isNumber(returned) && isNumber(expected) && Math.abs(returned - expected) < 0.0000001;
    return same(expected, returned);
  }

  actualValues() { return this.audit().values; }

  updateReference(name, args, returned) {
    const value = singleInt(args);
    const reference = this.reference;
    if (name === 'insert' && value !== null) {
      const expected = !reference.includes(value);
      if (expected) reference.push(value);
      return same(returned, expected);
    }
    if (name === 'remove' && value !== null) {
      const expected = reference.includes(value);
      if (expected) reference.splice(reference.indexOf(value), 1);
      return same(returned, expected);
    }
    if (name === 'contains' && value !== null) return same(returned, reference.includes(value));
    if (name === 'isEmpty') return same(returned, reference.length === 0);
    if (name === 'loadFactor') {
      return isNumber(returned) && Math.abs(returned - this.s.size / this.s.buckets.length) < 0.0000001;
    }
    this.reference = this.actualValues();
    return true;
  }

  executionProblems() {
    const audit = this.audit();
    const faults = [['acyclic', 'cycle/shared node'], ['placement', 'wrong bucket'], ['unique', 'duplicate keys'],
      ['sizeOk', 'stored size']].filter(([key]) => audit[key] !== true).map(([, label]) => label);
    return faults.length ? [`hash: ${faults.join(', ')}`] : [];
  }

  structuralChecks(check) {
    const audit = this.audit();
    check('Acyclic chains', true, audit.acyclic);
    check('Bucket placement', true, audit.placement);
    check('Unique keys', true, audit.unique);
    check('Stored size', this.reference.length, nullish(this.s.size));
    check('Hash table storage', true, audit.sizeOk);
  }
}

const ADAPTERS = {
  unsorted_array_list: create => new ArrayListAdapter(create, false),
  sorted_array_list: create => new ArrayListAdapter(create, true),
  unsorted_linked_list: create => new LinkedListAdapter(create, false),
  sorted_linked_list: create => new LinkedListAdapter(create, true),
  tree: create => new TreeAdapter(create, false),
  avl: create => new TreeAdapter(create, true),
  stack: create => new ArrayStackAdapter(create),
  linked_stack: create => new LinkedStackAdapter(create),
  linked_queue: create => new LinkedQueueAdapter(create),
  array_queue: create => new ArrayQueueAdapter(create),
  array_heap: create => new ArrayHeapAdapter(create),
  hash: create => new HashAdapter(create),
};

// ------------------------------------------------------------ method discovery

/** The public methods that the browser can call: every parameter a plain
 *  name (an int). Standard methods with the right number of parameters get
 *  the contract's types, so only the arity is checked. */
function discoverMethods(cls, adapter, declared) {
  const methods = [];
  for (const name of Object.getOwnPropertyNames(cls.prototype)) {
    if (name === 'constructor' || name.startsWith('_') || name.startsWith('#')) continue;
    const descriptor = Object.getOwnPropertyDescriptor(cls.prototype, name);
    const info = declared[name];
    if (!info || !info.params || typeof descriptor.value !== 'function') continue;
    let types = info.params.map(() => 'int');
    let returns = 'dynamic';
    if (adapter.standardMethods.has(name)) {
      const required = adapter.requiredMethodSignature(name);
      const space = required.indexOf(' ');
      const requiredParams = required.slice(required.indexOf('(') + 1, -1);
      const requiredTypes = requiredParams ? requiredParams.split(',').map(type => type.trim()) : [];
      if (requiredTypes.length === info.params.length) {
        types = requiredTypes;
        returns = required.slice(0, space);
      }
    }
    methods.push({
      name,
      params: info.params.map((param, i) => ({name: param, type: types[i], named: false})),
      returns,
      line: info.line,
    });
  }
  return methods;
}

// -------------------------------------------------------------------- tracing

/** `this.top = …`, `this.size += 1`, `this.head = …` in student methods become
 *  indexWrite / pointerWrite events, as the Dart instrumenter does. An
 *  accessor on the student's object replaces the plain field. */
function installFieldHooks(instance, adapter) {
  if (instance === null || typeof instance !== 'object') return;
  const hook = (name, emit) => {
    const descriptor = Object.getOwnPropertyDescriptor(instance, name);
    if (descriptor ? !('value' in descriptor) || !descriptor.configurable : name in instance) return;
    let value = descriptor?.value;
    try {
      Object.defineProperty(instance, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: next => {
          const before = value;
          value = next;
          const recorder = activeRecorder();
          if (recorder !== null) emit(recorder, nullish(before), next);
        },
      });
    } catch {
      // A frozen or sealed object: its fields are not traced.
    }
  };
  for (const name of adapter.indexFields) hook(name, (recorder, before, after) => recorder.indexWrite(name, before, after));
  for (const name of adapter.pointerFields) {
    hook(name, (recorder, before, after) => recorder.pointerWrite?.(`root:${name}`, before, after));
  }
}

/** The hooks that structure.mjs calls. Node-typed local variables become
 *  `variableWrite` events after the statement that assigned them. Without
 *  declared types, null counts as a node reference (`let previous = null`). */
class Hooks {
  constructor() {
    this.nodeType = null;
  }

  enter(line) {
    const recorder = activeRecorder();
    if (recorder !== null) recorder.atLine(line);
    return {nodes: new Map()};
  }

  at(line, frame, locals) {
    const recorder = activeRecorder();
    if (recorder === null) return;
    if (this.nodeType !== null && typeof recorder.reference === 'function') this.references(frame, locals, recorder);
    recorder.atLine(line);
  }

  references(frame, locals, recorder) {
    for (const [name, read] of locals()) {
      let value;
      try {
        value = read();
      } catch {
        continue; // Not initialized yet (temporal dead zone).
      }
      let id;
      if (value instanceof this.nodeType) id = value._id;
      else if (value === null || (value === undefined && frame.nodes.has(name))) id = null;
      else continue;
      if (frame.nodes.has(name) && frame.nodes.get(name) === id) continue;
      frame.nodes.set(name, id);
      recorder.steps.add({kind: 'variableWrite', name, to: id, line: recorder.sourceLine});
    }
  }
}

const hooks = new Hooks();
globalThis.__sandbox = hooks;

// -------------------------------------------------------------------- session

function jsonValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  return String(value);
}

class Session {
  constructor(directory, cls, build) {
    this.kind = build.kind;
    this.sourcePath = build.sourcePath;
    const source = readFileSync(`${directory}/source.txt`, 'utf8');
    this.lines = source.split('\n');
    if (this.lines.length && this.lines[this.lines.length - 1] === '') this.lines.pop();
    this.sessionId = String(Date.now() * 1000);
    this.adapter = ADAPTERS[this.kind](() => new cls());
    this.methods = discoverMethods(cls, this.adapter, build.methods ?? {});
    const usesNodes = [Recorder, HashRecorder, TreeRecorder].includes(this.adapter.recorderClass);
    hooks.nodeType = usesNodes ? (this.adapter.recorderClass === TreeRecorder ? TreeNode : ListNode) : null;
    this.adapter.reset();
  }

  get reference() { return this.adapter.reference; }

  initial() { return this.envelope([this.adapter.createRecorder().snapshot()]); }

  envelope(steps) {
    return {
      type: 'trace',
      structure: this.kind,
      sessionId: `${this.kind}:${this.sessionId}`,
      source: {file: this.sourcePath, lines: this.lines},
      steps: [...steps],
      values: [...this.reference],
      methods: this.methods.map(({name, params, returns}) => ({name, params, returns})),
      capacity: this.adapter.capacity,
    };
  }

  descriptor(name) {
    const method = this.methods.find(candidate => candidate.name === name);
    if (!method) throw new RequestError(`Unknown method: ${name}`);
    return method;
  }

  static scalar(raw, kind) {
    if (kind === 'int' && isInt(raw) && Math.abs(raw) <= MAX_VALUE) return raw;
    if (kind === 'double' && isNumber(raw) && Number.isFinite(raw)) return raw;
    if (kind === 'bool' && typeof raw === 'boolean') return raw;
    if (kind === 'String' && typeof raw === 'string' && raw.length <= 256) return raw;
    throw new RequestError(`Invalid ${kind} argument (integer range: -999…999).`);
  }

  plan(message) {
    if (message.action !== 'run') throw new RequestError('Unknown command.');
    const checkedCall = (name, args) => {
      const params = this.descriptor(name).params;
      if (args.length !== params.length) throw new RequestError('Wrong number of arguments.');
      return {method: name, args: args.map((arg, i) => Session.scalar(arg, params[i].type))};
    };
    const sequence = message.commands;
    if (Array.isArray(sequence)) {
      if (!sequence.length || sequence.length > MAX_OPERATIONS) throw new RequestError(`Use 1–${MAX_OPERATIONS} calls.`);
      return sequence.map(command => {
        if (command && typeof command === 'object' && typeof command.method === 'string' && Array.isArray(command.arguments)) {
          return checkedCall(command.method, command.arguments);
        }
        throw new RequestError('Invalid command in sequence.');
      });
    }
    const name = message.method;
    if (typeof name !== 'string') throw new RequestError('Supply the method arguments.');
    const params = this.descriptor(name).params;
    const raw = message.arguments, legacy = message.values;
    if (Array.isArray(raw)) return [checkedCall(name, raw)];
    if (Array.isArray(legacy) && params.length === 1 && params[0].type === 'int') {
      if (!legacy.length || legacy.length > MAX_OPERATIONS) throw new RequestError(`Use 1–${MAX_OPERATIONS} calls.`);
      return legacy.map(value => checkedCall(name, [value]));
    }
    throw new RequestError('Supply the method arguments.');
  }

  invoke(name, args) {
    const method = this.descriptor(name);
    const result = this.adapter.instance[name](...args);
    return method.returns === 'void' ? null : nullish(result);
  }

  invokeRecorded(recorder, name, args) {
    setActive(recorder);
    try {
      return this.invoke(name, args);
    } finally {
      setActive(null);
    }
  }

  validateCall(message) {
    const name = message.method;
    const declared = this.descriptor(name);
    const params = declared.params;
    const raw = message.arguments;
    if (!Array.isArray(raw) || raw.length !== params.length) throw new RequestError('Wrong number of test arguments.');
    const required = this.adapter.requiredMethodSignature(name);
    const declaredArgs = params.map(param => (param.named ? 'named ' : '') + param.type).join(', ');
    const declaredSignature = `${declared.returns} ${name}(${declaredArgs})`;
    if (required !== declaredSignature) {
      return {
        type: 'validationCall', ok: false, notExecuted: true,
        expectedContents: [...this.reference],
        actualContents: this.adapter.actualValues(),
        checks: [{aspect: 'Method signature', expected: required, actual: declaredSignature}],
        message: 'Method signature',
      };
    }
    const args = raw.map((value, i) => Session.scalar(value, params[i].type));
    const expected = this.adapter.expectedReturn(name, args);
    // The instrumented student method expects an active recorder; this one is
    // disposable and never interpreted as a test result.
    const returned = this.invokeRecorded(this.adapter.createRecorder(), name, args);
    this.adapter.updateReference(name, args, returned);
    const expectedContents = [...this.reference];
    const actualContents = this.adapter.actualValues();
    const issues = [];
    const check = (aspect, wanted, observed, passed = null) => {
      if (!(passed ?? same(wanted, observed))) issues.push({aspect, expected: wanted, actual: nullish(observed)});
    };
    check('Return value', expected, returned, this.adapter.returnMatches(name, expected, returned));
    const unordered = this.adapter.unorderedContents;
    const comparedActual = [...actualContents];
    const comparedExpected = [...expectedContents];
    if (unordered) {
      comparedActual.sort(ascending);
      comparedExpected.sort(ascending);
    }
    check('Contents', comparedExpected, comparedActual, joined(comparedExpected) === joined(comparedActual));
    this.adapter.structuralChecks(check);
    const result = {
      type: 'validationCall', ok: issues.length === 0,
      expectedReturn: expected, actualReturn: jsonValue(returned),
      returnIsVoid: declared.returns === 'void',
      expectedContents: unordered ? comparedExpected : expectedContents,
      actualContents: unordered ? comparedActual : actualContents,
      contentsComparedAsUnordered: unordered,
      checks: issues,
    };
    if (issues.length) result.message = issues.map(issue => issue.aspect).join(', ');
    return result;
  }

  execute(message) {
    const action = message.action;
    if (action === 'reset') {
      this.adapter.reset();
      return this.initial();
    }
    if (action === 'validateCall') return this.validateCall(message);
    const commands = this.plan(message);
    const fromEmpty = message.reset === true;
    if (fromEmpty) this.adapter.reset();
    const recorder = this.adapter.createRecorder();
    recorder.steps.add(recorder.snapshot());
    let completed = 0;
    let stoppedEarly = false;
    for (const {method: name, args} of commands) {
      completed++;
      const descriptor = this.descriptor(name);
      recorder.begin(name, args, descriptor.line);
      let result;
      try {
        result = this.invokeRecorded(recorder, name, args);
      } catch (error) {
        const failure = this.runtimeFailure(error);
        const index = failure.traceIndex;
        if (isInt(index) && index >= recorder.steps.length && recorder.steps.length) {
          failure.traceIndex = recorder.steps.length - 1;
        }
        try {
          recorder.steps.add({kind: 'executionError', message: failure.message,
            line: failure.line ?? Diagnostics.currentLine});
        } catch (limit) {
          if (!(limit instanceof TraceLimitReached)) throw limit;
          // The failure metadata still carries the last line.
        }
        return {...this.envelope(recorder.steps), type: 'executionError', error: failure};
      }
      result = jsonValue(result);
      const adapter = this.adapter;
      const canVerify = adapter.standardMethods.has(name) && (
        ['pop', 'dequeue', 'removeMin', 'peek', 'isEmpty', 'isFull', 'length'].includes(name)
        || (args.length === 1 && isInt(args[0]))
        || (args.length === 2 && args.every(isInt)));
      const checked = adapter.updateReference(name, args, result);
      const actual = [...adapter.actualValues()];
      const expected = [...this.reference];
      if (adapter.unorderedContents) {
        actual.sort(ascending);
        expected.sort(ascending);
      }
      const problems = adapter.executionProblems();
      const ok = checked && joined(actual) === joined(expected) && problems.length === 0;
      recorder.steps.add(recorder.snapshot());
      const returnsVoid = descriptor.returns === 'void';
      const label = `${name}(${args.map((arg, i) => showTyped(arg, descriptor.params[i].type)).join(', ')})`;
      let verdict;
      if (!ok) verdict = `CHECK FAILED${problems.map(problem => ` (${problem})`).join('')}`;
      else if (canVerify) verdict = 'checked';
      else verdict = 'not automatically verified';
      const text = `${label} ${returnsVoid ? 'completed' : `⇒ ${showTyped(result, descriptor.returns)}`} · ${verdict}`;
      recorder.end(result, ok, returnsVoid, text);
      if (!ok) {
        stoppedEarly = completed < commands.length;
        break;
      }
    }
    return {
      ...this.envelope(recorder.steps),
      calls: {planned: commands.length, completed, stoppedEarly, fromEmpty},
    };
  }

  runtimeFailure(error) {
    let line = Diagnostics.currentLine;
    const frames = studentFrames(error);
    if (frames.length && line === null) line = frames[0].line;
    let message;
    if (error instanceof RequestError) message = error.toString();
    else if (error instanceof TraceLimitReached) message = error.message;
    else if (error instanceof Error) message = error.message ? `${error.name}: ${error.message}` : error.name;
    else message = `Uncaught ${format('%o', error)}`;
    const result = {kind: 'runtime', message: message.slice(0, 2000)};
    if (line !== null) result.line = line;
    if (Diagnostics.currentTraceIndex !== null) result.traceIndex = Diagnostics.currentTraceIndex;
    if (frames.length) {
      const file = this.sourcePath.split(/[\\/]/).pop();
      result.stack = frames.slice(0, 8).map(frame => `${frame.name} (${file}:${frame.line})`);
    }
    return result;
  }
}

const FRAME = /\(?(file:\/\/\S*\/structure\.mjs):(\d+):(\d+)\)?$/;
const FUNCTION = /^at\s+(?:async\s+)?(?:new\s+)?(.+?)\s+\(/;

/** The frames of an exception in the student's file, innermost first. */
function studentFrames(error) {
  const stack = typeof error?.stack === 'string' ? error.stack.split('\n') : [];
  const frames = [];
  for (const raw of stack.slice(0, 400)) {
    const frame = raw.trim();
    const match = FRAME.exec(frame);
    if (!match) continue;
    const name = (FUNCTION.exec(frame)?.[1] ?? 'student code').replace(/^Proxy\./, '').replace(/^.*\./, '');
    frames.push({name, line: Number(match[2])});
  }
  return frames;
}

// ------------------------------------------------------------------ main loop

/** console.* of student code → studentOutput messages, bounded. */
class StudentOutput {
  constructor() {
    this.pending = '';
    this.count = 0;
    this.bytes = 0;
    this.truncated = false;
  }

  write(text) {
    this.pending += String(text);
    let newline;
    while ((newline = this.pending.indexOf('\n')) >= 0) {
      this.emit(this.pending.slice(0, newline));
      this.pending = this.pending.slice(newline + 1);
    }
  }

  finish() {
    if (this.pending) {
      this.emit(this.pending);
      this.pending = '';
    }
  }

  emit(text) {
    const size = Buffer.byteLength(text, 'utf8');
    let kind = 'stdout';
    if (this.count < 200 && this.bytes + size <= 65536) {
      this.count++;
      this.bytes += size;
    } else if (!this.truncated) {
      this.truncated = true;
      kind = 'warning';
      text = 'Further print output was truncated.';
    } else {
      return;
    }
    post({type: 'studentOutput', kind, text, line: Diagnostics.currentLine, traceIndex: Diagnostics.currentTraceIndex});
  }
}

// The protocol uses fd 1 directly; student output never reaches it.
let output = null;
const studentConsole = (...args) => output?.write(`${format(...args)}\n`);
for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace']) console[method] = studentConsole;
process.stdout.write = text => {
  output?.write(String(text));
  return true;
};

function describeStartupFailure(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : `Uncaught ${format('%o', error)}`;
  const failure = {kind: 'runtime', message: message.slice(0, 2000)};
  const frames = studentFrames(error);
  if (frames.length) failure.line = frames[0].line;
  return failure;
}

async function start(directory) {
  const build = JSON.parse(readFileSync(`${directory}/build.json`, 'utf8'));
  const module = await import(pathToFileURL(`${directory}/structure.mjs`).href);
  const cls = module[EXPORT_NAME];
  if (typeof cls !== 'function') throw new Error(`The class ${build.className} was not found.`);
  return new Session(directory, cls, build);
}

const directory = process.argv[2];
if (!directory || process.argv.length !== 3) {
  process.stderr.write('usage: sandbox_worker.mjs BUILD_DIRECTORY\n');
  process.exit(64);
}

let session;
try {
  session = await start(directory);
} catch (error) {
  process.stderr.write(`${error?.stack ?? error}\n`);
  const failure = describeStartupFailure(error);
  post({type: 'error', error: failure, message: failure.message});
  process.exit(0);
}
post({type: 'hello', trace: session.initial()});

for (;;) {
  const raw = readLine();
  if (raw === null) break;
  if (!raw.trim()) continue;
  Diagnostics.reset();
  output = new StudentOutput();
  try {
    const message = JSON.parse(raw);
    if (!message || typeof message !== 'object' || Array.isArray(message)) throw new RequestError('Invalid request');
    if (message.action === 'ping') {
      post({type: 'pong'});
      continue;
    }
    if (message._diagnostics === true) {
      let last = -Infinity;
      Diagnostics.onLine = (line, traceIndex) => {
        const now = performance.now();
        if (now - last < 50) return;
        last = now;
        post({type: 'executionProgress', line, traceIndex});
      };
    }
    const response = session.execute(message);
    output.finish();
    output = null;
    post(response);
  } catch (error) {
    output?.finish();
    output = null;
    process.stderr.write(`Student execution failed: ${error?.message ?? error}\n`);
    post({type: 'error', error: session.runtimeFailure(error), message: String(error)});
  } finally {
    output = null;
    Diagnostics.onLine = null;
  }
}
process.exit(0);
