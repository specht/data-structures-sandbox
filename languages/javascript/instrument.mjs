// The instrumented copy of a JavaScript data structure (structure.mjs).
//
// Mirrors tool/instrument.dart: every method of the student's class gets a
// line event on entry, and every variable declaration, expression, return,
// if and loop statement gets one before it runs (loops also once per
// iteration). Insertions never contain line breaks, so the line numbers are
// the student's own. The `sandbox` import points at the sandbox runtime and
// one export line is appended. Uses the vendored acorn and eslint-scope.
import {pathToFileURL} from 'node:url';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

import * as acorn from '../../vendor/javascript/acorn/index.js';
import * as walk from '../../vendor/javascript/acorn-walk/index.js';
import * as eslintScope from '../../vendor/javascript/eslint-scope/index.js';

export const API_MODULE = 'sandbox';
export const EXPORT_NAME = '__sandboxStructure';
const HERE = fileURLToPath(new URL('.', import.meta.url));
export const RUNTIME_URL = pathToFileURL(realpathSync(`${HERE}sandbox.mjs`)).href;

export function diagnostic(line, column, length, message) {
  return {line: Math.max(1, line || 1), column: Math.max(1, column || 1),
    length: Math.max(1, Math.min(40, length || 1)), message, severity: 'error'};
}

export function parse(source) {
  return acorn.parse(source, {ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true});
}

export function syntaxDiagnostic(error) {
  const message = String(error.message).replace(/\s*\(\d+:\d+\)$/, '');
  return error.loc ? diagnostic(error.loc.line, error.loc.column + 1, 1, message) : diagnostic(1, 1, 1, message);
}

/** The top-level class [className] (also `export class` / `export default class`). */
export function findClass(ast, className) {
  const found = [];
  for (const statement of ast.body) {
    const declaration = statement.type === 'ExportDefaultDeclaration' || statement.type === 'ExportNamedDeclaration'
      ? statement.declaration : statement;
    if (declaration?.type === 'ClassDeclaration' && declaration.id?.name === className) found.push(declaration);
  }
  return found;
}

const KNOWN_GLOBALS = new Set([...Object.getOwnPropertyNames(globalThis), 'console', 'process', 'Buffer']);

/** Names that are used but never declared (typos like `lenght`). */
export function staticErrors(ast) {
  const manager = eslintScope.analyze(ast, {ecmaVersion: 2022, sourceType: 'module'});
  const typeofArguments = new Set();
  walk.full(ast, node => {
    if (node.type === 'UnaryExpression' && node.operator === 'typeof' && node.argument.type === 'Identifier') {
      typeofArguments.add(node.argument);
    }
  });
  const result = [];
  for (const reference of manager.globalScope.through) {
    const identifier = reference.identifier;
    if (KNOWN_GLOBALS.has(identifier.name) || typeofArguments.has(identifier)) continue;
    result.push(diagnostic(identifier.loc.start.line, identifier.loc.start.column + 1,
      identifier.name.length, `${identifier.name} is not defined.`));
    if (result.length >= 30) break;
  }
  return result;
}

/** Import problems: only "sandbox" and Node built-ins can be imported. */
export function importProblems(ast) {
  const result = [];
  for (const statement of ast.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const source = String(statement.source.value);
    if (source !== API_MODULE && !source.startsWith('node:')) {
      const {line, column} = statement.source.loc.start;
      result.push(diagnostic(line, column + 1, source.length + 2,
        `Only "${API_MODULE}" and Node built-ins ("node:…") can be imported: the sandbox runs a copy of this file.`));
    }
  }
  return result;
}

const keyName = member => (member.computed ? null : member.key.type === 'Identifier' ? member.key.name
  : member.key.type === 'Literal' ? String(member.key.value) : member.key.type === 'PrivateIdentifier' ? null : null);

/** {name: {line, params}} of the instrumented methods; params holds the
 *  parameter names, or null when a parameter has a default value, is a rest
 *  parameter or is destructured (such methods cannot be called from the browser). */
export function methodInfo(cls) {
  const result = {};
  for (const member of cls.body.body) {
    if (member.type === 'MethodDefinition' && member.kind === 'method' && !member.static) {
      const name = keyName(member);
      if (!name) continue;
      const params = member.value.params;
      result[name] = {line: member.loc.start.line,
        params: params.every(param => param.type === 'Identifier') ? params.map(param => param.name) : null};
    }
  }
  return result;
}

function patternNames(pattern, out) {
  if (!pattern) return out;
  switch (pattern.type) {
    case 'Identifier': out.push(pattern.name); break;
    case 'ObjectPattern':
      for (const property of pattern.properties) patternNames(property.type === 'RestElement' ? property.argument : property.value, out);
      break;
    case 'ArrayPattern': for (const element of pattern.elements) patternNames(element, out); break;
    case 'RestElement': patternNames(pattern.argument, out); break;
    case 'AssignmentPattern': patternNames(pattern.left, out); break;
  }
  return out;
}

