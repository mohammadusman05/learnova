// ============================================================
// SHARE A SUBJECT (TA point 20 — upload once instead of once per learner)
// Export: the lectures (their text and page numbers), concepts and prerequisite links of one subject, and the
// faculty's uploaded test (point 23), as a .json file.
// NEVER exported: mastery, reading progress, answers, chats, mistakes, revision schedule, lecture-check log,
// saved explanations, learner code or API key — those stay in each learner's own browser.
// Import: a new subject, or — when the same subject was imported before — an update that keeps the learner's progress.
// The same files feed tools/graph-compare.mjs (do 5 people's uploads give the same graph?).
// ============================================================
export const SHARE_FORMAT = "learnova-subject";
export const SHARE_VERSION = 1;
const NOT_LEARNED = "NOT_LEARNED";

const pad = (n) => String(n).padStart(2, "0");
const slugOf = (s) => String(s || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "subject";
export const shareFileName = (subject, now = Date.now()) => {
  const d = new Date(now);
  return `learnova-subject-${slugOf(subject.name)}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
};

// the concept as the course defines it — without this learner's progress on it
const sharedNode = (n) => { const { state, ...rest } = n || {}; return { ...rest, state: NOT_LEARNED }; };

export const exportSubject = (subject, now = Date.now()) => {
  const g = subject.graph || { nodes: {}, edges: [] };
  const nodes = Object.fromEntries(Object.entries(g.nodes || {}).map(([id, n]) => [id, sharedNode(n)]));
  return {
    format: SHARE_FORMAT, version: SHARE_VERSION, app: "Learnova", exportedAt: new Date(now).toISOString(),
    note: "Lecture text, concepts and prerequisite links only. No learner progress, answers, chats or keys.",
    subject: {
      id: subject.id, name: subject.name, emoji: subject.emoji || "📘", createdAt: subject.createdAt || null,
      docs: (subject.docs || []).map(d => ({ ...d })),
      graph: { ...g, nodes, edges: [...(g.edges || [])], removedLinks: [...(g.removedLinks || [])] },
      ...(subject.test ? { test: subject.test } : {}),   // point 23: the faculty's uploaded test (questions only, no results)
    },
  };
};

/** text of a .json file → the shared subject, or throws a clear error */
export const parseShareFile = (text) => {
  let data;
  try { data = JSON.parse(String(text || "").replace(/^﻿/, "")); } catch { throw new Error("This file is not a Learnova subject file (it is not valid JSON)."); }
  if (data?.format !== SHARE_FORMAT) throw new Error(data?.subjects ? "This is a \"Download my data\" backup, not a shared subject. Use a file made with \"Export subject\"." : "This file is not a Learnova subject file.");
  if (Number(data.version) > SHARE_VERSION) throw new Error("This subject file was made by a newer version of Learnova — refresh the page (Ctrl+Shift+R) and try again.");
  const s = data.subject;
  if (!s || !s.id || !s.name || !s.graph || typeof s.graph.nodes !== "object" || !Array.isArray(s.docs)) throw new Error("This subject file is incomplete.");
  return data;
};

const nodeDocsIn = (node, docIds) => {
  const ids = node?.sourceDocIds || (node?.sourceDocId ? [node.sourceDocId] : []);
  return ids.some(id => docIds.has(id));
};

/**
 * subjects (all of this browser's subjects) + parsed share file →
 * {subjects, id, mode: "new" | "updated", counts: {docs, concepts, links, newDocs, newConcepts}}
 */
export const importSubject = (subjects, data, now = Date.now()) => {
  const s = data.subject;
  const all = { ...(subjects || {}) };
  const counts = { docs: s.docs.length, concepts: Object.keys(s.graph.nodes || {}).length, links: (s.graph.edges || []).filter(e => e.type === "prerequisite").length, newDocs: 0, newConcepts: 0 };
  const local = all[s.id];
  if (!local) {
    // a new subject in this browser (a different subject with the same name gets "(shared)" added)
    const nameTaken = Object.values(all).some(x => x.name === s.name);
    all[s.id] = {
      id: s.id, name: nameTaken ? `${s.name} (shared)` : s.name, emoji: s.emoji || "📘", createdAt: now,
      docs: s.docs.map(d => ({ ...d })),
      graph: { ...s.graph, nodes: Object.fromEntries(Object.entries(s.graph.nodes).map(([id, n]) => [id, sharedNode(n)])), edges: [...(s.graph.edges || [])], removedLinks: [...(s.graph.removedLinks || [])] },
      mastery: {}, importedFrom: { exportedAt: data.exportedAt || null, importedAt: now },
      ...(s.test ? { test: s.test } : {}),
    };
    counts.newDocs = counts.docs; counts.newConcepts = counts.concepts;
    return { subjects: all, id: s.id, mode: "new", counts };
  }
  // the same subject again (e.g. a newer file with more lectures): the shared file is the source of truth for
  // its own lectures, concepts and links; the learner's own progress and anything only they uploaded are kept
  const sharedDocIds = new Set(s.docs.map(d => d.id));
  const localDocs = local.docs || [];
  counts.newDocs = s.docs.filter(d => !localDocs.some(x => x.id === d.id)).length;
  const docs = [...s.docs.map(d => ({ ...d })), ...localDocs.filter(d => !sharedDocIds.has(d.id))];
  const lg = local.graph || { nodes: {}, edges: [] };
  const sharedIds = new Set(Object.keys(s.graph.nodes));
  const ownNodes = Object.entries(lg.nodes || {}).filter(([id, n]) => !sharedIds.has(id) && !nodeDocsIn(n, sharedDocIds));
  const ownIds = new Set(ownNodes.map(([id]) => id));
  counts.newConcepts = [...sharedIds].filter(id => !(lg.nodes || {})[id]).length;
  const nodes = {};
  for (const [id, n] of Object.entries(s.graph.nodes)) nodes[id] = { ...sharedNode(n), state: lg.nodes?.[id]?.state || NOT_LEARNED };   // keep this learner's state
  for (const [id, n] of ownNodes) nodes[id] = n;
  const touchesOwn = (e) => ownIds.has(e.source) || ownIds.has(e.target);
  const graph = {
    ...lg, ...s.graph, nodes,
    edges: [...(s.graph.edges || []), ...(lg.edges || []).filter(touchesOwn)],
    removedLinks: [...(s.graph.removedLinks || []), ...(lg.removedLinks || []).filter(touchesOwn)],
  };
  all[s.id] = { ...local, docs, graph, importedFrom: { exportedAt: data.exportedAt || null, importedAt: now }, ...(s.test ? { test: s.test } : {}) };
  return { subjects: all, id: s.id, mode: "updated", counts };
};
