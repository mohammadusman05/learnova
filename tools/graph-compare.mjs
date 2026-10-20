// ============================================================
// GRAPH COMPARISON (TA point 20 follow-up; feeds points 5, 7 and 13)
// Does Learnova build the same knowledge graph every time it reads the same PDFs?
//
// 1) Several people (or one person in several subjects "Run 1"…"Run 5") upload the SAME PDFs in the SAME order,
//    then each clicks Library → "⬇ Export subject" and sends the .json file.
// 2) node tools/graph-compare.mjs run1.json run2.json run3.json run4.json run5.json
// 3) Open graph-compare-near-matches.csv: for each pair of names that MAY be the same concept
//    (e.g. "Self-Attention" vs "Attention Mechanism"), write yes or no in the "same" column. Then run again with
//      node tools/graph-compare.mjs run1.json … run5.json --matches graph-compare-near-matches.csv
//
// Results (saved next to the first file, or in --out <folder>):
//   graph-compare-concepts.csv          every concept: in how many graphs, which ones, the names used
//   graph-compare-links.csv             every prerequisite link: in how many graphs, and how often it was the other way round
//   graph-compare-near-matches.csv      names that may be the same concept — a person decides
//   graph-compare-majority-concepts.csv concepts found in most graphs — a first draft of the gold concept list (point 7)
// Agreement shows STABILITY, not correctness: five graphs can agree on the same mistake. Correctness comes from
// the gold concept list (point 7) and the link answer key (tools/link-accuracy.mjs, point 13).
// ============================================================
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const matchesFile = flag('--matches');
const outDir = flag('--out');
const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--matches' && args[i - 1] !== '--out');

const usage = () => {
  console.log('Compare graphs:  node tools/graph-compare.mjs <subject1.json> <subject2.json> [more…] [--matches near-matches.csv] [--out folder]');
  console.log('The files come from Library → "⬇ Export subject" (same PDFs, same order, in each run).');
};

