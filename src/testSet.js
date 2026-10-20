// ============================================================
// UPLOADED TEST (TA point 23 — measurable learning benefits)
// A fixed test written by the faculty (not by AI): an Excel (.xlsx) or CSV sheet with one row per question —
// Question | Option A | Option B | Option C | Option D | Correct | Explanation (optional).
//   • the same questions for every learner, in every learning mode (Adaptive, Static, Plain AI chat)
//   • a learner's 1st attempt = PRE-test (score only, no answers shown), 2nd attempt = POST-test, later = retake
//   • normalised gain = (post − pre) / (100 − pre): how much of the possible improvement the learner made
//   • no AI involved and mastery is NOT changed — the test only measures (point 24)
//   • pre_test_before_study: was the pre-test taken before any studying of this subject? (rows with "no" are left
//     out of the analysis)
// subject.test (the questions) travels with "Export subject"; subject.testAttempts (answers) stay in the browser.
// ============================================================
import { currentLearnerCode } from './privacy.js';
import { getStudyMode } from './studyMode.js';

export const MAX_QUESTIONS = 200;
export const TEMPLATE_HEADER = ["Question", "Option A", "Option B", "Option C", "Option D", "Correct", "Explanation (optional)"];
export const TEMPLATE_ROWS = [
  ["What does RAG do first?", "Generate the answer", "Retrieve relevant passages", "Fine-tune the model", "Translate the question", "B", "RAG retrieves passages first, then generates."],
  ["Which of these is a benefit of microservices?", "One big codebase", "Each service can be deployed on its own", "Components are tightly coupled", "Nothing can be scaled", "B", ""],
];

// ── reading the sheet ──
const csvCell = (v) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const templateCsv = () => [TEMPLATE_HEADER, ...TEMPLATE_ROWS].map(r => r.map(csvCell).join(",")).join("\r\n");

export const parseCsvRows = (text) => {
  const rows = []; let row = [], cell = "", q = false;
  text = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === "," || ch === ";" && !text.slice(0, 200).includes(",")) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

