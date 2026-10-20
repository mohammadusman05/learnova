// ============================================================
// LEARNER MEMORY (TA points 14–15) — what Learnova remembers about the learner, per concept
// Saved inside the subject (in the learner's own browser), like mastery:
//   subject.learnerMemory[conceptId] = {
//     studied:   [time, …]                       — each time an explanation was opened
//     questions: [{text, at}]                    — every question asked in chat (all kept)
//     chat:      [{role, content, sources, at}]  — the last CHAT_KEEP chat messages (full text)
//     mistakes:  [{id, text, count, status:"open"|"fixed", corrections, firstSeen, lastSeen, fixedAt,
//                  examples:[{question, answer, screen, at}]}]
//   }
// Point 15: memory is updated after every quiz, evaluation and chat question —
//   mistakes are marked FIXED after FIX_AFTER correct answers on that point, and reopen if they come back;
//   memorySummary() picks only what is relevant to one concept for the tutor to use.
// Quiz / evaluation history is not copied here — it is read from the answer log.
// ============================================================
import { exJSON, graphEngine, UNLOCK_THRESHOLD } from './utils.js';

export const CHAT_KEEP = 20;       // full chat messages kept per concept (questions are all kept)
export const RECURRING = 2;        // a mistake seen this many times is "recurring"
export const FIX_AFTER = 2;        // correct answers on that point (after it was last seen) to mark a mistake fixed
const MAX_EXAMPLES = 5;            // wrong answers kept as examples for each mistake
const MAX_STUDIED = 100;

const empty = () => ({ studied: [], questions: [], chat: [], mistakes: [] });
export const getMemory = (subject, cId) => {
  const m = { ...empty(), ...((subject?.learnerMemory || {})[cId] || {}) };
  return { ...m, mistakes: m.mistakes.map(x => ({ status: "open", corrections: 0, ...x })) };
};
const putMemory = (subject, cId, mem) => ({ ...subject, learnerMemory: { ...(subject.learnerMemory || {}), [cId]: mem } });
const oneLine = (s, n = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const norm = (s) => oneLine(s).toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ");
export const openMistakes = (mem) => mem.mistakes.filter(x => x.status !== "fixed")
  .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);

// ── study visits ──
export const noteStudied = (subject, cId, at = Date.now()) => {
  const m = getMemory(subject, cId);
  return putMemory(subject, cId, { ...m, studied: [...m.studied, at].slice(-MAX_STUDIED) });
};

// ── chat: every question kept; full messages only the last CHAT_KEEP ──
export const addChatMessages = (subject, cId, msgs, at = Date.now()) => {
  const m = getMemory(subject, cId);
  const qs = msgs.filter(x => x.role === "user" && oneLine(x.content)).map(x => ({ text: oneLine(x.content, 500), at }));
  const chat = [...m.chat, ...msgs.map(x => ({ role: x.role === "user" ? "user" : "ai", content: String(x.content || ""), ...(x.sources?.length ? { sources: x.sources } : {}), at }))].slice(-CHAT_KEEP);
  return putMemory(subject, cId, { ...m, questions: [...m.questions, ...qs], chat });
};
export const clearChat = (subject, cId) => putMemory(subject, cId, { ...getMemory(subject, cId), chat: [] });
export const removeQuestion = (subject, cId, index) => {
  const m = getMemory(subject, cId);
  return putMemory(subject, cId, { ...m, questions: m.questions.filter((_, i) => i !== index) });
};
export const removeMistake = (subject, cId, id) => {
  const m = getMemory(subject, cId);
  return putMemory(subject, cId, { ...m, mistakes: m.mistakes.filter(x => x.id !== id) });
};

// Ask Claude for JSON; if the reply is not usable, ask once more. Then give up with a clear error.
const askJSON = async (callClaude, sys, usr, ok) => {
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callClaude(sys, usr + (attempt ? "\n\nReply with the JSON only." : ""), 1500, 0);
    const parsed = exJSON(raw || "");
    if (parsed && ok(parsed)) return parsed;
    last = oneLine(raw || "(no reply)", 120);
  }
  throw new Error(`Claude did not return a valid list (replied: "${last}…")`);
};
const knownList = (known) => known.length
  ? known.map((k, i) => `m${i + 1} (${k.status === "fixed" ? "fixed" : "open"}): ${k.text}`).join("\n") : "(none yet)";
