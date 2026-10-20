// ============================================================
// TUTOR EVALUATION (TA point 19) — is the tutor accurate, grounded and faithful?
//
// 1) Score the tutor on a test sheet of questions (needs your Anthropic API key):
//      PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."
//      node tools/tutor-eval.mjs <questions.csv> <folder-with-the-PDFs>
//    questions.csv columns (see tools/tutor-eval-questions-template.csv):
//      pdf_file, concept_name, question, answer_key
//      answer_key filled  → "key" question: the tutor's answer is compared with the answer key (correct / partly / incorrect)
//      answer_key empty   → "open" question: an LLM judge scores it with a fixed rubric (1–5 each:
//                           correctness, groundedness, completeness, clarity) — as TA 2 suggested
//    Every answer is also checked statement by statement against the lecture pages (groundedness %),
//    with exactly the same prompts the portal uses.
//    About 1 in 5 rows is marked human_check = yes: a person fills human_verdict (key questions) or
//    human_correctness 1–5 (open questions), without looking at the judge's columns.
//
// 2) How well does the LLM judge agree with the person?
//      node tools/tutor-eval.mjs --agreement <tutor-eval-results.csv>
// ============================================================
import fs from 'fs';
import path from 'path';
import { tutorAnswerSystem, checkGrounding } from '../src/faithfulness.js';
import { LECTURE_GUARD } from '../src/privacy.js';
import { retrieve, passagesForPrompt, setEmbedderForTests } from '../src/retrieval.js';
import { exJSON } from '../src/utils.js';

