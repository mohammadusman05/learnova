// ============================================================
// SAVED EXPLANATIONS (TA point 20 — caching)
// An explanation is saved per concept and per source choice ("From My Document", "From Knowledge Base", both).
// Opening the concept again shows the saved one at no AI cost; "Generate new" makes a fresh one.
// The personal "For you" note is NOT saved — it depends on the learner's latest mistakes, so it is made fresh.
// A saved explanation is not used once the concept's documents change (a new PDF may say more about it).
// ============================================================
export const MAX_SAVED = 80;   // explanations kept per subject (oldest dropped first) — keeps browser storage small

export const choiceKey = (wantDoc, wantKb) => (wantDoc && wantKb ? "both" : wantDoc ? "doc" : "kb");
const sameDocs = (a = [], b = []) => [...a].sort().join("|") === [...b].sort().join("|");

/** the saved explanation for this concept + choice, or null (none, or the concept's documents changed) */
export const getSaved = (subject, cId, key, docIds = []) => {
  const e = subject?.savedExplanations?.[cId]?.[key];
  return e && Array.isArray(e.items) && e.items.length && sameDocs(e.docIds, docIds) ? e : null;
};

/** only finished, checked explanations are saved (no errors, no failed lecture check, nothing still loading) */
export const isSavable = (items) => Array.isArray(items) && items.length > 0
  && items.every(m => ["doc", "kb", "ai"].includes(m.role))
  && !items.some(m => m.check?.status === "failed" || m.check?.status === "working")
  && !items.some(m => String(m.content || "").startsWith("Error:"))
  && items.some(m => m.role === "doc" || m.role === "kb");

// keep only what the screen needs (the left-out sentences stay in the Faithfulness CSV, not here)
const slim = (m) => {
  const out = { role: m.role, content: m.content };
  for (const k of ["note", "docName", "sources", "id"]) if (m[k] !== undefined) out[k] = m[k];
  if (m.check?.filtered) out.check = { status: "done", filtered: { kept: m.check.filtered.kept, removed: m.check.filtered.removed, checked: m.check.filtered.checked } };
  return out;
};

export const saveExplanation = (subject, cId, key, docIds, items, now = Date.now()) => {
  if (!isSavable(items)) return subject;
  const all = { ...(subject.savedExplanations || {}) };
  all[cId] = { ...(all[cId] || {}), [key]: { at: now, docIds: [...docIds], items: items.map(slim) } };
  // over the cap → drop the oldest
  const flat = Object.entries(all).flatMap(([c, byKey]) => Object.entries(byKey).map(([k, e]) => ({ c, k, at: e.at })));
  if (flat.length > MAX_SAVED) {
    flat.sort((a, b) => a.at - b.at).slice(0, flat.length - MAX_SAVED).forEach(({ c, k }) => {
      const rest = { ...all[c] }; delete rest[k];
      if (Object.keys(rest).length) all[c] = rest; else delete all[c];
    });
  }
  return { ...subject, savedExplanations: all };
};