const knownId = (known, ref) => /^m\d+$/.test(ref || "") ? known[Number(ref.slice(1)) - 1]?.id || null : null;

// ── quiz / evaluation answers: name the wrong idea behind wrong answers, and spot right answers that fix an open mistake ──
export const ANSWERS_PROMPT = `You help a tutor keep track of a learner's misunderstandings about one concept.
You get the learner's KNOWN mistakes (open or fixed), and their WRONG and RIGHT answers from one quiz.
1. For each WRONG answer, name the wrong idea behind it in one short line about the learner, starting with a verb, e.g. "thinks attention gives every word equal weight" or "confuses query vectors with key vectors". Describe the misunderstanding, not the question. If it is the same as a KNOWN mistake (open or fixed), reuse that id. If the answer shows no real wrong idea (a slip or a guess), use "none".
2. For each RIGHT answer, say which OPEN known mistake it shows the learner now understands — only when the question tests exactly that point. Otherwise use "none".
Return ONLY valid JSON, nothing else:
{"mistakes":[{"answer":"w1","match":"m2"},{"answer":"w2","match":"new","idea":"thinks ..."},{"answer":"w3","match":"none"}],"corrections":[{"answer":"r1","fixes":"m1"},{"answer":"r2","fixes":"none"}]}
Include every answer id exactly once.`;

/** wrong/right: [{question, answer, correct, explanation?, screen}] → {perWrong:[{match:id|"new"|"none", idea}], corrections:[mistakeId, …]} */
export const analyseAnswers = async (callClaude, concept, { wrong = [], right = [] }, known = []) => {
  const open = known.filter(k => k.status !== "fixed");
  if (!wrong.length && !(right.length && open.length)) return { perWrong: [], corrections: [] };
  // point 16: a question written to check a known mistake says so, which makes "fixed" reliable
  const checks = (w) => { const k = w.targetId ? known.findIndex(x => x.id === w.targetId) : -1; return k >= 0 ? `\n    Written to check known mistake m${k + 1}` : ""; };
  const fmt = (list, p) => list.map((w, i) =>
    `${p}${i + 1}: Question: ${oneLine(w.question)}\n    Learner answered: ${oneLine(w.answer, 600)}${p === "w" ? `\n    Correct answer: ${oneLine(w.correct, 400)}` : ""}${w.explanation && p === "w" ? `\n    Why: ${oneLine(w.explanation)}` : ""}${checks(w)}`).join("\n");
  const usr = `Concept: "${concept?.name}" — ${oneLine(concept?.definition)}\n\nKNOWN mistakes of this learner:\n${knownList(known)}\n\nWRONG answers:\n${wrong.length ? fmt(wrong, "w") : "(none)"}\n\nRIGHT answers:\n${right.length ? fmt(right, "r") : "(none)"}`;
  const parsed = await askJSON(callClaude, ANSWERS_PROMPT, usr, p => Array.isArray(p.mistakes) || Array.isArray(p.corrections));
  const byW = Object.fromEntries((parsed.mistakes || []).map(x => [x?.answer, x]));
  const perWrong = wrong.map((_, i) => {
    const x = byW[`w${i + 1}`] || {};
    const id = knownId(known, x.match);
    if (id) return { match: id };
    if (x.match === "new" && oneLine(x.idea)) return { match: "new", idea: oneLine(x.idea, 200) };
    return { match: "none" };
  });
  const corrections = (parsed.corrections || [])
    .filter(x => /^r\d+$/.test(x?.answer || "") && Number(x.answer.slice(1)) <= right.length)
    .map(x => knownId(known, x?.fixes)).filter(id => id && open.some(o => o.id === id));
  return { perWrong, corrections };
};

