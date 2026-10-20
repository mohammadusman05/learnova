// ============================================================
// LINK ACCURACY (TA point 13) — how often are Learnova's prerequisite links right?
//
// 1) Score the portal's links against an answer key written by people:
//      node tools/link-accuracy.mjs <links.csv> <answer-key.csv>
//    links.csv      = the file from Knowledge Graph → "⬇ Links CSV"
//    answer-key.csv = the correct links, one per row: prerequisite,concept
//                     (see tools/link-answer-key-template.csv; write it WITHOUT looking at the portal's graph)
//
// 2) Check how much two people agree before you merge their answer keys:
//      node tools/link-accuracy.mjs --agreement <personA.csv> <personB.csv>
//
// Concept names are matched loosely (case, punctuation, plural "s", and "Full Name (ABBR)" ↔ "ABBR").
// Only the AI's own links are scored: links a person added or flipped are left out;
// links a person removed still count, because the AI made them.
// ============================================================
import fs from 'fs';
import path from 'path';
import { normalizeName } from '../src/conceptExtraction.js';

const args = process.argv.slice(2);
const usage = () => {
  console.log('Score the links:        node tools/link-accuracy.mjs <links.csv> <answer-key.csv>');
  console.log('Agreement of 2 people:  node tools/link-accuracy.mjs --agreement <personA.csv> <personB.csv>');
  process.exit(1);
};