function declaredNames(statement, out) {
  if (statement.type === 'VariableDeclaration') {
    for (const declarator of statement.declarations) patternNames(declarator.id, out);
  }
  return out;
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const LOOP_TYPES = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);
const TRACED = new Set(['VariableDeclaration', 'ExpressionStatement', 'ReturnStatement', 'IfStatement', ...LOOP_TYPES]);

/** Local variables (not parameters) visible at [position] inside a method. */
function visibleNames(ancestors, position) {
  const names = [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (node.type === 'BlockStatement') {
      for (const child of node.body) {
        if (child.start >= position) break;
        declaredNames(child, names);
      }
    } else if (node.type === 'SwitchCase') {
      for (const switchCase of ancestors[i - 1].cases) {
        for (const child of switchCase.consequent) {
          if (child.start >= position) break;
          declaredNames(child, names);
        }
      }
    } else if (node.type === 'ForStatement' && node.init?.type === 'VariableDeclaration' && node.init.start < position) {
      declaredNames(node.init, names);
    } else if ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && node.left.type === 'VariableDeclaration') {
      declaredNames(node.left, names);
    } else if (node.type === 'CatchClause' && node.param) {
      patternNames(node.param, names);
    } else if (FUNCTION_TYPES.has(node.type)) {
      break;
    }
  }
  return [...new Set(names)].filter(name => !name.startsWith('__'));
}

function checkpoint(line, names) {
  const getters = names.map(name => `[${JSON.stringify(name)}, () => ${name}]`).join(', ');
  return `__sandbox.at(${line}, __frame, () => [${getters}]); `;
}

function applyEdits(source, edits) {
  const ordered = edits.map((edit, order) => ({...edit, order})).sort((a, b) => b.at - a.at || b.order - a.order);
  let out = source;
  for (const edit of ordered) out = out.slice(0, edit.at) + edit.text + out.slice(edit.at + (edit.remove ?? 0));
  return out;
}

export function structureCopy(source, ast, cls) {
  const edits = [];
  for (const statement of ast.body) {
    if (statement.type === 'ImportDeclaration' && statement.source.value === API_MODULE) {
      edits.push({at: statement.source.start, remove: statement.source.end - statement.source.start,
        text: JSON.stringify(RUNTIME_URL)});
    }
  }

  const instrumentBody = (body, methodLine) => {
    edits.push({at: body.start + 1, text: ` const __frame = __sandbox.enter(${methodLine}); `});
    const ancestors = [];

    const before = (statement, wrap) => {
      const text = checkpoint(statement.loc.start.line, visibleNames(ancestors, statement.start));
      if (wrap) {
        edits.push({at: statement.start, text: `{ ${text}`});
        edits.push({at: statement.end, text: ' }'});
      } else {
        edits.push({at: statement.start, text});
      }
    };

    // A traced statement where only one statement is allowed (if/else):
    // braces around it and its checkpoint, as in the Dart instrumenter.
    const single = statement => {
      if (statement && statement.type !== 'BlockStatement' && TRACED.has(statement.type)) before(statement, true);
    };

    const loopIteration = loop => {
      const names = visibleNames(ancestors, loop.body.start);
      const text = checkpoint(loop.loc.start.line, names);
      if (loop.body.type === 'BlockStatement') {
        edits.push({at: loop.body.start + 1, text: ` ${text}`});
      } else {
        edits.push({at: loop.body.start, text: `{ ${text}`});
        edits.push({at: loop.body.end, text: ' }'});
      }
    };

    const visit = node => {
      if (!node || typeof node.type !== 'string') return;
      if (FUNCTION_TYPES.has(node.type)) return; // Nested functions run without line events.
      ancestors.push(node);
      if (node.type === 'BlockStatement') {
        for (const statement of node.body) if (TRACED.has(statement.type)) before(statement, false);
      } else if (node.type === 'SwitchCase') {
        for (const statement of node.consequent) if (TRACED.has(statement.type)) before(statement, false);
      } else if (node.type === 'IfStatement') {
        single(node.consequent);
        single(node.alternate);
      } else if (LOOP_TYPES.has(node.type)) {
        // A traced statement as a loop body: its iteration line comes first.
        loopIteration(node);
        if (node.body.type !== 'BlockStatement' && TRACED.has(node.body.type)) {
          edits.push({at: node.body.start, text: checkpoint(node.body.loc.start.line,
            visibleNames(ancestors, node.body.start))});
        }
      }
      for (const [field, value] of Object.entries(node)) {
        if (field === 'loc' || field === 'range' || field === 'start' || field === 'end') continue;
        if (Array.isArray(value)) {
          for (const child of value) if (child && typeof child.type === 'string') visit(child);
        } else if (value && typeof value.type === 'string') {
          visit(value);
        }
      }
      ancestors.pop();
    };
    visit(body);
  };

  for (const member of cls.body.body) {
    if (member.type !== 'MethodDefinition' || member.kind !== 'method' || member.static) continue;
    instrumentBody(member.value.body, member.loc.start.line);
  }
  return `${applyEdits(source, edits)}\nexport { ${cls.id.name} as ${EXPORT_NAME} };\n`;
}
