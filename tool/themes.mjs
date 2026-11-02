// Generates the color themes students choose with the swatches next to the
// light/dark switch:
//
//   node tool/themes.mjs web/style.css web/themes.css
//
// style.css is the dark theme Midnight; light.css (tool/light-theme.mjs) is
// the plain light theme underneath the light themes. A theme does not just
// turn every hue: each color of style.css is sorted into a role, and the
// theme decides each role on its own:
//   neutrals   blue-grey surfaces, borders and muted text: the theme's tint
//   accents    saturated blues (buttons, references, nodes, selections)
//   present    the violet of calls whose argument is already stored: it must
//              stay distinct from the accent, so a theme may move it
//   highlight  the gold/orange of changing values and focus; it stays orange,
//              and in light themes a vivid mid orange instead of brown
//   meaning    greens, reds, purples and syntax colors keep their hue
// Lightness stays (dark) or is mirrored like light.css (light), so contrast
// keeps working. Each theme repeats every colored declaration under its scope.
import fs from 'node:fs';
import { COLOR, format, fromOklab, inGamut, parseColor, parseBlock, toOklab } from './light-theme.mjs';

// The first theme of each mode is its default. neutral/accent: an OKLab hue
// and a chroma factor (neutral.depth: a lightness factor for dark surfaces);
// present: a hue for the "already stored" violet.
export const THEMES = {
  // Each is named after a side character or object of a film whose colors it
  // borrows; the first of each mode is its default.
  dark: [
    // Mulholland Drive's club: night blue with orange stage light (style.css
    // as written).
    { id: 'silencio', label: 'Silencio' },
    // Interstellar's robot: brushed steel grey with a soft steel-cyan accent.
    { id: 'tars', label: 'TARS', neutral: { hue: 245, chroma: 0.16 }, accent: { hue: 215, chroma: 0.55 } },
    // WarGames' computer: a dark terminal with muted phosphor green (yellower
    // than the mint of a passed check).
    { id: 'wopr', label: 'WOPR', neutral: { hue: 145, chroma: 0.3, depth: 0.92 }, accent: { hue: 140, chroma: 0.85 } },
    // The Godfather's capo: sepia shadows with deep wine.
    { id: 'clemenza', label: 'Clemenza', neutral: { hue: 58, chroma: 0.75 }, accent: { hue: 12, chroma: 0.72 } },
  ],
  light: [
    // The Breakfast Club's school library: warm cream and wood, indigo ink.
    { id: 'shermer', label: 'Shermer', neutral: { hue: 75, chroma: 0.75 }, accent: { hue: 282, chroma: 1 },
      present: { hue: 350 } },
    // Dirty Dancing's summer resort: peach and rose at sunset, berry.
    { id: 'kellermans', label: "Kellerman's", neutral: { hue: 22, chroma: 0.85 }, accent: { hue: 0, chroma: 1.05 } },
    // The Shining's cook, in the snowbound Overlook: icy blue; its orange
    // carpet is the highlight.
    { id: 'hallorann', label: 'Hallorann', neutral: { hue: 228, chroma: 1.15 }, accent: { hue: 245, chroma: 1 } },
    // The Toxic Avenger: toxic green with teal.
    { id: 'toxie', label: 'Toxie', neutral: { hue: 128, chroma: 1.3 }, accent: { hue: 182, chroma: 1 } },
  ],
};