// ── small CSV reader (quotes, commas and new lines inside quotes, Excel BOM) ──
const parseCsv = (text) => {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(c => c.trim()));
  if (!head) return [];
  const h = head.map(x => x.trim().toLowerCase());
  return body.map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] || '').trim()])));
};
const readCsv = (p) => { if (!p || !fs.existsSync(p)) { console.log(`File not found: ${p}`); process.exit(1); } return parseCsv(fs.readFileSync(p, 'utf8')); };
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const writeCsv = (file, rows) => {
  const cols = Object.keys(rows[0] || { note: '' });
  fs.writeFileSync(file, '﻿' + [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n'));
};
const pct = (a, b) => b ? `${Math.round(100 * a / b)}%` : '–';

// ── name matching: every spelling of a concept → one key ──
const keysOf = (name) => {
  const n = String(name || '').trim();
  const out = new Set([normalizeName(n)]);
  const m = n.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) { out.add(normalizeName(m[1])); out.add(normalizeName(m[2])); }
  return [...out].filter(Boolean);
};
const makeResolver = (names) => {
  const map = new Map();
  for (const name of names) for (const k of keysOf(name)) if (!map.has(k)) map.set(k, name);
  return (name) => { for (const k of keysOf(name)) if (map.has(k)) return map.get(k); return null; };
};
const pair = (a, b) => `${a}\u0000${b}`;
const unpair = (p) => p.split('\u0000');
const readKey = (file) => readCsv(file)
  .map(r => ({ pre: r.prerequisite || r.source || r.from || '', con: r.concept || r.target || r.to || '' }))
  .filter(r => r.pre && r.con);

// ============================================================
// MODE 2 — agreement between two people's answer keys
// ============================================================
if (args[0] === '--agreement') {
  const [fa, fb] = args.slice(1);
  if (!fa || !fb) usage();
  const A = readKey(fa), B = readKey(fb);
  const resolve = makeResolver([...A, ...B].flatMap(r => [r.pre, r.con]));
  const setOf = (rows) => new Set(rows.map(r => pair(resolve(r.pre), resolve(r.con))));
  const sa = setOf(A), sb = setOf(B);
  const concepts = new Set([...sa, ...sb].flatMap(unpair));
  const both = [...sa].filter(p => sb.has(p));
  const onlyA = [...sa].filter(p => !sb.has(p)), onlyB = [...sb].filter(p => !sa.has(p));
  const flipped = onlyA.filter(p => { const [x, y] = unpair(p); return sb.has(pair(y, x)); });
  // Cohen's kappa over every ordered pair of concepts (link / no link)
  const n = concepts.size, total = n * (n - 1);
  const a = both.length, b = onlyA.length, c = onlyB.length, d = total - a - b - c;
  const po = total ? (a + d) / total : 0;
  const pe = total ? ((a + b) * (a + c) + (c + d) * (b + d)) / (total * total) : 0;
  const kappa = pe < 1 ? (po - pe) / (1 - pe) : 1;
  console.log(`\nAGREEMENT BETWEEN TWO PEOPLE`);
  console.log(`Person A: ${sa.size} links   Person B: ${sb.size} links   Concepts mentioned: ${n}`);
  console.log(`Both chose the same link:        ${a}   (${pct(a, sa.size + sb.size - a)} of all links either person chose)`);
  console.log(`Only person A:                   ${b}`);
  console.log(`Only person B:                   ${c}`);
  console.log(`Same pair, opposite direction:   ${flipped.length}`);
  console.log(`Cohen's kappa:                   ${kappa.toFixed(2)}   (above 0.6 = good agreement, above 0.8 = very good)`);
  const out = path.join(path.dirname(fb), 'link-agreement-to-discuss.csv');
  writeCsv(out, [
    ...onlyA.map(p => { const [x, y] = unpair(p); return { prerequisite: x, concept: y, chosen_by: 'only person A', note: sb.has(pair(y, x)) ? 'person B has the opposite direction' : '' }; }),
    ...onlyB.map(p => { const [x, y] = unpair(p); return { prerequisite: x, concept: y, chosen_by: 'only person B', note: sa.has(pair(y, x)) ? 'person A has the opposite direction' : '' }; }),
  ]);
  console.log(`\nLinks to discuss and settle (then write one final answer key): ${out}`);
  process.exit(0);
}

// ============================================================
// MODE 1 — score the portal's links against the answer key
// ============================================================
const [linksFile, keyFile] = args;
if (!linksFile || !keyFile) usage();
const links = readCsv(linksFile);
if (!links.length || !('status' in links[0]) || !('prerequisite' in links[0])) { console.log('The first file must be the Links CSV downloaded from the Knowledge Graph screen.'); process.exit(1); }
const keyRows = readKey(keyFile);
if (!keyRows.length) { console.log('The answer key is empty — it needs the columns prerequisite,concept.'); process.exit(1); }

// the AI's links, in two versions
const isPersonMade = (r) => ['added', 'flipped'].includes(r.person_verdict) && r.status === 'active';
const aiAfter = links.filter(r => (r.status === 'active' && !isPersonMade(r)) || r.status === 'removed by person');
const aiFirst = [...aiAfter, ...links.filter(r => r.status === 'dropped by checker')];

// concepts the portal knows (from the CSV) and which PDFs they come from
const pdfsOf = new Map();
for (const r of links) {
  if (!pdfsOf.has(r.prerequisite)) pdfsOf.set(r.prerequisite, r.prerequisite_pdfs || '');
  if (!pdfsOf.has(r.concept)) pdfsOf.set(r.concept, r.concept_pdfs || '');
}
const resolve = makeResolver([...pdfsOf.keys()]);
const unmatched = new Set();
const key = new Set();
for (const r of keyRows) {
  const a = resolve(r.pre), b = resolve(r.con);
  if (!a) unmatched.add(r.pre);
  if (!b) unmatched.add(r.con);
  key.add(pair(a || `?${r.pre}`, b || `?${r.con}`));
}
const keyScorable = new Set([...key].filter(p => !p.includes('\u0000?') && !p.startsWith('?')));
const originOfPair = (p) => {
  const [a, b] = unpair(p);
  const da = (pdfsOf.get(a) || '').split(';').map(s => s.trim()).filter(Boolean);
  const db = (pdfsOf.get(b) || '').split(';').map(s => s.trim()).filter(Boolean);
  if (!da.length || !db.length) return 'unknown';
  return da.some(x => db.includes(x)) ? 'inside one PDF' : 'across PDFs';
};

const score = (rows, filter = () => true) => {
  const made = new Set(rows.map(r => pair(r.prerequisite, r.concept)).filter(filter));
  const truth = new Set([...keyScorable].filter(filter));
  let correct = 0, reversed = 0, wrong = 0;
  for (const p of made) {
    const [a, b] = unpair(p);
    if (truth.has(p)) correct++; else if (truth.has(pair(b, a))) reversed++; else wrong++;
  }
  const found = [...truth].filter(p => made.has(p)).length;
  const P = made.size ? correct / made.size : 0, R = truth.size ? found / truth.size : 0;
  return { made: made.size, correct, reversed, wrong, truth: truth.size, missed: truth.size - found, P, R, F1: P + R ? 2 * P * R / (P + R) : 0 };
};
const show = (title, s) => {
  console.log(`\n${title}`);
  console.log(`  Links made: ${s.made}  ·  right: ${s.correct}  ·  right pair, wrong direction: ${s.reversed}  ·  wrong: ${s.wrong}`);
  console.log(`  Answer-key links: ${s.truth}  ·  found: ${s.truth - s.missed}  ·  missed: ${s.missed}`);
  console.log(`  Precision ${pct(s.correct, s.made)}   Recall ${pct(s.truth - s.missed, s.truth)}   F1 ${s.made || s.truth ? Math.round(100 * s.F1) + '%' : '–'}`);
};

console.log(`\nLINK ACCURACY — ${path.basename(linksFile)} vs ${path.basename(keyFile)}`);
console.log(`Answer key: ${keyRows.length} links (${keyScorable.size} usable)  ·  AI links: ${aiFirst.length} first guesses, ${aiAfter.length} after the checker`);
if (unmatched.size) {
  console.log(`\n⚠ ${unmatched.size} name(s) in the answer key match no concept in the Links CSV: ${[...unmatched].join(' | ')}`);
  console.log(`  Fix the spelling to match the portal, or these concepts were never extracted / never linked (a concept-list issue, point 7).`);
  console.log(`  Links with these names are not scored (${key.size - keyScorable.size} link(s)).`);
}
const before = score(aiFirst), after = score(aiAfter);
show('BEFORE THE CHECKER (first guess only — how Learnova worked before point 12)', before);
show('AFTER THE CHECKER (what the portal saved)', after);
for (const o of ['inside one PDF', 'across PDFs']) {
  const s = score(aiAfter, p => originOfPair(p) === o);
  if (s.made || s.truth) show(`AFTER THE CHECKER — links ${o}`, s);
}

// per-link detail
const rows = [];
const firstSet = new Set(aiFirst.map(r => pair(r.prerequisite, r.concept)));
const afterSet = new Set(aiAfter.map(r => pair(r.prerequisite, r.concept)));
const all = new Set([...firstSet, ...afterSet, ...keyScorable]);
for (const p of all) {
  const [a, b] = unpair(p);
  const inKey = keyScorable.has(p);
  const result = inKey ? (afterSet.has(p) ? 'right' : 'missed')
    : keyScorable.has(pair(b, a)) ? (afterSet.has(p) ? 'wrong direction' : 'wrong direction (dropped by checker)')
    : afterSet.has(p) ? 'wrong' : 'wrong (dropped by checker)';
  rows.push({ prerequisite: a, concept: b, in_answer_key: inKey ? 'yes' : 'no', first_guess: firstSet.has(p) ? 'yes' : 'no', after_checker: afterSet.has(p) ? 'yes' : 'no', result, origin: originOfPair(p) });
}
rows.sort((x, y) => x.result.localeCompare(y.result) || x.prerequisite.localeCompare(y.prerequisite));
const outFile = path.join(path.dirname(keyFile), 'link-accuracy-results.csv');
writeCsv(outFile, rows);
console.log(`\nPer-link results saved to ${outFile}`);
console.log('Note: a link the checker reversed is counted in its corrected direction in both rows above.');