// one occurrence of a mistake: count up, reset progress towards "fixed", reopen if it was fixed
const seen = (mk, example, at) => {
  const reopened = mk.status === "fixed";
  mk.count += 1; mk.lastSeen = at; mk.corrections = 0; mk.status = "open";
  if (reopened) { mk.reopenedAt = at; delete mk.fixedAt; }
  mk.examples = [...(mk.examples || []), example].slice(-MAX_EXAMPLES);
  return reopened;
};
const findOrCreate = (mistakes, a, at, i) => {
  let mk = a.match !== "new" ? mistakes.find(x => x.id === a.match) : mistakes.find(x => norm(x.text) === norm(a.idea));
  let isNew = false;
  if (!mk) { mk = { id: `mk_${at}_${i}`, text: a.idea, count: 0, status: "open", corrections: 0, firstSeen: at, lastSeen: at, examples: [] }; mistakes.push(mk); isNew = true; }
  return { mk, isNew };
};

/** Save one quiz/evaluation analysis. Returns {subject, noted:[{text,count,isNew,reopened}], fixed:[text], progress:[{text,corrections}]}.
 *  Also writes the mistake into the matching answer-log rows (same time, concept and question). */
export const applyAnalysis = (subject, cId, wrong, result, at = Date.now()) => {
  const m = getMemory(subject, cId);
  const mistakes = m.mistakes.map(x => ({ ...x, examples: [...(x.examples || [])] }));
  const touched = new Map(); // id → {isNew, reopened}
  const textFor = [];
  (result.perWrong || []).forEach((a, i) => {
    const w = wrong[i];
    if (!a || a.match === "none") { textFor.push(""); return; }
    const { mk, isNew } = findOrCreate(mistakes, a, at, i);
    const reopened = seen(mk, { question: oneLine(w.question), answer: oneLine(w.answer, 400), screen: w.screen, at }, at);
    const prev = touched.get(mk.id);
    touched.set(mk.id, { isNew: prev ? prev.isNew : isNew, reopened: (prev && prev.reopened) || reopened });
    textFor.push(mk.text);
  });
  // right answers that show an open mistake is understood now (not if it also came back in this same quiz)
  const fixed = [], progressed = new Set();
  for (const id of result.corrections || []) {
    const mk = mistakes.find(x => x.id === id);
    if (!mk || mk.status === "fixed" || touched.has(id)) continue;
    mk.corrections = (mk.corrections || 0) + 1;
    if (mk.corrections >= FIX_AFTER) { mk.status = "fixed"; mk.fixedAt = at; fixed.push(mk.text); progressed.delete(id); }
    else progressed.add(id);
  }
  let next = putMemory(subject, cId, { ...m, mistakes });
  const log = (subject.answerLog || []).map(e => {
    if (e.conceptId !== cId || e.at !== at) return e;
    const i = wrong.findIndex(w => w.question === e.question);
    return i >= 0 && textFor[i] ? { ...e, misconception: textFor[i] } : e;
  });
  next = { ...next, answerLog: log };
  const noted = [...touched.entries()].map(([id, f]) => { const x = mistakes.find(y => y.id === id); return { text: x.text, count: x.count, ...f }; });
  const progress = [...progressed].map(id => { const x = mistakes.find(y => y.id === id); return { text: x.text, corrections: x.corrections }; });
  return { subject: next, noted, fixed, progress };
};

// point 14 names, kept for older callers/tests
export const analyseMistakes = async (callClaude, concept, wrong, known = []) => (await analyseAnswers(callClaude, concept, { wrong }, known)).perWrong;
export const applyMistakes = (subject, cId, wrong, perWrong, at) => applyAnalysis(subject, cId, wrong, { perWrong, corrections: [] }, at);

// ── chat: does a learner's question show a misunderstanding? ──
export const CHAT_CHECK_PROMPT = `You check one question a learner asked their tutor about a concept.
Decide whether the question shows a misunderstanding: a clearly wrong belief stated or assumed in it (e.g. "attention just averages the words, right?").
If the question suggests the same confusion as a KNOWN mistake, reuse its id.
A normal request for an explanation, a definition or an example is NOT a misunderstanding — use "none".
Return ONLY valid JSON, one of:
{"match":"m2"}
{"match":"new","idea":"thinks ... (one short line about the learner, starting with a verb)"}
{"match":"none"}`;

