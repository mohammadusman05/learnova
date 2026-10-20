// ============================================================
// TUTOR GROUNDEDNESS, ACCURACY & FAITHFULNESS (TA point 19)
// A second Claude call — the "judge" — checks the tutor's work:
//   1. every statement of a document explanation / chat answer against the lecture pages it cites
//   2. every quiz question's "correct" option against the lecture, before the quiz is shown
// Each check is saved (subject.faithLog) for the Faithfulness CSV — evidence for the report.
// The same prompts are used by tools/tutor-eval.mjs, so offline scores match the portal.
// ============================================================
import { exJSON } from './utils.js';
import { LECTURE_GUARD, currentLearnerCode } from './privacy.js';

const oneLine = (s, n = 400) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const MAX_LOG = 300;

// The tutor's chat-answer instructions (shared with tools/tutor-eval.mjs)
export const tutorAnswerSystem = (subjectName, conceptName) =>
  `You are an AI tutor for "${subjectName}", helping a learner with "${conceptName}". Answer from the lecture passages first and cite them like [S1]. If the passages do not cover the question (or part of it), you may answer from general knowledge, but put that part after a line that starts with "Beyond your lecture:". Be clear and concise.`;

// ── 1. groundedness of an answer ──
export const JUDGE_PROMPT = `You are a strict fact-checker for an AI tutor. You get the tutor's ANSWER and the numbered LECTURE PASSAGES it was given.
Split the answer into its factual statements (skip greetings, questions and filler). For each statement decide:
- "supported": the passage(s) it cites — or, if it cites none, any passage — clearly state it. Rewording, simpler words, or something the passages plainly imply also count as supported (judge the meaning, not the exact words)
- "not supported": the passages do not state it, or it cites a passage that does not say it
- "beyond": it comes after a line starting "Beyond your lecture:" (general knowledge, clearly labelled — not checked against the lecture)
Return ONLY valid JSON, nothing else:
{"statements":[{"text":"short statement","cites":["S1"],"verdict":"supported","note":"why, one short line"}]}
${LECTURE_GUARD}`;

const passagesBlock = (passages) => passages.map((p, i) => `[S${i + 1}] (${p.label || p.docName || "lecture"})\n${p.text}`).join("\n\n");

/** → {statements:[{text, cites, verdict, note}], supported, notSupported, beyond, checked, score (0–100 or null)} */
export const checkGrounding = async (callClaude, answer, passages) => {
  if (!passages?.length || !String(answer || "").trim()) return null;
  const usr = `LECTURE PASSAGES:\n${passagesBlock(passages)}\n\nANSWER:\n${answer}`;
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callClaude(JUDGE_PROMPT, usr + (attempt ? "\n\nReply with the JSON only." : ""), 2000, 0);
    const p = exJSON(raw || "");
    if (p && Array.isArray(p.statements)) {
      const statements = p.statements.map(s => ({
        text: oneLine(s?.text, 300), cites: (Array.isArray(s?.cites) ? s.cites : []).map(String),
        verdict: ["supported", "not supported", "beyond"].includes(s?.verdict) ? s.verdict : "not supported",
        note: oneLine(s?.note, 200),
      })).filter(s => s.text);
      const supported = statements.filter(s => s.verdict === "supported").length;
      const notSupported = statements.filter(s => s.verdict === "not supported").length;
      const beyond = statements.filter(s => s.verdict === "beyond").length;
      const checked = supported + notSupported;
      return { statements, supported, notSupported, beyond, checked, score: checked ? Math.round(100 * supported / checked) : null };
    }
    last = oneLine(raw || "(no reply)", 120);
  }
  throw new Error(`the judge did not return a valid list (replied: "${last}…")`);
};

// ── 1b. "From My Document" explanations: the learner sees ONLY sentences the lecture supports ──
// The explanation is split into sentences, each is checked, and the ones the lecture does not support are
// left out before the learner sees anything. They are kept only in the Faithfulness CSV (for the report).
export const SENTENCE_CHECK_PROMPT = `You check an AI tutor's explanation against the LECTURE PASSAGES it was given. The learner must see ONLY what the lecture says.
For each numbered SENTENCE decide:
- "in": the passages state it. Rewording, simpler words, a short summary, or something the passages plainly imply all count as "in" — judge the meaning, not the exact words. A sentence that only introduces, links or sums up without adding a new fact is "in". A sentence saying the lecture does not cover something is "in".
- "out": it adds any fact, example, comparison, number, purpose or claim that the passages do not state, or it says something more strongly than the passages do (for example "any", "always", "specifically designed for").
A citation like [S1] does not make a sentence "in" by itself.
Return ONLY valid JSON, nothing else:
{"sentences":[{"n":1,"verdict":"in"},{"n":2,"verdict":"out","note":"one short line: what the passages do not say"}]}
Include every sentence number exactly once.
${LECTURE_GUARD}`;

