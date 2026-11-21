#!/usr/bin/env node
// Theme guard: verifies the espresso-cream design tokens in src/styles.css.
// Contract: exits 0 and prints "theme OK" when every token exists and every
// contrast pair passes; exits 1 with a list of failures otherwise.
import { readFileSync, readdirSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
const tokens = {};
if (rootMatch) {
  for (const [, name, value] of rootMatch[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
}
const cssOutsideRoot = rootMatch ? css.replace(rootMatch[0], '') : css;

const REQUIRED = [
  '--bg', '--surface', '--surface-tint', '--surface-selected',
  '--text', '--text-muted', '--primary', '--primary-hover', '--on-primary',
  '--border', '--border-strong', '--danger', '--danger-bg',
  '--ok-bg', '--ok-text', '--warn-bg', '--warn-text', '--ring',
  '--ring-soft', '--backdrop', '--shadow-danger-sm', '--shadow-danger-md',
  '--radius', '--radius-lg', '--radius-pill', '--shadow-sm', '--shadow-md', '--shadow-lg',
];

function luminance(hex) {
  const channels = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!channels) throw new Error(`not a 6-digit hex color: ${hex}`);
  const [r, g, b] = channels.slice(1).map((c) => {
    const c88 = parseInt(c, 16) / 255;
    return c88 <= 0.04045 ? c88 / 12.92 : ((c88 + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fgHex, bgHex) {
  const [l1, l2] = [luminance(fgHex), luminance(bgHex)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [foreground token or literal, background token, minimum ratio, label]
const PAIRS = [
  ['--text', '--bg', 4.5, 'text on bg'],
  ['--text', '--surface', 4.5, 'text on surface'],
  ['--text-muted', '--bg', 4.5, 'muted text on bg'],
  ['--text-muted', '--surface', 4.5, 'muted text on surface'],
  ['--on-primary', '--primary', 4.5, 'on-primary on primary'],
  ['--on-primary', '--primary-hover', 4.5, 'on-primary on primary-hover'],
  ['#ffffff', '--danger', 4.5, 'white on danger'],
  ['--danger', '--danger-bg', 4.5, 'danger text on danger-bg'],
  ['--ok-text', '--ok-bg', 4.5, 'ok text on ok-bg'],
  ['--warn-text', '--warn-bg', 4.5, 'warn text on warn-bg'],
  ['--border-strong', '--surface', 3, 'border-strong vs surface'],
  ['--border-strong', '--bg', 3, 'border-strong vs bg'],
  ['--ring', '--bg', 3, 'ring vs bg'],
  ['--primary', '--surface', 3, 'primary vs surface'],
];

const failures = [];

// Color-literal patterns that must never appear outside the :root token block.
const HEX = /#[\da-fA-F]{3,8}\b/;
const FUNC = /\b(?:rgb|rgba|hsl|hsla)\(/;
const NAMED = new RegExp(
  '(?:color|background)[a-z-]*\\s*:\\s*(black|white|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|tan|gold|silver|cream|beige|navy|teal|olive|maroon|coral|salmon|cyan|magenta|violet|chocolate|coffee|wheat|ivory|khaki|linen|turquoise|crimson|azure|indigo|lavender|plum|sienna)\\s*[;\'"}]',
);

function scan(label, source, checks) {
  for (const [index, line] of source.split('\n').entries()) {
    for (const [name, pattern] of checks) {
      if (pattern.test(line)) failures.push(`${label}:${index + 1}: ${name} → ${line.trim()}`);
    }
  }
}

// 1) src/styles.css outside :root — every color must flow through a token.
scan('styles.css(outside :root)', cssOutsideRoot, [['hex color', HEX], ['rgb()/hsl() literal', FUNC], ['named color', NAMED]]);

// 2) Components and static assets — same rules.
function walk(dir) {
  const url = new URL(dir, import.meta.url);
  return readdirSync(url, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const checks = [['hex color', HEX], ['rgb()/hsl() literal', FUNC], ['named color', NAMED]];
const componentFiles = [
  ...walk('../src/app').filter((f) => f.endsWith('.ts') || f.endsWith('.css')),
  '../src/index.html',
  ...walk('../public').filter((f) => /\.(?:html|css|svg|js|txt|json)$/.test(f)),
];
for (const file of componentFiles) {
  scan(file, readFileSync(new URL(file, import.meta.url), 'utf8'), checks);
}

for (const name of REQUIRED) {
  if (!(name in tokens)) failures.push(`missing token: ${name}`);
}
for (const [fg, bg, min, label] of PAIRS) {
  const fgHex = fg.startsWith('#') ? fg : tokens[fg];
  const bgHex = tokens[bg];
  if (!fgHex || !bgHex) { failures.push(`uncheckable pair (missing token): ${label}`); continue; }
  let ratio;
  try { ratio = contrast(fgHex, bgHex); }
  catch (error) { failures.push(`${label}: ${error.message}`); continue; }
  const pass = ratio >= min;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${ratio.toFixed(2)}:1 (min ${min}:1)`);
  if (!pass) failures.push(`${label}: ${ratio.toFixed(2)}:1 < ${min}:1 (${fgHex} on ${bgHex}) — darken the foreground within the warm hue family`);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('theme OK');
