#!/usr/bin/env node
/* ============================================================================
 * DoKit — i18n coverage checker (scripts/i18n-check.js)
 * ----------------------------------------------------------------------------
 * Phase 3 future-proof safeguard. Run:  node scripts/i18n-check.js
 *
 * What it does:
 *   1. Loads the core engine (js/i18n-v2.js) in a mocked browser env and reads
 *      the merged dictionary (base literal + all trailing DKI18N.add calls).
 *   2. Loads every supplemental js/i18n-*.js dict via the same mock.
 *   3. Extracts per-tool dictionaries from tools/[name]/tool.js
 *      (window.DKI18N.add("xx", {...}) blocks).
 *   4. Scans every *.html for data-i18n / data-i18n-ph / data-i18n-title /
 *      data-i18n-aria attributes.
 *   5. Reports, per language vs English: missing keys, empty translations,
 *      and keys defined in multiple source files.
 *   6. FAILS (exit 1) when English itself is missing a key used in HTML, or
 *      when any language ships an empty translation. Missing non-English
 *      keys are warnings (English fallback covers them) — EXCEPT the
 *      homepage tool-card keys (tool_*) which fail the build, because a
 *      missing tool name was the original production incident.
 *
 * Non-destructive: reads files only, never writes.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LANGS = ['en','ur','ar','hi','es','fr','pt','de','tr','ru'];
const realLog = console.log.bind(console);
const realErr = console.error.bind(console);
// dict[lang][key] = value ; src[lang][key] = Set of source files (all registrations)
const dict = {}; const src = {};
for (const l of LANGS) { dict[l] = {}; src[l] = {}; }

function record(lang, obj, file) {
  if (LANGS.indexOf(lang) < 0 || !obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] !== 'string') continue;
    if (!src[lang][k]) src[lang][k] = new Set();
    src[lang][k].add(file);
    dict[lang][k] = obj[k]; // last registration wins (matches runtime)
  }
}

/* ---- mocked browser env ------------------------------------------------ */
function makeEnv() {
  const store = {};
  const listeners = {};
  global.window = global;
  global.document = {
    documentElement: {},
    querySelectorAll: () => [],
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    dispatchEvent: () => true,
  };
  global.CustomEvent = function (t, o) { this.type = t; this.detail = (o || {}).detail; };
  global.URLSearchParams = function () { this.get = () => null; };
  global.window.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
  const warns = [];
  global.console = { warn: (...a) => warns.push(a.join(' ')), log: () => {}, error: () => {} };
  return { warns };
}