// ── CSV helpers ──
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
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const writeCsv = (file, cols, rows) => fs.writeFileSync(file, '﻿' + [cols.map(cell).join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n'));
const pct = (a, b) => b ? `${Math.round(100 * a / b)}%` : '–';

// ── names → one key per concept (case, punctuation, plurals and a bracketed abbreviation don't matter) ──
export const conceptKey = (name) => String(name || '').toLowerCase()
  .replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  .split(/\s+/).map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w).join(' ');
const abbrevOf = (name) => (String(name).match(/\(([A-Za-z0-9-]{2,10})\)/)?.[1] || '').toLowerCase();
const initials = (key) => key.split(' ').filter(w => !['of', 'and', 'the', 'for', 'in', 'to', 'a', 'an'].includes(w)).map(w => w[0]).join('');
const words = (key) => new Set(key.split(' ').filter(w => w.length > 2));
/** why two concept names might be the same idea, or '' */
export const nearReason = (a, b) => {
  const ka = conceptKey(a), kb = conceptKey(b);
  if (!ka || !kb || ka === kb) return '';
  const aa = abbrevOf(a), ab = abbrevOf(b);
  if ((aa && (aa === kb || aa === initials(kb))) || (ab && (ab === ka || ab === initials(ka)))) return 'abbreviation';
  if ((ka.length <= 6 && ka === initials(kb)) || (kb.length <= 6 && kb === initials(ka))) return 'abbreviation';
  if ((` ${kb} `).includes(` ${ka} `) || (` ${ka} `).includes(` ${kb} `)) return 'one name contains the other';
  const wa = words(ka), wb = words(kb);
  const inter = [...wa].filter(w => wb.has(w)).length, uni = new Set([...wa, ...wb]).size;
  return uni && inter / uni >= 0.5 ? 'mostly the same words' : '';
};

// ── read the exported subjects ──
const loadRun = (file) => {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { throw new Error(`${file}: not valid JSON`); }
  if (data?.format !== 'learnova-subject' || !data.subject?.graph) throw new Error(`${file}: not a Learnova subject file (use Library → "⬇ Export subject")`);
  const s = data.subject;
  const docName = Object.fromEntries((s.docs || []).map(d => [d.id, d.name]));
  const nodes = s.graph.nodes || {};
  const concepts = Object.values(nodes).map(n => ({ id: n.id, name: n.name, pdfs: (n.sourceDocIds || (n.sourceDocId ? [n.sourceDocId] : [])).map(d => docName[d] || d) }));
  const links = (s.graph.edges || []).filter(e => e.type === 'prerequisite' && nodes[e.source] && nodes[e.target]).map(e => [nodes[e.source].name, nodes[e.target].name]);
  return { label: path.basename(file).replace(/\.json$/i, ''), subject: s.name, docs: (s.docs || []).map(d => d.name), concepts, links };
};

export const compareRuns = (runs, decisions = []) => {
  const N = runs.length;
  // union-find over concept keys, so "yes" decisions merge two names into one concept
  const parent = new Map();
  const find = (k) => { if (!parent.has(k)) parent.set(k, k); const p = parent.get(k); if (p === k) return k; const r = find(p); parent.set(k, r); return r; };
  const unite = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb < ra ? ra : rb, rb < ra ? rb : ra); };
  for (const d of decisions) if (/^y(es)?$/i.test(d.same || '')) unite(conceptKey(d.concept_a), conceptKey(d.concept_b));
  const canon = (name) => find(conceptKey(name));

  // concepts
  const C = new Map();   // key → {runs:Set, names:Map(name→count), pdfs:Set}
  runs.forEach((r, i) => r.concepts.forEach(c => {
    const k = canon(c.name);
    if (!C.has(k)) C.set(k, { runs: new Set(), names: new Map(), pdfs: new Set() });
    const e = C.get(k); e.runs.add(i); e.names.set(c.name, (e.names.get(c.name) || 0) + 1); c.pdfs.forEach(p => e.pdfs.add(p));
  }));
  const display = (k) => [...C.get(k).names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const conceptRows = [...C.keys()].map(k => {
    const e = C.get(k);
    const row = { concept: display(k), found_in: `${e.runs.size} of ${N}`, count: e.runs.size, names_used: [...e.names.keys()].join(' | '), pdfs: [...e.pdfs].join(' | ') };
    runs.forEach((r, i) => { row[r.label] = e.runs.has(i) ? 'yes' : ''; });
    return row;
  }).sort((a, b) => b.count - a.count || a.concept.localeCompare(b.concept));

  // near-matches between names that are NOT already the same concept (decided pairs are listed again with their answer)
  const decided = new Map(decisions.map(d => [[conceptKey(d.concept_a), conceptKey(d.concept_b)].sort().join('§'), d.same || '']));
  const keys = [...C.keys()];
  const near = [];
  for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
    const na = display(keys[a]), nb = display(keys[b]);
    const why = nearReason(na, nb);
    if (!why) continue;
    const ra = C.get(keys[a]).runs, rb = C.get(keys[b]).runs;
    near.push({ concept_a: na, concept_b: nb, found_a_in: `${ra.size} of ${N}`, found_b_in: `${rb.size} of ${N}`,
      both_in_same_graph: [...ra].filter(x => rb.has(x)).length, why, same: decided.get([conceptKey(na), conceptKey(nb)].sort().join('§')) || '' });
  }
  // decided "yes" pairs are already merged, so they no longer show up; keep the person's "no" answers visible
  near.sort((x, y) => (x.both_in_same_graph - y.both_in_same_graph) || x.concept_a.localeCompare(y.concept_a));

  // links (by concept, after merging)
  const L = new Map();   // "a§b" → Set(run)
  const linkSets = runs.map(() => new Set());
  runs.forEach((r, i) => r.links.forEach(([s, t]) => {
    const k = `${canon(s)}§${canon(t)}`;
    if (canon(s) === canon(t)) return;
    if (!L.has(k)) L.set(k, new Set());
    L.get(k).add(i); linkSets[i].add(k);
  }));
  const conceptSets = runs.map((r) => new Set(r.concepts.map(c => canon(c.name))));
  const linkRows = [...L.keys()].map(k => {
    const [a, b] = k.split('§');
    const rev = L.get(`${b}§${a}`) || new Set();
    const both = conceptSets.filter(s => s.has(a) && s.has(b)).length;
    const row = { prerequisite: display(a), concept: display(b), found_in: `${L.get(k).size} of ${N}`, count: L.get(k).size,
      other_way_round_in: rev.size, both_concepts_in: `${both} of ${N}` };
    runs.forEach((r, i) => { row[r.label] = L.get(k).has(i) ? 'yes' : rev.has(i) ? 'reversed' : ''; });
    return row;
  }).sort((x, y) => y.count - x.count || x.prerequisite.localeCompare(y.prerequisite));

  // pairwise agreement (how much two graphs have in common, 0–100%)
  const jaccard = (A, B) => { const u = new Set([...A, ...B]).size; return u ? [...A].filter(x => B.has(x)).length / u : 1; };
  const pairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const shared = new Set([...conceptSets[i]].filter(x => conceptSets[j].has(x)));
    const onShared = (S) => new Set([...S].filter(k => { const [a, b] = k.split('§'); return shared.has(a) && shared.has(b); }));
    pairs.push({ i, j, concepts: jaccard(conceptSets[i], conceptSets[j]), links: jaccard(linkSets[i], linkSets[j]), linksOnShared: jaccard(onShared(linkSets[i]), onShared(linkSets[j])) });
  }
  const avg = (f) => pairs.length ? pairs.reduce((a, p) => a + p[f], 0) / pairs.length : 1;
  const majority = Math.floor(N / 2) + 1;
  const summary = {
    runs: N, concepts: conceptRows.length,
    conceptsInAll: conceptRows.filter(r => r.count === N).length, conceptsInMajority: conceptRows.filter(r => r.count >= majority).length,
    conceptsInOne: conceptRows.filter(r => r.count === 1).length,
    links: linkRows.length, linksInAll: linkRows.filter(r => r.count === N).length, linksInMajority: linkRows.filter(r => r.count >= majority).length,
    linksInOne: linkRows.filter(r => r.count === 1).length,
    directionDisagreements: linkRows.filter(r => r.other_way_round_in > 0 && r.prerequisite.localeCompare(r.concept) < 0).length,
    conceptAgreement: avg('concepts'), linkAgreement: avg('links'), linkAgreementOnShared: avg('linksOnShared'),
    nearMatches: near.filter(x => !x.same).length, majority,
  };
  return { conceptRows, linkRows, near, summary, pairs };
};