const degrees = (a, b) => (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
const polar = (chroma, hue) => [chroma * Math.cos(hue * Math.PI / 180), chroma * Math.sin(hue * Math.PI / 180)];

/** neutral, accent, highlight or meaning, from the color in style.css. */
function role(chroma, hue) {
  if (hue >= 35 && hue <= 105 && chroma > 0.035) return 'highlight';
  // Neutrals are the blue-greys (and near greys); a muted green or red still
  // means something (a passed check, an error) and keeps its hue.
  if (chroma < 0.02 || (chroma < 0.05 && hue >= 180 && hue <= 320)) return 'neutral';
  if (hue >= 200 && hue <= 285) return 'accent';
  if (hue > 285 && hue <= 330) return 'present';
  return 'meaning';
}

function clamped(L, a, b) {
  let factor = 1, out = fromOklab([L, a, b]);
  while (!inGamut(out) && factor > 0.02) { factor *= 0.93; out = fromOklab([L, a * factor, b * factor]); }
  return out.map(v => Math.round(Math.min(255, Math.max(0, v))));
}

// In light themes only these properties turn the gold into a vivid orange:
// lines and markers. Fills and text keep light.css's readable mirror (a tan
// node fill with dark text, dark method names), or orange would meet orange.
const LINE = /^(stroke|outline|border|box-shadow|--gold)/;

/** The theme's color for one color of the dark stylesheet, in [property]. */
export function themeColor(rgb, mode, theme, property = 'stroke') {
  const [L, a, b] = toOklab(rgb);
  const chroma = Math.hypot(a, b), hue = degrees(a, b), kind = role(chroma, hue);
  // Light themes mirror the lightness exactly like light.css.
  let light = mode === 'light' ? Math.min(0.985, Math.max(0.12, 1.13 - 0.95 * L)) : L;
  let c = chroma, h = hue;
  if (kind === 'neutral' && theme.neutral) {
    h = theme.neutral.hue + (hue - 255) * 0.2;
    c = chroma * theme.neutral.chroma;
    // A deeper (or lighter) darkness for dark surfaces only: text keeps its
    // lightness, so contrast only grows.
    if (mode === 'dark' && theme.neutral.depth && L < 0.5) light = L * theme.neutral.depth;
  } else if (kind === 'accent' && theme.accent) {
    h = theme.accent.hue + (hue - 255) * 0.25;
    c = chroma * theme.accent.chroma;
  } else if (kind === 'present' && theme.present) {
    h = theme.present.hue + (hue - 297) * 0.3;
  } else if (kind === 'highlight' && mode === 'light' && LINE.test(property)) {
    // Mirrored, the gold would turn brown: keep a vivid mid orange.
    light = Math.min(0.84, Math.max(0.66, light));
    c = Math.max(chroma, 0.15);
  }
  // Very light colors are backgrounds: keep them calm (as light.css does).
  // The highlight stays orange there too (a pale orange notice, not beige).
  if (mode === 'light' && light > 0.85 && kind !== 'highlight') c *= 0.55;
  return clamped(light, ...polar(c, h));
}

function themeValue(property, value, mode, theme) {
  if (property === 'color-scheme') return mode === 'light' ? value.replace(/\bdark\b/, 'light') : value;
  const shadow = /shadow$/.test(property);
  return value.replace(COLOR, literal => {
    const color = parseColor(literal);
    if (!color) return literal;
    if (mode === 'light' && shadow && toOklab(color.rgb)[0] < 0.5) {
      // Soft shadows as in light.css, in the theme's own tint.
      return format({ rgb: themeColor([40, 56, 84], 'dark', theme), alpha: Math.min(1, color.alpha * 0.35) });
    }
    const rgb = themeColor(color.rgb, mode, theme, property);
    const opaque = mode === 'light' && color.alpha > 0.5 && color.alpha < 1 && toOklab(rgb)[0] > 0.85;
    return format({ rgb, alpha: opaque ? 1 - (1 - color.alpha) * 0.4 : color.alpha });
  });
}

function scope(selectorList, mode, id) {
  const root = `:root[data-theme="${mode}"][data-palette="${id}"]`;
  return selectorList.split(',').map(s => s.trim()).filter(Boolean).map(s =>
    s.startsWith(':root') ? s.replace(':root', root) :
      /^html\b/.test(s) ? s.replace(/^html/, `html[data-theme="${mode}"][data-palette="${id}"]`) :
        `${root} ${s}`).join(',');
}

/**
 * Every colored declaration under the theme's scope. Not only the changed
 * ones: the scope raises the specificity of each rule, so a theme that wrote
 * only its changes would let a general rule of its own (.node .card) beat a
 * more specific base rule it left out (.node.hot .card).
 */
function themed(rules, mode, theme, indent = '') {
  const lines = [];
  for (const rule of rules) {
    if (rule.media) {
      const inner = themed(rule.rules, mode, theme, `${indent}  `);
      if (inner.length) lines.push(`${indent}${rule.media}{`, ...inner, `${indent}}`);
      continue;
    }
    const declarations = [];
    for (const declaration of rule.declarations.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim(), value = declaration.slice(colon + 1).trim();
      if (!value.match(COLOR)) continue;
      declarations.push(`${property}:${themeValue(property, value, mode, theme)}`);
    }
    if (declarations.length) lines.push(`${indent}${scope(rule.selector, mode, theme.id)}{${declarations.join(';')}}`);
  }
  return lines;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: node themes.mjs style.css themes.css');
    process.exit(64);
  }
  const rules = parseBlock(fs.readFileSync(input, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
  const lines = [`/* Color themes, generated from ${input.split('/').pop()} by themes.mjs. Do not edit: run the script again. */`];
  // The page reads the themes of each mode from these lists (the first is
  // the default) and colors each swatch with its panel, accent and highlight.
  lines.push(`:root{${Object.entries(THEMES).map(([mode, list]) =>
    `--themes-${mode}:"${list.map(theme => `${theme.id}:${theme.label}`).join(',')}"`).join(';')}}`);
  const sample = { panel: [17, 28, 45], node: [27, 52, 85], accent: [68, 132, 229], highlight: [247, 191, 97] };
  for (const [mode, list] of Object.entries(THEMES)) {
    for (const theme of list) {
      lines.push(`[data-swatch-mode="${mode}"][data-swatch="${theme.id}"]{${Object.entries(sample)
        .map(([name, rgb]) => `--swatch-${name}:${format({ rgb: themeColor(rgb, mode, theme), alpha: 1 })}`).join(';')}}`);
    }
  }
  // The default dark theme is style.css itself; light.css is the plain
  // light theme underneath (and the fallback without themes.css).
  for (const theme of THEMES.dark.slice(1)) lines.push(...themed(rules, 'dark', theme));
  for (const theme of THEMES.light) lines.push(...themed(rules, 'light', theme));
  fs.writeFileSync(output, `${lines.join('\n')}\n`);
  console.log(`${output} written`);
}
