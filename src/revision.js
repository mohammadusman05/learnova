// ============================================================
// TARGETED REVISION (TA point 17) — when should each concept come back, and what should the review test?
//   subject.revision[conceptId] = { step, due, lastReview, lastResult:"passed"|"failed", history:[{at, pct, passed, screen}] }
// • A concept joins the schedule after its first quiz or evaluation.
// • Gaps grow 1 → 3 → 7 → 14 → 30 days. A passed review (≥ 2 of 3, i.e. ≥ 67%) moves to the next gap;
//   a failed quiz or review goes back to 1 day.
// • With personalisation ON (point 16): an open mistake brings the concept back the next day (daily until fixed),
//   and a mistake fixed ~a week ago is re-checked once.
// • With personalisation OFF: the schedule is by time only, and review questions are not aimed at mistakes.
// ============================================================
import { getMemory, studyHistory } from './learnerMemory.js';
import { isPersonalised } from './personalise.js';

export const DAY = 24 * 60 * 60 * 1000;
export const INTERVALS = [1, 3, 7, 14, 30];        // days
export const PASS_PCT = 67;                         // 2 of 3
const RECHECK_AFTER = 7;                            // days after a mistake was fixed
const MAX_HISTORY = 30;

export const getSchedule = (subject, cId) => (subject?.revision || {})[cId] || null;

/** Update the schedule after any quiz / evaluation / revision on a concept. Returns the new subject. */
export const scheduleAfterQuiz = (subject, cId, { at = Date.now(), pct, screen = "study" }) => {
  const prev = getSchedule(subject, cId);
  const passed = pct >= PASS_PCT;
  let step, due;
  if (!prev) { step = 0; due = at + INTERVALS[0] * DAY; }                       // joins the schedule
  else if (!passed) { step = 0; due = at + INTERVALS[0] * DAY; }                // failed → back to 1 day
  else if (screen === "revision" || at >= prev.due) {                           // a passed review → longer gap
    step = Math.min(prev.step + 1, INTERVALS.length - 1); due = at + INTERVALS[step] * DAY;
  } else { step = prev.step; due = Math.max(prev.due, at + INTERVALS[step] * DAY); } // practising early: no jump
  const history = [...(prev?.history || []), { at, pct, passed, screen }].slice(-MAX_HISTORY);
  const next = { step, due, lastReview: at, lastResult: passed ? "passed" : "failed", history };
  return { ...subject, revision: { ...(subject.revision || {}), [cId]: next } };
};

const days = (ms) => Math.max(0, Math.round(ms / DAY));
const dayLabel = (t) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

/** Why (and from when) a concept is due. Returns {due, reasons:[{text, at}], openMistakes, recheck:[mistake]} */
export const revisionStatus = (subject, cId, now = Date.now()) => {
  const s = getSchedule(subject, cId);
  const personal = isPersonalised(subject);
  const mem = getMemory(subject, cId);
  const reasons = [];
  if (s) {
    if (s.lastResult === "failed") reasons.push({ at: s.due, text: "last quiz or review failed" });
    else {
      const last = studyHistory(subject, cId).at(-1)?.at || s.lastReview;
      reasons.push({ at: s.due, text: `not practised for ${days(now - last)} day${days(now - last) !== 1 ? "s" : ""}` });
    }
  }
  const open = personal ? mem.mistakes.filter(x => x.status !== "fixed") : [];
  // an open mistake brings the concept back one day after it was last seen or last revised (so: daily until fixed)
  open.forEach(x => reasons.push({ at: Math.max(x.lastSeen || 0, s?.lastReview || 0) + DAY, text: `mistake seen ${x.count === 1 ? "once" : `${x.count}×`}: ${x.text}` }));
  const recheck = personal ? mem.mistakes.filter(x => x.status === "fixed" && x.fixedAt && (s?.lastReview || 0) < x.fixedAt + RECHECK_AFTER * DAY) : [];
  recheck.forEach(x => reasons.push({ at: x.fixedAt + RECHECK_AFTER * DAY, text: `re-check a fixed mistake: ${x.text}` }));
  if (!reasons.length) return null;
  const due = Math.min(...reasons.map(r => r.at));
  return { due, reasons: reasons.filter(r => r.at <= now).length ? reasons.filter(r => r.at <= now) : reasons, openMistakes: open, recheck, step: s?.step ?? 0 };
};

/** Concepts due now, most urgent first: most overdue, then most open mistakes, then lowest mastery. */
export const dueList = (subject, now = Date.now()) => Object.keys(subject?.graph?.nodes || {})
  .map(id => ({ id, name: subject.graph.nodes[id].name, mastery: subject.mastery?.[id] || 0, st: revisionStatus(subject, id, now) }))
  .filter(x => x.st && x.st.due <= now)
  .map(x => ({ ...x, overdueDays: days(now - x.st.due), reasons: x.st.reasons.map(r => r.text) }))
  .sort((a, b) => b.overdueDays - a.overdueDays || b.st.openMistakes.length - a.st.openMistakes.length || a.mastery - b.mastery);

/** "Next revision: 23 Oct (in 3 days)" — or "due now" — or "" when the concept is not scheduled yet */
export const nextRevisionLabel = (subject, cId, now = Date.now()) => {
  const st = revisionStatus(subject, cId, now);
  if (!st) return "";
  if (st.due <= now) return "Revision due now";
  const d = Math.ceil((st.due - now) / DAY);
  return `Next revision: ${dayLabel(st.due)} (in ${d} day${d !== 1 ? "s" : ""})`;
};

/** Targets for a revision quiz: open mistakes (up to 2) + one recently fixed mistake to re-check — same format as point 16 */
export const revisionTargets = (subject, cId, now = Date.now()) => {
  if (!isPersonalised(subject)) return { text: "", targets: [] };
  const st = revisionStatus(subject, cId, now);
  const picks = [...(st?.openMistakes || []).sort((a, b) => b.count - a.count).slice(0, 2), ...(st?.recheck || []).slice(0, 1)];
  const targets = picks.map((x, i) => ({ key: `t${i + 1}`, id: x.id, text: x.text }));
  const wrongQs = (subject.answerLog || []).filter(e => e.conceptId === cId && !e.correct).slice(-3).map(e => e.question).filter(Boolean);
  if (!targets.length && !wrongQs.length) return { text: "", targets };
  let text = "";
  if (targets.length) text += `\n\nThis is a REVISION quiz. The learner has had these misunderstandings:\n${targets.map(t => `${t.key}: ${t.text}`).join("\n")}\n` +
    `Write one question for EACH of them that a learner holding that misunderstanding would get wrong (make it one of the wrong options), mixed among the others — do not mention the misunderstanding. Add "targets":"t1" (the matching key) to each such question and "targets":null to the others.`;
  if (wrongQs.length) text += `\n\nQuestions this learner got wrong before (test the same ideas with NEW wording):\n${wrongQs.map(q => `- ${q}`).join("\n")}`;
  return { text, targets };
};