const MODEL = "claude-haiku-4-5-20251001"; // the same model as the portal
const args = process.argv.slice(2);
const usage = () => {
  console.log('Score the tutor:   node tools/tutor-eval.mjs <questions.csv> <folder-with-the-PDFs>   (set ANTHROPIC_API_KEY first)');
  console.log('Judge vs human:    node tools/tutor-eval.mjs --agreement <tutor-eval-results.csv>');
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
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const writeCsv = (file, rows) => {
  const cols = Object.keys(rows[0] || { note: '' });
  fs.writeFileSync(file, '﻿' + [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n'));
};
const pct = (a, b) => b ? `${Math.round(100 * a / b)}%` : '–';
const mean = (xs) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) : null;
const fmt = (x) => x === null ? '–' : x.toFixed(2);

// ============================================================
// MODE 2 — judge vs human agreement
// ============================================================
if (args[0] === '--agreement') {
  const file = args[1];
  if (!file || !fs.existsSync(file)) { usage(); process.exitCode = 1; }
  else {
    const rows = parseCsv(fs.readFileSync(file, 'utf8'));
    const keyRows = rows.filter(r => r.type === 'key' && r.human_verdict && r.judge_verdict);
    const labels = ['correct', 'partly', 'incorrect'];
    const n = keyRows.length;
    const agree = keyRows.filter(r => r.human_verdict.toLowerCase() === r.judge_verdict.toLowerCase()).length;
    const po = n ? agree / n : 0;
    const pe = n ? labels.reduce((a, l) => a + (keyRows.filter(r => r.human_verdict.toLowerCase() === l).length / n) * (keyRows.filter(r => r.judge_verdict.toLowerCase() === l).length / n), 0) : 0;
    const kappa = pe < 1 ? (po - pe) / (1 - pe) : 1;
    console.log(`\nJUDGE vs HUMAN — answer-key questions: ${n}`);
    console.log(`  Same verdict: ${agree} of ${n} (${pct(agree, n)})   Cohen's kappa: ${n ? kappa.toFixed(2) : '–'}   (above 0.6 = good, above 0.8 = very good)`);
    const openRows = rows.filter(r => r.type === 'open' && r.human_correctness && r.rubric_correctness).map(r => ({ h: Number(r.human_correctness), j: Number(r.rubric_correctness) })).filter(x => x.h && x.j);
    const within1 = openRows.filter(x => Math.abs(x.h - x.j) <= 1).length;
    console.log(`\nJUDGE vs HUMAN — open questions (correctness 1–5): ${openRows.length}`);
    console.log(`  Within 1 point: ${within1} of ${openRows.length} (${pct(within1, openRows.length)})   Average difference: ${fmt(mean(openRows.map(x => Math.abs(x.h - x.j))))} points`);
  }
} else {
// ============================================================
// MODE 1 — run the tutor on the test sheet and score it
// ============================================================
  const [qFile, pdfDir] = args;
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!qFile || !pdfDir) { usage(); process.exitCode = 1; }
  else if (!KEY) { console.log('Set your API key first, e.g. in PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."'); process.exitCode = 1; }
  else {
    const callClaude = async (sys, usr, maxTokens = 1500, temperature) => {
      const body = { model: MODEL, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: usr }] };
      if (temperature !== undefined) body.temperature = temperature;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
        const d = await res.json();
        if (!d.error) return d.content?.[0]?.text || '';
        if (attempt === 2 || !/overloaded|rate/i.test(d.error.message || '')) throw new Error(d.error.message || 'API error');
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      }
    };
    const ACCURACY_PROMPT = `You compare an AI tutor's ANSWER with the ANSWER KEY for a learner's question.
"correct": the answer states what the key says (other wording is fine) and adds nothing false.
"partly": it has part of the key, or the key's point plus a clear error.
"incorrect": it misses or contradicts the key.
Return ONLY valid JSON: {"verdict":"correct","note":"one short line"}`;
    const RUBRIC_PROMPT = `You grade an AI tutor's ANSWER to a learner's question, using the LECTURE PASSAGES it was given. Score 1 (poor) to 5 (excellent):
- correctness: is everything it says true?
- groundedness: are its claims supported by the lecture passages (or clearly labelled "Beyond your lecture")?
- completeness: does it answer the whole question?
- clarity: is it clear for a learner?
Return ONLY valid JSON: {"correctness":5,"groundedness":4,"completeness":4,"clarity":5,"note":"one short line"}
${LECTURE_GUARD}`;

    // read PDFs the same way the portal does (pages, watermark removal, page numbers)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { itemsToText } = await import('../src/pdfText.js');
    const { stripRepeatedLines, joinPagesWithMarkers, removePageMarkers } = await import('../src/conceptExtraction.js');
    const docs = new Map();
    const loadDoc = async (file) => {
      if (docs.has(file)) return docs.get(file);
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(pdfDir, file))), verbosity: 0 }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) pages.push(itemsToText((await (await pdf.getPage(i)).getTextContent()).items));
      const { text, pageStarts } = removePageMarkers(stripRepeatedLines(joinPagesWithMarkers(pages)));
      const doc = { id: file, name: file, rawText: text, pageStarts };
      docs.set(file, doc);
      return doc;
    };
    // meaning search in Node if the library is installed, otherwise keyword search
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
      setEmbedderForTests(async (texts) => (await ex(texts, { pooling: 'mean', normalize: true })).tolist());
    } catch { setEmbedderForTests(null); }

    const items = parseCsv(fs.readFileSync(qFile, 'utf8')).filter(r => r.question && r.pdf_file);
    const out = [];
    let failures = 0;
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      process.stdout.write(`Question ${i + 1} of ${items.length}…\r`);
      const row = { pdf_file: r.pdf_file, concept_name: r.concept_name, question: r.question, type: r.answer_key ? 'key' : 'open', answer_key: r.answer_key || '',
        tutor_answer: '', judge_verdict: '', judge_note: '', rubric_correctness: '', rubric_groundedness: '', rubric_completeness: '', rubric_clarity: '', rubric_note: '',
        statements_checked: '', supported: '', not_supported: '', beyond: '', groundedness_pct: '', unsupported_statements: '',
        human_check: (i % 5 === 0) ? 'yes' : '', human_verdict: '', human_correctness: '', error: '' };
      try {
        const doc = await loadDoc(r.pdf_file);
        const concept = { name: r.concept_name || r.question, definition: '', sourceDocIds: [doc.id] };
        const { passages } = await retrieve({ docs: [doc] }, concept, { question: r.question, k: 4, maxChars: 4500 });
        // the tutor answers exactly as in the portal's chat
        const answer = await callClaude(tutorAnswerSystem('this course', concept.name) + ' ' + LECTURE_GUARD,
          passages.length ? `Lecture passages:\n${passagesForPrompt(passages)}\n\nLearner's question: ${r.question}` : `No lecture passages match this question.\n\nLearner's question: ${r.question}`, 1000);
        row.tutor_answer = answer;
        const g = await checkGrounding(callClaude, answer, passages);
        if (g) Object.assign(row, { statements_checked: g.checked, supported: g.supported, not_supported: g.notSupported, beyond: g.beyond, groundedness_pct: g.score ?? '', unsupported_statements: g.statements.filter(s => s.verdict === 'not supported').map(s => s.text).join(' | ') });
        if (r.answer_key) {
          const v = exJSON(await callClaude(ACCURACY_PROMPT, `QUESTION: ${r.question}\n\nANSWER KEY: ${r.answer_key}\n\nANSWER:\n${answer}`, 300, 0)) || {};
          row.judge_verdict = ['correct', 'partly', 'incorrect'].includes(v.verdict) ? v.verdict : ''; row.judge_note = v.note || '';
          if (!row.judge_verdict) throw new Error('the judge did not return a verdict');
        } else {
          const v = exJSON(await callClaude(RUBRIC_PROMPT, `LECTURE PASSAGES:\n${passagesForPrompt(passages) || '(none)'}\n\nQUESTION: ${r.question}\n\nANSWER:\n${answer}`, 400, 0)) || {};
          const sc = (x) => (Number.isInteger(x) && x >= 1 && x <= 5) ? x : '';
          Object.assign(row, { rubric_correctness: sc(v.correctness), rubric_groundedness: sc(v.groundedness), rubric_completeness: sc(v.completeness), rubric_clarity: sc(v.clarity), rubric_note: v.note || '' });
          if (row.rubric_correctness === '') throw new Error('the judge did not return rubric scores');
        }
      } catch (e) { row.error = e.message; failures++; }
      out.push(row);
    }
    const keyRows = out.filter(r => r.type === 'key' && r.judge_verdict);
    const openRows = out.filter(r => r.type === 'open' && r.rubric_correctness !== '');
    const g = out.filter(r => r.groundedness_pct !== '').map(r => Number(r.groundedness_pct));
    console.log(`\nTUTOR EVALUATION — ${items.length} questions${failures ? ` (${failures} could not be scored — see the "error" column)` : ''}`);
    console.log(`\nACCURACY (questions with an answer key): ${keyRows.length}`);
    console.log(`  Correct ${pct(keyRows.filter(r => r.judge_verdict === 'correct').length, keyRows.length)} · Partly ${pct(keyRows.filter(r => r.judge_verdict === 'partly').length, keyRows.length)} · Incorrect ${pct(keyRows.filter(r => r.judge_verdict === 'incorrect').length, keyRows.length)}`);
    console.log(`\nRUBRIC, LLM as judge (open questions): ${openRows.length}   — average out of 5`);
    for (const k of ['correctness', 'groundedness', 'completeness', 'clarity']) console.log(`  ${k.padEnd(13)} ${fmt(mean(openRows.map(r => Number(r[`rubric_${k}`]))))}`);
    console.log(`\nGROUNDEDNESS (statements supported by the lecture pages, all answers): ${g.length ? Math.round(mean(g)) + '%' : '–'} on average`);
    const outFile = path.join(path.dirname(qFile), 'tutor-eval-results.csv');
    writeCsv(outFile, out);
    console.log(`\nPer-question results saved to ${outFile}`);
    console.log(`Rows marked human_check = yes: fill human_verdict (key questions: correct / partly / incorrect) or human_correctness (open: 1–5), then run --agreement.`);
  }
}