export const checkChatQuestion = async (callClaude, concept, question, known = []) => {
  const usr = `Concept: "${concept?.name}" — ${oneLine(concept?.definition)}\n\nKNOWN mistakes of this learner:\n${knownList(known)}\n\nLearner's question: ${oneLine(question, 800)}`;
  const p = await askJSON(callClaude, CHAT_CHECK_PROMPT, usr, x => typeof x.match === "string");
  const id = knownId(known, p.match);
  if (id) return { match: id };
  if (p.match === "new" && oneLine(p.idea)) return { match: "new", idea: oneLine(p.idea, 200) };
  return { match: "none" };
};

/** Returns {subject, noted:null|{text,count,isNew,reopened}} */
export const applyChatCheck = (subject, cId, question, result, at = Date.now()) => {
  if (!result || result.match === "none") return { subject, noted: null };
  const m = getMemory(subject, cId);
  const mistakes = m.mistakes.map(x => ({ ...x, examples: [...(x.examples || [])] }));
  const { mk, isNew } = findOrCreate(mistakes, result, at, "c");
  const reopened = seen(mk, { question: "(asked in chat)", answer: oneLine(question, 400), screen: "chat", at }, at);
  return { subject: putMemory(subject, cId, { ...m, mistakes }), noted: { text: mk.text, count: mk.count, isNew, reopened } };
};

// ── study history, read from the answer log (one row per quiz or evaluation) ──
export const studyHistory = (subject, cId) => {
  const groups = new Map();
  for (const e of subject.answerLog || []) {
    if (e.conceptId !== cId) continue;
    const k = `${e.screen}|${e.at}`;
    const g = groups.get(k) || { screen: e.screen, at: e.at, right: 0, total: 0 };
    g.total += 1; if (e.correct) g.right += 1;
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => a.at - b.at).map(g => ({ ...g, pct: Math.round(100 * g.right / Math.max(1, g.total)) }));
};

// ── point 15: pick ONLY what matters for this concept — for the tutor to use (point 16) ──
// this concept: up to 3 open mistakes (recurring first), the last 3 chat questions, the latest score and trend;
// weak prerequisites (mastery below 60%): up to 2, each with its main open mistake.
// Left out: other concepts, fixed mistakes, older chat, the raw answer log.
export const memorySummary = (subject, cId, { maxMistakes = 3, maxQuestions = 3, maxPrereqs = 2, maxChars = 900 } = {}) => {
  const node = subject?.graph?.nodes?.[cId];
  const m = getMemory(subject, cId);
  const mistakes = openMistakes(m).slice(0, maxMistakes);
  const questions = [...m.questions].reverse().slice(0, maxQuestions);
  const hist = studyHistory(subject, cId);
  const last = hist[hist.length - 1], before = hist[hist.length - 2];
  const prereqs = (subject?.graph ? graphEngine.getPrereqs(subject.graph, cId) : [])
    .map(id => ({ id, name: subject.graph.nodes[id]?.name, mastery: subject.mastery?.[id] || 0 }))
    .filter(p => p.name && p.mastery < UNLOCK_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery).slice(0, maxPrereqs)
    .map(p => ({ ...p, mistake: openMistakes(getMemory(subject, p.id))[0]?.text || "" }));
  const lines = [];
  if (mistakes.length) lines.push(`Open mistakes on "${node?.name || "this concept"}": ` + mistakes.map(x => `${x.text}${x.count >= RECURRING ? ` (seen ${x.count}×)` : ""}`).join("; "));
  if (questions.length) lines.push("Recently asked: " + questions.map(q => `"${oneLine(q.text, 160)}"`).join("; "));
  if (last) lines.push(`Last ${last.screen === "evaluation" ? "evaluation" : "quiz"}: ${last.pct}%${before ? ` (before that: ${before.pct}%)` : ""}`);
  prereqs.forEach(p => lines.push(`Weak prerequisite: ${p.name} (${p.mastery}%)${p.mistake ? ` — ${p.mistake}` : ""}`));
  let text = lines.join("\n");
  if (text.length > maxChars) text = text.slice(0, maxChars - 1) + "…";
  return { text, mistakes, questions, last, before, prereqs };
};