const HEADING = /^\s*(#{1,6})\s/;
const STRUCTURE = /^\s*(#{1,6}\s|\*\*[^*]+\*\*:?\s*$|[-*_]{3,}\s*$)/;   // headings, bold-only lines, rules: kept, not checked
const LINE_PREFIX = /^(\s*(?:[-*•]|\d+[.)])\s+)/;                         // bullet / number in front of a line
const ABBREV = /\b(e\.g|i\.e|vs|etc|Fig|Eq|No|cf)\./g;

/** explanation → {units:[{n,text}] (the sentences to check), layout (to rebuild the text)} */
export const splitForCheck = (text) => {
  const units = [];
  const layout = String(text || "").replace(/\r/g, "").split("\n").map(line => {
    if (!line.trim()) return { blank: true };
    if (STRUCTURE.test(line)) return { heading: line, level: (line.match(HEADING)?.[1].length) || 7 };
    const m = line.match(LINE_PREFIX); const prefix = m ? m[1] : "";
    const body = line.slice(prefix.length).replace(ABBREV, "$1․");
    const sents = [];
    for (const part of body.split(/(?<=[.!?]["”')\]]?)\s+(?=["“(\[*]?[A-Z0-9])/)) {
      const lead = part.match(/^((?:\[S\d+\][,;]?\s*)+)([\s\S]*)$/);   // "[S1] Next sentence" → the citation belongs to the sentence before
      if (lead && sents.length) { sents[sents.length - 1] += " " + lead[1].trim(); if (lead[2].trim()) sents.push(lead[2].trim()); }
      else if (part.trim()) sents.push(part.trim());
    }
    return { prefix, ids: sents.map(s => { units.push({ n: units.length + 1, text: s.replace(/․/g, ".") }); return units.length; }) };
  });
  return { units, layout };
};

/** rebuild the explanation with only the kept sentences; headings with nothing left under them go too */
export const rebuildKept = (layout, units, keep) => {
  let lines = [];
  for (const L of layout) {
    if (L.blank) lines.push({ blank: true });
    else if (L.heading !== undefined) lines.push(L);
    else { const kept = L.ids.filter(id => keep.has(id)).map(id => units[id - 1].text); if (kept.length) lines.push({ text: L.prefix + kept.join(" ") }); }
  }
  lines = lines.filter((L, i) => {
    if (L.heading === undefined) return true;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].blank) continue;
      if (lines[j].heading !== undefined) { if (lines[j].level <= L.level) return false; continue; }
      return true;
    }
    return false;
  });
  const out = [];
  for (const L of lines) {
    if (L.blank) { if (out.length && out[out.length - 1] !== "") out.push(""); }
    else out.push(L.heading ?? L.text);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n");
};

/** → {text (only lecture-supported sentences), kept, removed, checked, supported, notSupported, beyond, score, statements} — null if nothing to check */
export const filterToLecture = async (callClaude, answer, passages) => {
  const { units, layout } = splitForCheck(answer);
  if (!passages?.length || !units.length) return null;
  const usr = `LECTURE PASSAGES:\n${passagesBlock(passages)}\n\nSENTENCES:\n${units.map(u => `${u.n}. ${u.text}`).join("\n")}`;
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callClaude(SENTENCE_CHECK_PROMPT, usr + (attempt ? "\n\nReply with the JSON only." : ""), 3000, 0);
    const p = exJSON(raw || "");
    const v = {};
    if (p && Array.isArray(p.sentences)) p.sentences.forEach(s => {
      const n = Number(s?.n);
      if (Number.isInteger(n) && n >= 1 && n <= units.length) v[n] = { verdict: s?.verdict === "in" ? "in" : "out", note: oneLine(s?.note, 200) };
    });
    if (Object.keys(v).length >= Math.ceil(units.length / 2)) {
      const keep = new Set(units.filter(u => v[u.n]?.verdict === "in").map(u => u.n));   // a sentence the checker skipped is left out
      const statements = units.map(u => ({ text: u.text, cites: (u.text.match(/S\d+/g) || []), verdict: keep.has(u.n) ? "supported" : "not supported", note: v[u.n] ? v[u.n].note : "not checked" }));
      const removed = units.length - keep.size;
      return { text: rebuildKept(layout, units, keep), kept: keep.size, removed, checked: units.length,
        supported: keep.size, notSupported: removed, beyond: 0, score: Math.round(100 * keep.size / units.length), statements };
    }
    last = oneLine(raw || "(no reply)", 120);
  }
  throw new Error(`the checker did not return a valid list (replied: "${last}…")`);
};