/* ---- 1+2. core engine + supplemental dicts ------------------------------ */
(function loadCore() {
  makeEnv();
  const calls = [];
  // Pre-seed a recording DKI18N so i18n-v2.js's trailing adds are captured;
  // i18n-v2.js itself overwrites window.DKI18N, so we hook after eval too.
  eval(fs.readFileSync(path.join(ROOT, 'js/i18n-v2.js'), 'utf8'));
  // After eval, DKI18N.dict holds the fully merged core dict.
  const D = (global.DKI18N && global.DKI18N.dict) || {};
  for (const l of Object.keys(D)) record(l, D[l], 'js/i18n-v2.js');
  // Supplemental files: fresh mock that only records add() calls.
  makeEnv();
  global.DKI18N = { add: (l, o) => record(l, o, 'supplemental'), langs: LANGS.slice() };
  const files = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(f => /^i18n-.+\.js$/.test(f) && f !== 'i18n-v2.js')
    .sort();
  for (const f of files) {
    try { eval(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')); }
    catch (e) {  }
    // tag source file for keys added by this file (best effort)
  }
  // Re-tag: re-run per file with its own recorder for accurate src
  for (const l of LANGS) { dict[l] = {}; src[l] = {}; }
  makeEnv();
  eval(fs.readFileSync(path.join(ROOT, 'js/i18n-v2.js'), 'utf8'));
  const D2 = (global.DKI18N && global.DKI18N.dict) || {};
  for (const l of Object.keys(D2)) record(l, D2[l], 'js/i18n-v2.js');
  for (const f of files) {
    makeEnv();
    global.DKI18N = { add: (l, o) => record(l, o, 'js/' + f), langs: LANGS.slice() };
    try { eval(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')); } catch (e) { /* ignore */ }
  }
})();

/* ---- 2b. typing section dict (typing/js/urdu.js — separate I18N system) -- */
(function loadTyping() {
  const p = path.join(ROOT, 'typing/js/urdu.js');
  if (!fs.existsSync(p)) return;
  const srcText = fs.readFileSync(p, 'utf8');
  const m = srcText.match(/const I18N\s*=\s*\{/);
  if (!m) return;
  let start = m.index + m[0].length - 1, depth = 0, end = -1, instr = false, esc = false, q = '';
  for (let i = start; i < srcText.length; i++) {
    const ch = srcText[i];
    if (instr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === q) instr = false;
    } else {
      if (ch === '"' || ch === "'") { instr = true; q = ch; }
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
  }
  if (end < 0) return;
  try {
    const TI = eval('(' + srcText.slice(start, end + 1) + ')');
    for (const l of Object.keys(TI)) record(l, TI[l], 'typing/js/urdu.js');
  } catch (e) { /* unparsable — skip */ }
})();

/* ---- 3. per-tool dicts --------------------------------------------------- */
function extractAdds(jsSrc) {
  // Find window.DKI18N.add("xx", {...}) blocks via brace matching.
  const out = [];
  const re = /DKI18N\.add\(\s*["']([a-z]{2})["']\s*,\s*\{/g;
  let m;
  while ((m = re.exec(jsSrc))) {
    const lang = m[1];
    let start = m.index + m[0].length - 1; // at '{'
    let depth = 0, end = -1, instr = false, esc = false, q = '';
    for (let i = start; i < jsSrc.length; i++) {
      const ch = jsSrc[i];
      if (instr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === q) instr = false;
      } else {
        if (ch === '"' || ch === "'") { instr = true; q = ch; }
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
    }
    if (end > 0) {
      try { out.push([lang, eval('(' + jsSrc.slice(start, end + 1) + ')')]); }
      catch (e) { /* unparsable block — skip */ }
    }
  }
  return out;
}
(function loadTools() {
  const toolsDir = path.join(ROOT, 'tools');
  if (!fs.existsSync(toolsDir)) return;
  for (const t of fs.readdirSync(toolsDir).sort()) {
    const p = path.join(toolsDir, t, 'tool.js');
    if (!fs.existsSync(p)) continue;
    const srcText = fs.readFileSync(p, 'utf8');
    for (const [lang, obj] of extractAdds(srcText)) record(lang, obj, 'tools/' + t + '/tool.js');
  }
})();

/* ---- 4. HTML data-i18n scan ---------------------------------------------- */
const htmlKeys = new Set();
(function scanHtml() {
  const re = /data-i18n(?:-ph|-title|-aria)?\s*=\s*"([^"]+)"/g;
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (e.name.endsWith('.html')) {
        const html = fs.readFileSync(p, 'utf8');
        let m; while ((m = re.exec(html))) htmlKeys.add(m[1]);
      }
    }
  }
  walk(ROOT);
})();

/* ---- 5. report ------------------------------------------------------------ */
const enKeys = Object.keys(dict.en);
let failures = [];
let warnings = [];

realLog('DoKit i18n coverage check');
realLog('=========================');
realLog('English keys (reference): ' + enKeys.length);
realLog('HTML data-i18n keys used: ' + htmlKeys.size);
realLog('');

// en must cover every HTML key
const enMissingHtml = [...htmlKeys].filter(k => !(k in dict.en));
if (enMissingHtml.length) {
  failures.push('EN missing ' + enMissingHtml.length + ' HTML key(s): ' + enMissingHtml.slice(0, 10).join(', '));
}

// per-language report
for (const l of LANGS) {
  if (l === 'en') continue;
  const missing = enKeys.filter(k => !(k in dict[l]));
  const empty = Object.keys(dict[l]).filter(k => dict[l][k].trim() === '');
  const toolMissing = missing.filter(k => k.indexOf('tool_') === 0);
  realLog(l.padEnd(4) + ' total=' + String(Object.keys(dict[l]).length).padEnd(5) +
    ' missing=' + String(missing.length).padEnd(5) +
    ' empty=' + empty.length +
    (toolMissing.length ? '  <-- TOOL KEYS MISSING: ' + toolMissing.join(',') : ''));
  if (empty.length) failures.push(l + ': ' + empty.length + ' empty translation(s): ' + empty.slice(0, 8).join(', '));
  if (toolMissing.length) failures.push(l + ': missing homepage tool key(s): ' + toolMissing.join(', '));
  if (missing.length) warnings.push(l + ': ' + missing.length + ' key(s) fall back to English');
}

// keys defined in more than one source file (override chains — informational)
let multi = 0;
for (const l of LANGS) for (const k of Object.keys(src[l])) {
  if (src[l][k] && src[l][k].size > 1) multi++;
}
realLog('');
realLog('Keys overridden across files: ' + multi + ' (informational — last registration wins)');

if (warnings.length) { realLog(''); realLog('Warnings:'); warnings.forEach(w => realLog('  ~ ' + w)); }
if (failures.length) {
  realLog(''); realLog('FAILURES:'); failures.forEach(f => realLog('  X ' + f));
  realLog(''); realLog('RESULT: FAIL');
  process.exit(1);
}
realLog(''); realLog('RESULT: PASS');
