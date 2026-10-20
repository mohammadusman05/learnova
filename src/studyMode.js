// ============================================================
// STUDY MODE (TA point 21 — non-adaptive baseline)
//   Adaptive (default): Learnova adapts to the learner — recaps, "For you" notes, chat that remembers them,
//                       questions on their mistakes, revision reminders, "Ready to learn" / "Needs review".
//   Static:             every learner gets the same — same order, same kind of questions, no reminders or
//                       suggestions. Answers, mastery and mistakes are STILL recorded (for the comparison),
//                       just not used. Mastery % stays visible.
// One setting per subject; every learner can switch it; every switch is logged and every answer / lecture
// check records the mode it was given in (study_mode column).
// ============================================================
export const MODES = {
  adaptive: { label: "Adaptive", icon: "🎯", text: "Learnova adapts to you: quick recaps, personal notes, a tutor that remembers your mistakes, questions aimed at them, revision reminders and suggestions on what to learn next." },
  static: { label: "Static", icon: "📘", text: "Everyone gets the same: topics in course order, general questions, no personal notes, reminders or suggestions. Learnova still records your answers and mastery." },
};

/** "adaptive" | "static" — a subject whose Personalisation was switched OFF before (point 16) counts as static */
export const getStudyMode = (subject) => subject?.studyMode === "static" || subject?.studyMode === "adaptive"
  ? subject.studyMode
  : (subject?.personalise === false ? "static" : "adaptive");
export const isStatic = (subject) => getStudyMode(subject) === "static";

export const setStudyMode = (subject, mode, now = Date.now()) => {
  if (!MODES[mode]) throw new Error(`Unknown study mode: ${mode}`);
  if (getStudyMode(subject) === mode && subject.studyMode === mode) return subject;
  return { ...subject, studyMode: mode, personalise: mode === "adaptive", modeLog: [...(subject.modeLog || []), { at: now, mode }] };
};

/** when the current mode started (the last switch), or null if it was never switched */
export const modeSince = (subject) => {
  const log = subject?.modeLog || [];
  return log.length ? log[log.length - 1].at : null;
};
