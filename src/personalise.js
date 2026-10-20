// ============================================================
// PERSONALISATION BEYOND MASTERY (TA point 16)
// Uses the "What the tutor will use" summary (point 15) to change what the tutor SAYS:
//   1. a "For you" note + 2. a quick recap of weak prerequisites, before the explanation
//   3. chat that remembers the conversation and the learner's open mistakes
//   4. quiz / evaluation questions aimed at the learner's open mistakes
//   5. an on/off switch (per subject) so adaptive vs non-adaptive can be compared (points 21–22)
// With personalisation off, or with nothing remembered yet, everything works exactly as before.
// ============================================================
import { exJSON } from './utils.js';
import { getStudyMode, setStudyMode } from './studyMode.js';
import { LECTURE_GUARD } from './privacy.js';
import { getMemory, openMistakes, memorySummary } from './learnerMemory.js';
import { retrieve, passagesForPrompt, sourcesOf } from './retrieval.js';

const oneLine = (s, n = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// ── 5. on/off — since point 21 this follows the subject's study mode (Adaptive = on, Static = off) ──
export const isPersonalised = (subject) => getStudyMode(subject) === "adaptive";
export const setPersonalised = (subject, on) => setStudyMode(subject, on ? "adaptive" : "static");

// ── 1 + 2. "For you" note and quick recap of weak prerequisites ──
export const PERSONAL_NOTE_PROMPT = `You are a tutor writing a short personal note for ONE learner, shown before the main explanation of a concept.
You get what is known about this learner (their open mistakes, recent questions, last score, weak prerequisites).
Write:
- "recap": for each WEAK PREREQUISITE listed, 2–3 sentences that refresh the key idea the learner needs before this concept.
- "forYou": 2–4 short bullet points that speak to THIS learner: correct each open mistake directly and kindly (e.g. "Last time you thought …; in fact …"), and answer a recent question if it fits. Do not repeat the whole explanation.
- "covers": the open mistakes (exact wording) your bullets address.
SOURCE RULE: if lecture passages are given, take facts only from them and cite like [S1]; anything not in the passages must start with "Beyond your lecture:". If no passages are given, use general knowledge.
Return ONLY valid JSON, nothing else:
{"recap":[{"concept":"Embeddings","text":"..."}],"forYou":["...","..."],"covers":["thinks ..."]}
${LECTURE_GUARD}`;

/** Returns null when there is nothing personal to say (switch off, or nothing remembered yet).
 *  Otherwise {recap:[{name, mastery, text}], forYou:[...], covers:[...], recapSources, forYouSources} */
export const personalNote = async (callClaude, subject, cId, { useLecture = false } = {}) => {
  if (!isPersonalised(subject)) return null;
  const sum = memorySummary(subject, cId);
  if (!sum.text) return null;
  if (!sum.mistakes.length && !sum.prereqs.length && !sum.questions.length) return null;
  const c = subject.graph.nodes[cId];
  let passages = [];
  if (useLecture) {
    const own = (await retrieve(subject, c, { k: 4, maxChars: 4000 })).passages;
    const pre = [];
    for (const p of sum.prereqs) { const node = subject.graph.nodes[p.id]; if (node) pre.push(...(await retrieve(subject, node, { k: 2, maxChars: 1500 })).passages); }
    const seen = new Set();
    passages = [...pre, ...own].filter(p => { const k = `${p.docId}:${p.start}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 7);
  }
  const usr = `Concept: "${c?.name}" — ${oneLine(c?.definition)}\n\nWhat is known about this learner:\n${sum.text}\n\n` +
    (sum.prereqs.length ? `WEAK PREREQUISITES: ${sum.prereqs.map(p => `${p.name} (${p.mastery}%)`).join(", ")}\n\n` : "WEAK PREREQUISITES: none\n\n") +
    (passages.length ? `Lecture passages:\n${passagesForPrompt(passages)}` : "No lecture passages — use general knowledge.");
  const raw = await callClaude(PERSONAL_NOTE_PROMPT, usr, 1200, 0);
  const p = exJSON(raw || "") || {};
  const forYou = (Array.isArray(p.forYou) ? p.forYou : []).map(x => oneLine(x, 600)).filter(Boolean).slice(0, 4);
  const recap = (Array.isArray(p.recap) ? p.recap : []).map(r => {
    const pr = sum.prereqs.find(x => x.name?.toLowerCase() === String(r?.concept || "").toLowerCase()) || sum.prereqs[0];
    return pr && oneLine(r?.text, 800) ? { name: pr.name, mastery: pr.mastery, text: oneLine(r.text, 800) } : null;
  }).filter(Boolean);
  const covers = (Array.isArray(p.covers) ? p.covers : []).map(x => oneLine(x, 200)).filter(Boolean);
  if (!forYou.length && !recap.length) throw new Error("Claude did not return a usable personal note");
  const cited = (text) => sourcesOf(passages).filter(s => text.includes(`[${s.tag}]`));
  return { recap, forYou, covers, recapSources: cited(recap.map(r => r.text).join(" ")), forYouSources: cited(forYou.join(" ")) };
};

// ── 3. chat: the conversation so far + (when on) what is known about the learner ──
export const chatContext = (subject, cId, messages, { maxMsgs = 6 } = {}) => {
  const convo = (messages || []).filter(m => (m.role === "user" || m.role === "ai") && !m.note)
    .filter(m => !String(m.content || "").startsWith("Error:")).slice(-maxMsgs)
    .map(m => `${m.role === "user" ? "Learner" : "Tutor"}: ${oneLine(m.content, 500)}`).join("\n");
  const known = isPersonalised(subject) ? memorySummary(subject, cId).text : "";
  return { convo, known };
};
export const CHAT_PERSONAL_RULE = ` If "What you know about this learner" is given and the question touches one of their open mistakes, address it directly and kindly (e.g. "This is the same mix-up as before: …"). Use "Conversation so far" to understand follow-up questions.`;

// ── 4. questions aimed at open mistakes ──
/** Returns {text, targets:[{key, id, text}]} — text is added to the quiz prompt; empty when off / nothing open */
export const targetBlock = (subject, cId, max, kind = "mcq") => {
  if (!isPersonalised(subject) || max <= 0) return { text: "", targets: [] };
  const targets = openMistakes(getMemory(subject, cId)).slice(0, max).map((x, i) => ({ key: `t${i + 1}`, id: x.id, text: x.text }));
  if (!targets.length) return { text: "", targets };
  const text = `\n\nThis learner has these open misunderstandings:\n${targets.map(t => `${t.key}: ${t.text}`).join("\n")}\n` +
    `Write ${targets.length === 1 ? "one question" : "one question for EACH of them"} that a learner holding that misunderstanding would get wrong${kind === "mcq" ? " (make that misunderstanding one of the wrong options)" : " (the question should make them explain exactly that point)"}, and mix these questions among the others — do not put them first and do not mention the misunderstanding in the question. Add "targets":"t1" (the matching key) to each such question and "targets":null to the others.`;
  return { text, targets };
};
/** Attach targetId / targetText to each generated question */
export const resolveTargets = (questions, targets) => (questions || []).map(q => {
  const t = targets.find(x => x.key === q?.targets);
  const { targets: _t, ...rest } = q || {};
  return t ? { ...rest, targetId: t.id, targetText: t.text } : rest;
});
