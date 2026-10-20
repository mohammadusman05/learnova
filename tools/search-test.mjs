// ============================================================
// SEARCH TEST (TA point 11) — does Learnova's RAG search find the right page?
//
// Usage (from C:\learnova):
//   node tools/search-test.mjs <labels.csv> <folder-with-the-PDFs>
//
// labels.csv columns (one row per concept, see tools/search-test-labels-template.csv):
//   pdf_file, concept_name, concept_definition, correct_pages, learner_question
//   correct_pages = the page(s) that really teach the concept, e.g. "6;7"
//   learner_question = how a learner might ask about it in their own words
//
// It compares 5 ways of finding text for each concept and reports how often
// the right page is among what each way returns:
//   1. first 8,000 characters  (how Learnova worked before point 11)
//   2. question-only search     (like the old RAG that drifted)
//   3. keyword search           (BM25)
//   4. meaning search           (embeddings — needs: npm install --no-save @huggingface/transformers)
//   5. hybrid                   (keyword + meaning — what the portal uses)
// It uses exactly the same code as the portal (src/retrieval.js).
// ============================================================
import fs from 'fs';
import path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { itemsToText } from '../src/pdfText.js';
import { stripRepeatedLines, joinPagesWithMarkers, removePageMarkers } from '../src/conceptExtraction.js';
import { retrieve, pageAt, setEmbedderForTests } from '../src/retrieval.js';

const [labelsPath, pdfDir] = process.argv.slice(2);
if (!labelsPath || !pdfDir) { console.log('Usage: node tools/search-test.mjs <labels.csv> <folder-with-the-PDFs>'); process.exit(1); }

// ── small CSV reader (handles quotes, commas and new lines inside quotes) ──
const parseCsv = (text) => {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^\uFEFF/, '');
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
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
};

// ── read a PDF the same way the portal does (pages, watermark removal, page numbers) ──
const docs = new Map();
const loadDoc = async (file) => {
  if (docs.has(file)) return docs.get(file);
  const data = new Uint8Array(fs.readFileSync(path.join(pdfDir, file)));
  const pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) pages.push(itemsToText((await (await pdf.getPage(i)).getTextContent()).items));
  const { text, pageStarts } = removePageMarkers(stripRepeatedLines(joinPagesWithMarkers(pages)));
  const doc = { id: file, name: file, rawText: text, pageStarts };
  docs.set(file, doc);
  return doc;
};

// ── meaning search in Node, if the library is installed ──
let haveMeaning = false;
try {
  const { pipeline } = await import('@huggingface/transformers');
  const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
  setEmbedderForTests(async (texts) => (await ex(texts, { pooling: 'mean', normalize: true })).tolist());
  haveMeaning = true;
} catch {
  setEmbedderForTests(null);
  console.log('Note: meaning search not available in Node (run "npm install --no-save @huggingface/transformers" to include it). Testing the other methods.\n');
}

const METHODS = [
  ['first 8,000 characters (before point 11)', { mode: 'first-8000' }],
  ['question-only search (old RAG)', { mode: 'question-only', useQuestion: true }],
  ['keyword search', { mode: 'keyword' }],
  ...(haveMeaning ? [['meaning search', { mode: 'meaning' }], ['hybrid (keyword + meaning)', { mode: 'hybrid' }]] : []),
];
const K = 5;

const labels = parseCsv(fs.readFileSync(labelsPath, 'utf8'));
const hits = Object.fromEntries(METHODS.map(([n]) => [n, 0]));
const detail = [];
for (const row of labels) {
  const doc = await loadDoc(row.pdf_file);
  const right = new Set(String(row.correct_pages).split(/[;,\s]+/).filter(Boolean).map(Number));
  const concept = { name: row.concept_name, definition: row.concept_definition, sourceDocId: doc.id, sourceDocIds: [doc.id] };
  const subject = { docs: [doc] };
  const line = { concept: row.concept_name, correct_pages: [...right].join(';') };
  for (const [name, opt] of METHODS) {
    const { passages } = await retrieve(subject, concept, { mode: opt.mode, question: opt.useQuestion ? row.learner_question : '', k: K, maxChars: 1e9 });
    const pagesFound = passages.map(p => { const a = pageAt(doc, p.start), b = pageAt(doc, Math.max(p.start, p.end - 1)); return [a, b]; });
    const ok = pagesFound.some(([a, b]) => [...right].some(pg => pg >= a && pg <= b));
    if (ok) hits[name]++;
    line[name] = ok ? 'found' : 'missed';
  }
  detail.push(line);
}

console.log(`Concepts tested: ${labels.length}   (right page counted as found if it is in the top ${K} passages)\n`);
for (const [name] of METHODS) console.log(`${name.padEnd(42)} ${String(Math.round(100 * hits[name] / Math.max(1, labels.length))).padStart(3)}%  (${hits[name]}/${labels.length})`);
const outCsv = path.join(path.dirname(labelsPath), 'search-test-results.csv');
const cols = Object.keys(detail[0] || {});
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
fs.writeFileSync(outCsv, [cols.map(q).join(','), ...detail.map(d => cols.map(c => q(d[c])).join(','))].join('\n'));
console.log(`\nPer-concept results saved to ${outCsv}`);
