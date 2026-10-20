// ============================================================
// TUTOR EVALUATION (TA point 19) — is the tutor accurate, grounded and faithful?
//
// 1) Score the tutor on a test sheet of questions (needs your Anthropic API key):
//      PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."
//      node tools/tutor-eval.mjs <questions.csv> <folder-with-the-PDFs>
//      add --batch for half price (TA point 20): all requests go to Anthropic's Message Batches API at once;
//      results usually come within minutes but can take up to 24 hours (the script waits and checks every 30 s).
//      At the end it prints the tokens used and what the run cost.
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
import { tutorAnswerSystem, checkGrounding, JUDGE_PROMPT, passagesBlock } from '../src/faithfulness.js';
import { PRICES } from '../src/claudeApi.js';
import { LECTURE_GUARD } from '../src/privacy.js';
import { retrieve, passagesForPrompt, setEmbedderForTests } from '../src/retrieval.js';
import { exJSON } from '../src/utils.js';

const MODEL = "claude-haiku-4-5-20251001"; // the same model as the portal
const BATCH_DISCOUNT = 0.5;                  // TA point 20: the Message Batches API costs half
const args = process.argv.slice(2);
const usage = () => {
  console.log('Score the tutor:   node tools/tutor-eval.mjs <questions.csv> <folder-with-the-PDFs> [--batch]   (set ANTHROPIC_API_KEY first)');
  console.log('                   --batch = half price via Anthropic\'s Message Batches API; results can take minutes to hours');
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
  const [qFile, pdfDir] = args.filter(a => !a.startsWith('--'));
  const BATCH = args.includes('--batch');   // TA point 20: Anthropic's Message Batches API — half price, answers within 24 hours
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!qFile || !pdfDir) { usage(); process.exitCode = 1; }
  else if (!KEY) { console.log('Set your API key first, e.g. in PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."'); process.exitCode = 1; }
  else {
    const HEADERS = { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };
    const spent = { input: 0, output: 0, calls: 0, batchInput: 0, batchOutput: 0, batchCalls: 0 };
    const bodyOf = (sys, usr, maxTokens = 1500, temperature) => ({ model: MODEL, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: usr }], ...(temperature !== undefined ? { temperature } : {}) });
    // one request at a time (normal price) — also used for the few retries in batch mode
    const callClaude = async (sys, usr, maxTokens = 1500, temperature) => {
      const body = bodyOf(sys, usr, maxTokens, temperature);
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
        const d = await res.json();
        if (!d.error) { spent.calls++; spent.input += d.usage?.input_tokens || 0; spent.output += d.usage?.output_tokens || 0; return d.content?.[0]?.text || ''; }
        if (attempt === 2 || !/overloaded|rate/i.test(d.error.message || '')) throw new Error(d.error.message || 'API error');
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      }
    };
    // many requests at once: {id, sys, usr, maxTokens, temperature}[] → Map(id → {text} | {error})
    const POLL_MS = Number(process.env.TUTOR_EVAL_POLL_MS || 30000);
    const runBatch = async (reqs, label) => {
      const results = new Map();
      if (!reqs.length) return results;
      const res = await fetch('https://api.anthropic.com/v1/messages/batches', { method: 'POST', headers: HEADERS,
        body: JSON.stringify({ requests: reqs.map(r => ({ custom_id: r.id, params: bodyOf(r.sys, r.usr, r.maxTokens, r.temperature) })) }) });
      let b = await res.json();
      if (b.error) throw new Error(`could not start the batch: ${b.error.message || 'API error'}`);
      console.log(`${label}: batch ${b.id} started with ${reqs.length} requests — checking every ${Math.round(POLL_MS / 1000)} s (can take up to 24 hours)…`);
      while (b.processing_status !== 'ended') {
        await new Promise(r => setTimeout(r, POLL_MS));
        b = await (await fetch(`https://api.anthropic.com/v1/messages/batches/${b.id}`, { headers: HEADERS })).json();
        if (b.error) throw new Error(`could not check the batch: ${b.error.message || 'API error'}`);
        const c = b.request_counts || {};
        console.log(`  ${label}: ${b.processing_status} — done ${(c.succeeded || 0) + (c.errored || 0) + (c.canceled || 0) + (c.expired || 0)} of ${reqs.length}`);
      }
      const lines = (await (await fetch(b.results_url, { headers: HEADERS })).text()).split('\n').filter(l => l.trim());
      for (const line of lines) {
        const r = JSON.parse(line);
        if (r.result?.type === 'succeeded') {
          const m = r.result.message;
          spent.batchCalls++; spent.batchInput += m.usage?.input_tokens || 0; spent.batchOutput += m.usage?.output_tokens || 0;
          results.set(r.custom_id, { text: m.content?.[0]?.text || '' });
        } else results.set(r.custom_id, { error: r.result?.error?.error?.message || r.result?.error?.message || `request ${r.result?.type || 'failed'}` });
      }
      return results;
    };
    const runOneByOne = async (reqs) => {
      const results = new Map();
      for (let i = 0; i < reqs.length; i++) {
        process.stdout.write(`  ${i + 1} of ${reqs.length}…\r`);
        try { results.set(reqs[i].id, { text: await callClaude(reqs[i].sys, reqs[i].usr, reqs[i].maxTokens, reqs[i].temperature) }); }
        catch (e) { results.set(reqs[i].id, { error: e.message }); }
      }
      return results;
    };
    const runAll = (reqs, label) => BATCH ? runBatch(reqs, label) : runOneByOne(reqs);

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
    const out = [], ctx = [];
    console.log(`${items.length} questions${BATCH ? ' — batch mode (half price; answers can take a while)' : ''}`);
    // step 1 — find the lecture passages for every question
    for (let i = 0; i < items.length; i++) {
      const r = items[i];
      out.push({ pdf_file: r.pdf_file, concept_name: r.concept_name, question: r.question, type: r.answer_key ? 'key' : 'open', answer_key: r.answer_key || '',
        tutor_answer: '', judge_verdict: '', judge_note: '', rubric_correctness: '', rubric_groundedness: '', rubric_completeness: '', rubric_clarity: '', rubric_note: '',
        statements_checked: '', supported: '', not_supported: '', beyond: '', groundedness_pct: '', unsupported_statements: '',
        human_check: (i % 5 === 0) ? 'yes' : '', human_verdict: '', human_correctness: '', error: '' });
      try {
        const doc = await loadDoc(r.pdf_file);
        const concept = { name: r.concept_name || r.question, definition: '', sourceDocIds: [doc.id] };
        ctx[i] = { concept, passages: (await retrieve({ docs: [doc] }, concept, { question: r.question, k: 4, maxChars: 4500 })).passages };
      } catch (e) { out[i].error = e.message; }
    }
    const live = items.map((r, i) => i).filter(i => !out[i].error);
    // step 2 — the tutor answers exactly as in the portal's chat
    const answers = await runAll(live.map(i => ({ id: `t${i}`, sys: tutorAnswerSystem('this course', ctx[i].concept.name) + ' ' + LECTURE_GUARD, maxTokens: 1000,
      usr: ctx[i].passages.length ? `Lecture passages:\n${passagesForPrompt(ctx[i].passages)}\n\nLearner's question: ${items[i].question}` : `No lecture passages match this question.\n\nLearner's question: ${items[i].question}` })), 'Tutor answers');
    for (const i of live) { const a = answers.get(`t${i}`); if (a?.error || !a) out[i].error = a?.error || 'no answer'; else out[i].tutor_answer = a.text; }
    const answered = live.filter(i => !out[i].error);
    // step 3 — the checks: groundedness (same prompt as the portal) + accuracy (answer key) or rubric (open question)
    const checkReqs = [];
    for (const i of answered) {
      if (ctx[i].passages.length) checkReqs.push({ id: `g${i}`, sys: JUDGE_PROMPT, usr: `LECTURE PASSAGES:\n${passagesBlock(ctx[i].passages)}\n\nANSWER:\n${out[i].tutor_answer}`, maxTokens: 2000, temperature: 0 });
      checkReqs.push(items[i].answer_key
        ? { id: `j${i}`, sys: ACCURACY_PROMPT, usr: `QUESTION: ${items[i].question}\n\nANSWER KEY: ${items[i].answer_key}\n\nANSWER:\n${out[i].tutor_answer}`, maxTokens: 300, temperature: 0 }
        : { id: `j${i}`, sys: RUBRIC_PROMPT, usr: `LECTURE PASSAGES:\n${passagesForPrompt(ctx[i].passages) || '(none)'}\n\nQUESTION: ${items[i].question}\n\nANSWER:\n${out[i].tutor_answer}`, maxTokens: 400, temperature: 0 });
    }
    const checks = await runAll(checkReqs, 'Checks');
    let failures = 0;
    for (const i of live) {
      const row = out[i];
      if (row.error) continue;
      try {
        if (ctx[i].passages.length) {
          const pre = checks.get(`g${i}`);
          let first = true;   // the batch reply is used first; checkGrounding's one retry is a normal call
          const fromBatch = async (...a) => { if (first) { first = false; if (pre?.text !== undefined) return pre.text; } return callClaude(...a); };
          const g = await checkGrounding(fromBatch, row.tutor_answer, ctx[i].passages);
          if (g) Object.assign(row, { statements_checked: g.checked, supported: g.supported, not_supported: g.notSupported, beyond: g.beyond, groundedness_pct: g.score ?? '', unsupported_statements: g.statements.filter(s => s.verdict === 'not supported').map(s => s.text).join(' | ') });
        }
        const j = checks.get(`j${i}`);
        if (!j || j.error) throw new Error(j?.error || 'the judge did not answer');
        const v = exJSON(j.text) || {};
        if (items[i].answer_key) {
          row.judge_verdict = ['correct', 'partly', 'incorrect'].includes(v.verdict) ? v.verdict : ''; row.judge_note = v.note || '';
          if (!row.judge_verdict) throw new Error('the judge did not return a verdict');
        } else {
          const sc = (x) => (Number.isInteger(x) && x >= 1 && x <= 5) ? x : '';
          Object.assign(row, { rubric_correctness: sc(v.correctness), rubric_groundedness: sc(v.groundedness), rubric_completeness: sc(v.completeness), rubric_clarity: sc(v.clarity), rubric_note: v.note || '' });
          if (row.rubric_correctness === '') throw new Error('the judge did not return rubric scores');
        }
      } catch (e) { row.error = e.message; }
    }
    failures = out.filter(r => r.error).length;
    const keyRows = out.filter(r => r.type === 'key' && r.judge_verdict);
    const openRows = out.filter(r => r.type === 'open' && r.rubric_correctness !== '');
    const g = out.filter(r => r.groundedness_pct !== '').map(r => Number(r.groundedness_pct));
    console.log(`\nTUTOR EVALUATION — ${items.length} questions${failures ? ` (${failures} could not be scored — see the "error" column)` : ''}`);
    console.log(`\nACCURACY (questions with an answer key): ${keyRows.length}`);
    console.log(`  Correct ${pct(keyRows.filter(r => r.judge_verdict === 'correct').length, keyRows.length)} · Partly ${pct(keyRows.filter(r => r.judge_verdict === 'partly').length, keyRows.length)} · Incorrect ${pct(keyRows.filter(r => r.judge_verdict === 'incorrect').length, keyRows.length)}`);
    console.log(`\nRUBRIC, LLM as judge (open questions): ${openRows.length}   — average out of 5`);
    for (const k of ['correctness', 'groundedness', 'completeness', 'clarity']) console.log(`  ${k.padEnd(13)} ${fmt(mean(openRows.map(r => Number(r[`rubric_${k}`]))))}`);
    console.log(`\nGROUNDEDNESS (statements supported by the lecture pages, all answers): ${g.length ? Math.round(mean(g)) + '%' : '–'} on average`);
    // TA point 20: what this run cost
    const p = PRICES[MODEL];
    const normal = (spent.input * p.input + spent.output * p.output) / 1e6;
    const batch = (spent.batchInput * p.input + spent.batchOutput * p.output) * BATCH_DISCOUNT / 1e6;
    console.log(`\nCOST — ${spent.calls + spent.batchCalls} AI calls · ${spent.input + spent.batchInput} input tokens · ${spent.output + spent.batchOutput} output tokens · about $${(normal + batch).toFixed(4)}` +
      (BATCH ? ` (batch at half price: $${batch.toFixed(4)}; ${spent.calls} normal-price retr${spent.calls === 1 ? 'y' : 'ies'}: $${normal.toFixed(4)})` : ` (without --batch; with --batch it would be about $${(normal * BATCH_DISCOUNT).toFixed(4)})`));
    const outFile = path.join(path.dirname(qFile), 'tutor-eval-results.csv');
    writeCsv(outFile, out);
    console.log(`\nPer-question results saved to ${outFile}`);
    console.log(`Rows marked human_check = yes: fill human_verdict (key questions: correct / partly / incorrect) or human_correctness (open: 1–5), then run --agreement.`);
  }
}