// ── 2. quiz answer keys ──
export const KEY_CHECK_PROMPT = `You check the answer keys of multiple-choice quiz questions against LECTURE PASSAGES.
For each question decide:
- "ok": the marked correct option is right according to the passages, and no other option is also right
- "wrong": another single option is the right one according to the passages — give its number (0 = first option) in "right"
- "unclear": the passages do not settle it, or more than one option could be right
Return ONLY valid JSON, nothing else:
{"checks":[{"q":"q1","verdict":"ok","right":0,"note":"one short line"}]}
Include every question id exactly once.
${LECTURE_GUARD}`;

/** questions: [{q, options, correct}] → {questions: kept (keys corrected), corrected, removed, checked, failed} */
export const checkAnswerKeys = async (callClaude, questions, passages) => {
  if (!passages?.length || !questions?.length) return { questions, corrected: 0, removed: 0, checked: 0 };
  const list = questions.map((q, i) => `q${i + 1}: ${oneLine(q.q, 500)}\n${(q.options || []).map((o, j) => `   ${j}: ${oneLine(o, 200)}`).join("\n")}\n   marked correct: ${q.correct}`).join("\n");
  const raw = await callClaude(KEY_CHECK_PROMPT, `LECTURE PASSAGES:\n${passagesBlock(passages)}\n\nQUESTIONS:\n${list}`, 1500, 0);
  const p = exJSON(raw || "");
  if (!p || !Array.isArray(p.checks)) return { questions, corrected: 0, removed: 0, checked: 0, failed: true };
  const byId = Object.fromEntries(p.checks.map(c => [c?.q, c]));
  let corrected = 0, removed = 0;
  const kept = [];
  questions.forEach((q, i) => {
    const c = byId[`q${i + 1}`];
    const n = (q.options || []).length;
    if (c?.verdict === "wrong" && Number.isInteger(c.right) && c.right >= 0 && c.right < n && c.right !== q.correct) {
      corrected++; kept.push({ ...q, correct: c.right, keyCorrected: true, keyNote: oneLine(c.note, 200) });
    } else if (c?.verdict === "unclear" || c?.verdict === "wrong") { removed++; }
    else kept.push(q);
  });
  // never leave the learner with an empty quiz: if everything was removed, keep the originals (flagged)
  if (!kept.length) return { questions: questions.map(q => ({ ...q, keyUnverified: true })), corrected: 0, removed: 0, checked: questions.length, allUnclear: true };
  return { questions: kept, corrected, removed, checked: questions.length };
};

// ── 3. the faithfulness log (evidence for the report) ──
export const logFaith = (subject, entry) => ({ ...subject, faithLog: [...(subject.faithLog || []), { at: Date.now(), ...entry }].slice(-MAX_LOG) });
export const faithSummary = (subject) => {
  const log = (subject.faithLog || []).filter(e => e.kind !== "quiz-keys" && e.score !== null && e.score !== undefined);
  const keys = (subject.faithLog || []).filter(e => e.kind === "quiz-keys");
  return {
    answers: log.length, avgScore: log.length ? Math.round(log.reduce((a, e) => a + e.score, 0) / log.length) : null,
    quizzes: keys.length, corrected: keys.reduce((a, e) => a + (e.corrected || 0), 0), removed: keys.reduce((a, e) => a + (e.removed || 0), 0),
  };
};
const FAITH_COLUMNS = ["subject", "learner_code", "date_time", "concept", "kind", "statements_checked", "supported", "not_supported", "beyond_lecture", "groundedness_pct", "unsupported_statements", "questions_checked", "keys_corrected", "questions_removed"];
const csvCell = (v) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const faithCsv = (subject, learnerCode = currentLearnerCode()) => {
  const nodes = subject.graph?.nodes || {};
  const rows = (subject.faithLog || []).map(e => [
    subject.name, learnerCode, e.at ? new Date(e.at).toISOString() : "", nodes[e.conceptId]?.name || e.conceptId || "", e.kind,
    e.checked ?? "", e.supported ?? "", e.notSupported ?? "", e.beyond ?? "", e.score ?? "", (e.unsupported || []).join(" | "),
    e.questionsChecked ?? "", e.corrected ?? "", e.removed ?? "",
  ]);
  return [FAITH_COLUMNS, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
};
/** the log entry for a grounding result */
export const groundingEntry = (conceptId, kind, g) => ({
  conceptId, kind, checked: g.checked, supported: g.supported, notSupported: g.notSupported, beyond: g.beyond, score: g.score,
  unsupported: g.statements.filter(s => s.verdict === "not supported").map(s => s.text),
});
