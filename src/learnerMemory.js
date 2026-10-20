// ============================================================
// LEARNER MEMORY (TA point 14) — what Learnova remembers about the learner, per concept
// Saved inside the subject (in the learner's own browser), like mastery:
//   subject.learnerMemory[conceptId] = {
//     studied:   [time, …]                       — each time an explanation was opened
//     questions: [{text, at}]                    — every question asked in chat (all kept)
//     chat:      [{role, content, sources, at}]  — the last CHAT_KEEP chat messages (full text)
//     mistakes:  [{id, text, count, firstSeen, lastSeen, examples:[{question, answer, screen, at}]}]
//   }
// Quiz / evaluation history is not copied here — it is read from the answer log.
// ============================================================
import { exJSON } from './utils.js';

export const CHAT_KEEP = 20;       // full chat messages kept per concept (questions are all kept)
export const RECURRING = 2;        // a mistake seen this many times is "recurring"
const MAX_EXAMPLES = 5;            // wrong answers kept as examples for each mistake
const MAX_STUDIED = 100;

const empty = () => ({ studied: [], questions: [], chat: [], mistakes: [] });
export const getMemory = (subject, cId) => ({ ...empty(), ...((subject?.learnerMemory || {})[cId] || {}) });
const putMemory = (subject, cId, mem) => ({ ...subject, learnerMemory: { ...(subject.learnerMemory || {}), [cId]: mem } });
const oneLine = (s, n = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const norm = (s) => oneLine(s).toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ");

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

// ── mistakes: Claude names the wrong idea behind each wrong answer, reusing a known one when it is the same ──
export const MISTAKE_PROMPT = `You help a tutor understand a learner's wrong answers about one concept.
For each WRONG answer, name the wrong idea behind it in one short line about the learner, starting with a verb, e.g. "thinks attention gives every word equal weight" or "confuses query vectors with key vectors". Describe the misunderstanding, not the question.
If the wrong idea is the same as one on the KNOWN list, reuse that id instead of writing a new line.
If the answer shows no real wrong idea (a slip or a guess), use "none".
Return ONLY valid JSON, nothing else:
{"mistakes":[{"answer":"w1","match":"m2"},{"answer":"w2","match":"new","idea":"thinks ..."},{"answer":"w3","match":"none"}]}
Include every answer id exactly once.`;

/** wrong: [{question, answer, correct, explanation?, screen}] → [{match:"mX"|"new"|"none", idea}] in the same order */
export const analyseMistakes = async (callClaude, concept, wrong, known = []) => {
  if (!wrong.length) return [];
  const knownList = known.length ? known.map((k, i) => `m${i + 1}: ${k.text}`).join("\n") : "(none yet)";
  const answers = wrong.map((w, i) =>
    `w${i + 1}: Question: ${oneLine(w.question)}\n    Learner answered: ${oneLine(w.answer, 600)}\n    Correct answer: ${oneLine(w.correct, 400)}${w.explanation ? `\n    Why: ${oneLine(w.explanation)}` : ""}`
  ).join("\n");
  const usr = `Concept: "${concept?.name}" — ${oneLine(concept?.definition)}\n\nKNOWN mistakes of this learner:\n${knownList}\n\nWRONG answers:\n${answers}`;
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callClaude(MISTAKE_PROMPT, usr + (attempt ? "\n\nReply with the JSON only." : ""), 1500, 0);
    const parsed = exJSON(raw || "");
    if (parsed && Array.isArray(parsed.mistakes)) {
      const byId = Object.fromEntries(parsed.mistakes.map(x => [x?.answer, x]));
      return wrong.map((_, i) => {
        const x = byId[`w${i + 1}`] || {};
        const mk = /^m\d+$/.test(x.match || "") && known[Number(x.match.slice(1)) - 1] ? known[Number(x.match.slice(1)) - 1].id : null;
        if (mk) return { match: mk };
        if (x.match === "new" && oneLine(x.idea)) return { match: "new", idea: oneLine(x.idea, 200) };
        return { match: "none" };
      });
    }
    last = oneLine(raw || "(empty reply)", 120);
  }
  throw new Error(`Claude did not return a valid list (replied: "${last}…")`);
};

/** Save the analysed mistakes. Returns {subject, noted:[{text, count, isNew}]}.
 *  Also writes the mistake into the matching answer-log rows (same time, concept and question). */
export const applyMistakes = (subject, cId, wrong, analysed, at = Date.now()) => {
  const m = getMemory(subject, cId);
  let mistakes = m.mistakes.map(x => ({ ...x, examples: [...(x.examples || [])] }));
  const touched = new Map(); // id → isNew
  const textFor = []; // per wrong answer
  analysed.forEach((a, i) => {
    const w = wrong[i];
    if (!a || a.match === "none") { textFor.push(""); return; }
    let mk = a.match !== "new" ? mistakes.find(x => x.id === a.match) : mistakes.find(x => norm(x.text) === norm(a.idea));
    if (!mk) {
      mk = { id: `mk_${at}_${i}`, text: a.idea, count: 0, firstSeen: at, lastSeen: at, examples: [] };
      mistakes.push(mk);
      touched.set(mk.id, true);
    } else if (!touched.has(mk.id)) touched.set(mk.id, false);
    mk.count += 1; mk.lastSeen = at;
    mk.examples = [...mk.examples, { question: oneLine(w.question), answer: oneLine(w.answer, 400), screen: w.screen, at }].slice(-MAX_EXAMPLES);
    textFor.push(mk.text);
  });
  let next = putMemory(subject, cId, { ...m, mistakes });
  // answer log: mark the rows of these wrong answers with the mistake found
  const log = (subject.answerLog || []).map(e => {
    if (e.conceptId !== cId || e.at !== at) return e;
    const i = wrong.findIndex(w => w.question === e.question);
    return i >= 0 && textFor[i] ? { ...e, misconception: textFor[i] } : e;
  });
  next = { ...next, answerLog: log };
  const noted = [...touched.entries()].map(([id, isNew]) => { const x = mistakes.find(y => y.id === id); return { text: x.text, count: x.count, isNew }; });
  return { subject: next, noted };
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