// a small .xlsx reader (an .xlsx file is a zip of XML files) — first sheet only, no extra library
const xmlText = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
const inflate = async (bytes) => {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open .xlsx files — save the sheet as CSV and upload that.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};
const unzip = async (buf, wanted) => {
  const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This file is not a valid .xlsx file.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder("utf-8");
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (!wanted(name)) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = b.subarray(start, start + csize);
    out[name] = dec.decode(method === 8 ? await inflate(data) : data);
  }
  return out;
};
const colIndex = (ref) => { let n = 0; for (const ch of String(ref).replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
export const readXlsxRows = async (buf) => {
  const files = await unzip(buf, n => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const sheetName = Object.keys(files).filter(n => n.startsWith("xl/worksheets/")).sort((a, z) => (+a.match(/\d+/)[0]) - (+z.match(/\d+/)[0]))[0];
  if (!sheetName) throw new Error("No sheet found in this .xlsx file.");
  const shared = [...(files["xl/sharedStrings.xml"] || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlText([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const rows = [];
  for (const rm of files[sheetName].matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row = [];
    const rowNo = +((rm[1].match(/\br="(\d+)"/) || [])[1] || rows.length + 1);   // keep Excel's row numbers (empty rows are not stored)
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] || "";
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val = "";
      if (type === "s") val = shared[+v] ?? "";
      else if (type === "inlineStr") val = xmlText([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
      else if (v !== undefined) val = xmlText(v);
      row[ref ? colIndex(ref) : row.length] = val;
    }
    while (rows.length < rowNo - 1) rows.push([]);
    rows[rowNo - 1] = Array.from(row, x => x ?? "");
  }
  return rows;
};

/** sheet rows → {questions:[{id, q, options, correct, explanation}], skipped:[{row, reason}]} */
export const questionsFromRows = (rows) => {
  const clean = (rows || []).map(r => (r || []).map(c => String(c ?? "").trim()));
  const hi = clean.findIndex(r => r.some(c => /^question/i.test(c)));
  if (hi < 0) throw new Error('No "Question" column found — use the template (Question, Option A–D, Correct).');
  const head = clean[hi].map(c => c.toLowerCase());
  const col = (re) => head.findIndex(h => re.test(h));
  const qc = col(/^question/), cc = col(/^(correct|answer|right)/), ec = col(/^explanation/);
  const oc = ["a", "b", "c", "d"].map((l, i) => head.findIndex(h => new RegExp(`^(option\\s*)?(${l}|${i + 1})$`).test(h)));
  if (cc < 0) throw new Error('No "Correct" column found — use the template (Question, Option A–D, Correct).');
  if (oc.filter(x => x >= 0).length < 2) throw new Error('Need at least two option columns ("Option A", "Option B", …).');
  const questions = [], skipped = [];
  for (let i = hi + 1; i < clean.length; i++) {
    const r = clean[i], rowNo = i + 1;
    if (!r.some(Boolean)) continue;
    const q = r[qc] || "";
    const opts = oc.map(c => (c >= 0 ? r[c] : "") || "");
    const options = opts.filter(Boolean);
    if (!q) { skipped.push({ row: rowNo, reason: "no question" }); continue; }
    if (options.length < 2) { skipped.push({ row: rowNo, reason: "fewer than 2 options" }); continue; }
    const raw = (r[cc] || "").trim();
    let k = -1;
    if (/^[a-d]$/i.test(raw)) k = raw.toUpperCase().charCodeAt(0) - 65;
    else if (/^[1-4]$/.test(raw)) k = +raw - 1;
    else if (raw) k = opts.findIndex(o => o.toLowerCase() === raw.toLowerCase());
    if (k < 0 || !opts[k]) { skipped.push({ row: rowNo, reason: `the correct answer "${raw}" is not one of the options` }); continue; }
    const correct = options.indexOf(opts[k]);
    questions.push({ id: `q${questions.length + 1}`, q, options, correct, explanation: ec >= 0 ? r[ec] || "" : "" });
    if (questions.length >= MAX_QUESTIONS) break;
  }
  if (!questions.length) throw new Error(`No usable questions found${skipped.length ? ` (${skipped.length} row${skipped.length !== 1 ? "s" : ""} skipped)` : ""}.`);
  return { questions, skipped };
};

/** a File the faculty picked → {name, questions, skipped} */
export const readTestFile = async (file) => {
  const ext = file.name.toLowerCase().split(".").pop();
  let rows;
  if (ext === "xlsx") rows = await readXlsxRows(await file.arrayBuffer());
  else if (ext === "csv" || ext === "txt") rows = parseCsvRows(await file.text());
  else if (ext === "xls") throw new Error("Old .xls files can't be read — in Excel use Save As → .xlsx (or CSV) and upload that.");
  else throw new Error("Upload an Excel (.xlsx) or CSV file — see the template.");
  return { name: file.name, ...questionsFromRows(rows) };
};

// ── the test on the subject ──
export const getTest = (subject) => subject?.test && subject.test.questions?.length ? subject.test : null;
/** only in a subject you created yourself (faculty); in a subject imported from a shared file the test is locked */
export const canEditTest = (subject) => !subject?.importedFrom;
export const setTest = (subject, { name, questions }, now = Date.now()) => ({ ...subject, test: { id: `test_${now}`, name, uploadedAt: now, questions } });

export const attemptsFor = (subject, testId = getTest(subject)?.id) => (subject?.testAttempts || []).filter(a => a.testId === testId).sort((a, b) => a.at - b.at);
export const nextKind = (subject) => { const n = attemptsFor(subject).length; return n === 0 ? "pre" : n === 1 ? "post" : "retake"; };
export const normalisedGain = (pre, post) => (pre === null || pre === undefined || post === null || post === undefined || pre >= 100) ? null : Math.round(100 * (post - pre) / (100 - pre)) / 100;

const shuffle = (arr, rand) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// options whose order matters ("All of the above", "Both A and B", True / False) are kept as the faculty wrote them
export const keepOptionOrder = (options) => options.some(o => /\b(of the above|both|neither)\b|^(a|b|c|d)\s*(and|&)\s*(a|b|c|d)$/i.test(o))
  || (options.length === 2 && options.every(o => /^(true|false|yes|no)$/i.test(o.trim())));
/** the paper for one attempt: questions (and options, where safe) in a new random order */
export const makePaper = (test, rand = Math.random) => shuffle(test.questions, rand).map(q => {
  const order = keepOptionOrder(q.options) ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i), rand);
  return { qid: q.id, q: q.q, options: order.map(i => q.options[i]), order };
});

/** the first time this learner studied the subject (explanations, quizzes, chat, AI Chat) — or null */
export const firstStudyAt = (subject) => {
  const times = [];
  for (const m of Object.values(subject?.learnerMemory || {})) {
    (m.studied || []).forEach(t => times.push(t));
    (m.questions || []).forEach(x => times.push(x.at));
    (m.chat || []).forEach(x => times.push(x.at));
  }
  (subject?.answerLog || []).forEach(e => times.push(e.at));
  (subject?.plainChats || []).forEach(c => (c.messages || []).forEach(x => times.push(x.at)));
  for (const byKey of Object.values(subject?.savedExplanations || {})) for (const e of Object.values(byKey || {})) times.push(e.at);
  (subject?.faithLog || []).forEach(e => times.push(e.at));
  const ok = times.filter(t => Number.isFinite(t));
  return ok.length ? Math.min(...ok) : null;
};

/** picks: {qid: index in the paper's options} → {subject (with the attempt saved), attempt} */
export const gradeAttempt = (subject, paper, picks, startedAt, finishedAt = Date.now()) => {
  const test = getTest(subject);
  const kind = nextKind(subject);
  const byId = Object.fromEntries(test.questions.map(q => [q.id, q]));
  const answers = paper.map(p => {
    const shown = picks[p.qid];
    const orig = shown === undefined || shown === null ? null : p.order[shown];
    return { qid: p.qid, picked: orig, correct: orig !== null && orig === byId[p.qid].correct };
  });
  const correct = answers.filter(a => a.correct).length, total = answers.length;
  const studied = firstStudyAt(subject);
  const attempt = {
    id: `att_${finishedAt}`, testId: test.id, testName: test.name, kind, at: startedAt, finishedAt,
    correct, total, score: Math.round(100 * correct / total), mode: getStudyMode(subject), answers,
    ...(kind === "pre" ? { preBeforeStudy: studied === null || studied >= startedAt } : {}),
  };
  return { subject: { ...subject, testAttempts: [...(subject.testAttempts || []), attempt] }, attempt };
};

/** {pre, post, gain, attempts} for the current test */
export const testSummary = (subject) => {
  const a = attemptsFor(subject);
  const pre = a[0]?.score ?? null, post = a[1]?.score ?? null;
  return { attempts: a.length, pre, post, gain: normalisedGain(pre, post), preBeforeStudy: a[0]?.preBeforeStudy ?? null };
};

// ── results CSV (point 25: pre, post and gain per learner and mode) ──
const COLUMNS = ["subject", "learner_code", "test_name", "attempt_no", "kind", "study_mode", "started_at", "finished_at", "minutes", "correct", "total", "score_pct",
  "pre_score_pct", "post_score_pct", "normalised_gain", "pre_test_before_study", "answers"];
const L = "ABCD";
export const testResultsCsv = (subject, learnerCode = currentLearnerCode()) => {
  const rows = [];
  const tests = [...new Set((subject.testAttempts || []).map(a => a.testId))];
  for (const tid of tests) {
    const list = attemptsFor(subject, tid);
    const pre = list[0]?.score ?? null, post = list[1]?.score ?? null;
    list.forEach((a, i) => rows.push([
      subject.name, learnerCode, a.testName || "", i + 1, a.kind, a.mode || "", new Date(a.at).toISOString(), new Date(a.finishedAt).toISOString(),
      Math.round((a.finishedAt - a.at) / 6000) / 10, a.correct, a.total, a.score,
      pre ?? "", i >= 1 ? post ?? "" : "", i === 1 ? normalisedGain(pre, post) ?? "" : "", i === 0 ? (a.preBeforeStudy ? "yes" : "no") : "",
      a.answers.map((x, n) => `${x.qid}=${x.picked === null ? "-" : L[x.picked]}${x.correct ? "✓" : "✗"}`).join(" "),
    ]));
  }
  return [COLUMNS, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
};