// ── command line ──
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('graph-compare.mjs');
if (isMain) {
  if (files.length < 2) { usage(); process.exitCode = 1; }
  else {
    try {
      const runs = files.map(loadRun);
      const docLists = runs.map(r => r.docs.join(' → '));
      const decisions = matchesFile ? parseCsv(fs.readFileSync(matchesFile, 'utf8')) : [];
      const { conceptRows, linkRows, near, summary: S, pairs } = compareRuns(runs, decisions);
      const dir = outDir || path.dirname(files[0]);
      if (outDir) fs.mkdirSync(outDir, { recursive: true });
      const labels = runs.map(r => r.label);
      writeCsv(path.join(dir, 'graph-compare-concepts.csv'), ['concept', 'found_in', ...labels, 'names_used', 'pdfs'], conceptRows);
      writeCsv(path.join(dir, 'graph-compare-links.csv'), ['prerequisite', 'concept', 'found_in', 'other_way_round_in', 'both_concepts_in', ...labels], linkRows);
      writeCsv(path.join(dir, 'graph-compare-near-matches.csv'), ['concept_a', 'concept_b', 'found_a_in', 'found_b_in', 'both_in_same_graph', 'why', 'same'], near);
      writeCsv(path.join(dir, 'graph-compare-majority-concepts.csv'), ['concept', 'found_in', 'names_used', 'pdfs', 'keep'],
        conceptRows.filter(r => r.count >= S.majority).map(r => ({ ...r, keep: '' })));

      console.log(`\nGRAPH COMPARISON — ${S.runs} graphs of "${runs[0].subject}"`);
      runs.forEach((r, i) => console.log(`  ${r.label}: ${r.concepts.length} concepts, ${r.links.length} prerequisite links`));
      if (new Set(docLists).size > 1) console.log('  ⚠ The graphs were not made from the same PDFs in the same order — differences may come from that:\n' + runs.map(r => `     ${r.label}: ${r.docs.join(' → ')}`).join('\n'));
      console.log(`\nCONCEPTS: ${S.concepts} different concepts across all graphs`);
      console.log(`  in all ${S.runs} graphs: ${S.conceptsInAll} (${pct(S.conceptsInAll, S.concepts)}) · in most (${S.majority}+): ${S.conceptsInMajority} (${pct(S.conceptsInMajority, S.concepts)}) · in only one: ${S.conceptsInOne}`);
      console.log(`  average agreement between two graphs: ${Math.round(100 * S.conceptAgreement)}%`);
      console.log(`\nPREREQUISITE LINKS: ${S.links} different links across all graphs`);
      console.log(`  in all ${S.runs} graphs: ${S.linksInAll} (${pct(S.linksInAll, S.links)}) · in most: ${S.linksInMajority} (${pct(S.linksInMajority, S.links)}) · in only one: ${S.linksInOne}`);
      console.log(`  average agreement between two graphs: ${Math.round(100 * S.linkAgreement)}% (only counting concepts both graphs have: ${Math.round(100 * S.linkAgreementOnShared)}%)`);
      console.log(`  links found in opposite directions in different graphs: ${S.directionDisagreements}`);
      if (pairs.length > 1) console.log(`  pair by pair (concepts / links): ${pairs.map(p => `${labels[p.i]}–${labels[p.j]} ${Math.round(100 * p.concepts)}%/${Math.round(100 * p.links)}%`).join(' · ')}`);
      const missing = conceptRows.filter(r => r.count < S.runs).slice(0, 15);
      if (missing.length) {
        console.log(`\nDIFFERENCES TO LOOK AT (concepts not in every graph${conceptRows.filter(r => r.count < S.runs).length > 15 ? ', first 15' : ''}):`);
        missing.forEach(r => console.log(`  ${r.concept} — in ${r.found_in} (missing from ${labels.filter(l => !r[l]).join(', ')})`));
      }
      console.log(S.nearMatches
        ? `\n${S.nearMatches} pair(s) of names may be the same concept → open graph-compare-near-matches.csv, write yes/no in "same", then run again with --matches graph-compare-near-matches.csv`
        : '\nNo undecided near-matching names.');
      console.log(`\nSaved in ${dir}: graph-compare-concepts.csv, graph-compare-links.csv, graph-compare-near-matches.csv, graph-compare-majority-concepts.csv (draft gold concept list for point 7)`);
      console.log('Remember: agreement shows the graph is STABLE, not that it is RIGHT — check correctness against the gold list (point 7) and the link answer key (point 13).');
    } catch (e) { console.log(`⚠ ${e.message}`); process.exitCode = 1; }
  }
}
