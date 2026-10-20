// ============================================================
// PREREQUISITE LINKS (TA point 12) — make, check and fix "A must come before B" links
// 1. Propose: links inside one PDF, and links between a new PDF and earlier PDFs.
//    Claude must give a one-line reason for every link.
// 2. Evidence (no AI): look for A's name in B's lecture pages → "mentioned on L05.pdf p.4".
// 3. Check: a separate, stricter Claude "checker" answers Keep / Reverse / Drop + confidence.
// 4. Save only links that pass, with reason, evidence and confidence. Never a loop.
// People can Confirm / Flip / Remove / Add links on the Graph screen; their decisions are never undone.
// ============================================================
import { graphEngine, exJSON } from './utils.js';
import { conceptDocIds } from './conceptExtraction.js';
import { pageAt, tokenize } from './retrieval.js';

// ── prompts ──
// Links among one document's concepts (runs after parts are combined,
// so links between concepts found in different parts are not lost)
export const LINKS_PROMPT = `You are given the concepts from one lecture document.
List prerequisite links: A is a prerequisite of B only if B genuinely cannot be understood without first understanding A. Do not link concepts that are merely related.
For every link give a one-line reason.
Return ONLY valid JSON, nothing else:
{"relationships":[{"source":"l1","target":"l2","reason":"why l1 must come first"}]}
where "source" is the prerequisite. Use an empty list if there are none.`;

// Links between a new document and the documents uploaded before it
export const CROSS_LINKS_PROMPT = `You are given concepts from a NEW lecture and concepts from EARLIER lectures of the same course.
Find links BETWEEN the two lists only — never between two NEW concepts and never between two EARLIER concepts:
- an EARLIER concept that must be understood before a NEW concept, or
- a NEW concept that must be understood before an EARLIER concept.
A is a prerequisite of B only if B genuinely cannot be understood without first understanding A. Do not link concepts that are merely related or on the same topic.
For every link give a one-line reason.
Return ONLY valid JSON, nothing else:
{"relationships":[{"source":"e3","target":"n1","reason":"why e3 must come first"}]}
where "source" is the prerequisite. Use an empty list if there are none.`;

// The checker: a separate, stricter second opinion on every proposed link
export const LINK_CHECK_PROMPT = `You are a strict reviewer of prerequisite links in a course knowledge graph.
Each link "A → B" claims that A must be understood before B.
For each link decide:
- "keep": B genuinely cannot be understood without A, and the direction is right
- "reverse": the two really depend on each other in one direction, but it is B that must come before A
- "drop": they are only related or on the same topic, or B can be learned without A
Use the lecture evidence when it is given (where B's lecture mentions A). Missing evidence alone is not a reason to drop.
Give a confidence ("high", "medium" or "low") and a one-line reason.
Return ONLY valid JSON, nothing else:
{"checks":[{"id":"k1","verdict":"keep","confidence":"high","reason":"..."}]}
Include every link id exactly once.`;

const MAX_EARLIER = 250;   // earlier concepts shown to Claude at once (most related first)
const CHECK_BATCH = 30;    // links per checker call

// ── small helpers ──
const oneLine = (s, n = 200) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const conceptLine = (key, n) => `${key}: ${n?.name || ""} — ${oneLine(n?.definition)}`;
const pairKey = (s, t) => `${s}→${t}`;
const CONF_RANK = { high: 0, medium: 1, low: 2, unchecked: 3 };

// Ask Claude for JSON; if the reply is not the expected JSON, ask once more. API errors are thrown.
const askJSON = async (callClaude, sys, usr, maxTokens, field) => {
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callClaude(sys, usr + (attempt ? "\n\nReply with the JSON only." : ""), maxTokens, 0);
    const parsed = exJSON(raw || "");
    if (parsed && Array.isArray(parsed[field])) return parsed[field];
    last = oneLine(raw || "(empty reply)", 120);
  }
  throw new Error(`Claude did not return a valid list (replied: "${last}…")`);
};

// same PDF → "within-pdf", otherwise "across-pdfs"
export const originOf = (nodes, a, b) => {
  const da = conceptDocIds(nodes[a] || {}), db = conceptDocIds(nodes[b] || {});
  return da.some(d => db.includes(d)) ? "within-pdf" : "across-pdfs";
};

const personRemovedSet = (graph) =>
  new Set((graph.removedLinks || []).filter(r => r.removedBy === "person").map(r => pairKey(r.source, r.target)));
const hasEdge = (graph, s, t) => (graph.edges || []).some(e => e.source === s && e.target === t && e.type === "prerequisite");

// ── 2. lecture evidence (no AI) ──
// Name variants: "Retrieval-Augmented Generation (RAG)" → full name, "rag", plural/singular
export const nameVariants = (name = "") => {
  const out = new Set();
  const add = (s) => { s = String(s || "").trim().toLowerCase(); if (s.length >= 2) out.add(s); };
  const n = String(name).trim();
  add(n);
  const paren = n.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (paren) { add(paren[1]); add(paren[2]); }
  [...out].filter(v => !v.includes("(")).forEach(v => { if (v.length > 4 && v.endsWith("s") && !v.endsWith("ss")) out.add(v.slice(0, -1)); else if (v.length > 3) out.add(v + "s"); });
  return [...out];
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findIn = (text, variants, from, to) => {
  const slice = text.slice(from, to).toLowerCase();
  let best = -1, len = 0;
  for (const v of variants) {
    const m = new RegExp(`(^|[^a-z0-9])${escapeRe(v)}(?=[^a-z0-9]|$)`).exec(slice);
    if (m) { const at = m.index + m[1].length; if (best < 0 || at < best) { best = at; len = v.length; } }
  }
  return best < 0 ? null : { at: from + best, len };
};

/** Where does B's lecture mention A? → {docId, docName, page, snippet, where} or null.
 *  Looks first in the pages where B was found at upload, then anywhere in B's documents. */
export const findEvidence = (docs = [], nodes = {}, aId, bId) => {
  const a = nodes[aId], b = nodes[bId];
  if (!a || !b) return null;
  const variants = nameVariants(a.name);
  if (!variants.length) return null;
  const bDocs = conceptDocIds(b);
  const docById = Object.fromEntries((docs || []).map(d => [d.id, d]));
  const hit = (doc, found, where) => {
    const text = doc.rawText || "";
    const s = Math.max(0, found.at - 60), e = Math.min(text.length, found.at + found.len + 60);
    return { docId: doc.id, docName: doc.name || "Document", page: pageAt(doc, found.at), snippet: (s > 0 ? "…" : "") + oneLine(text.slice(s, e), 200) + (e < text.length ? "…" : ""), where };
  };
  for (const an of (Array.isArray(b.anchors) ? b.anchors : [])) {
    const doc = docById[an.docId];
    if (!doc?.rawText) continue;
    const f = findIn(doc.rawText, variants, an.start, an.end);
    if (f) return hit(doc, f, "concept pages");
  }
  for (const id of bDocs) {
    const doc = docById[id];
    if (!doc?.rawText) continue;
    const f = findIn(doc.rawText, variants, 0, doc.rawText.length);
    if (f) return hit(doc, f, "same lecture");
  }
  return null;
};
export const evidenceLabel = (ev) => !ev ? "" : `${ev.docName}${ev.page ? ` p.${ev.page}` : ""}`;

// ── 1. propose ──
export const proposeWithin = async (callClaude, nodes, ids) => {
  ids = [...new Set(ids)].filter(id => nodes[id]);
  if (ids.length < 2) return [];
  const map = {};
  const list = ids.map((id, i) => { map[`l${i + 1}`] = id; return conceptLine(`l${i + 1}`, nodes[id]); }).join("\n");
  const rels = await askJSON(callClaude, LINKS_PROMPT, list, 3000, "relationships");
  return rels.map(r => ({ source: map[r?.source], target: map[r?.target], reason: oneLine(r?.reason) }))
    .filter(r => r.source && r.target && r.source !== r.target);
};

// Pick the earlier concepts most related to the new ones (only when there are very many)
const shortlist = (nodes, newIds, earlierIds, max) => {
  if (earlierIds.length <= max) return earlierIds;
  const words = new Set(newIds.flatMap(id => tokenize(`${nodes[id]?.name} ${nodes[id]?.definition}`)));
  return earlierIds
    .map((id, i) => ({ id, i, s: tokenize(`${nodes[id]?.name} ${nodes[id]?.name} ${nodes[id]?.definition}`).filter(w => words.has(w)).length }))
    .sort((x, y) => y.s - x.s || x.i - y.i).slice(0, max).map(x => x.id);
};

export const proposeAcross = async (callClaude, nodes, newIds, earlierIds) => {
  newIds = [...new Set(newIds)].filter(id => nodes[id]);
  const newSet = new Set(newIds);
  earlierIds = [...new Set(earlierIds)].filter(id => nodes[id] && !newSet.has(id));
  if (!newIds.length || !earlierIds.length) return [];
  const shown = shortlist(nodes, newIds, earlierIds, MAX_EARLIER);
  const map = {};
  const nList = newIds.map((id, i) => { map[`n${i + 1}`] = id; return conceptLine(`n${i + 1}`, nodes[id]); }).join("\n");
  const eList = shown.map((id, i) => { map[`e${i + 1}`] = id; return conceptLine(`e${i + 1}`, nodes[id]); }).join("\n");
  const rels = await askJSON(callClaude, CROSS_LINKS_PROMPT, `NEW:\n${nList}\n\nEARLIER:\n${eList}`, 4000, "relationships");
  return rels.map(r => ({ source: map[r?.source], target: map[r?.target], reason: oneLine(r?.reason) }))
    .filter(r => r.source && r.target && r.source !== r.target && (newSet.has(r.source) !== newSet.has(r.target)));
};

// ── 3. check ──
/** candidates: [{source, target, reason}] → same list with {verdict, confidence, checkNote, evidence};
 *  verdict "unchecked" when the checker could not answer. */
export const checkLinks = async (callClaude, nodes, docs, candidates, onStep) => {
  const withEv = candidates.map(c => ({ ...c, evidence: findEvidence(docs, nodes, c.source, c.target) }));
  const out = [];
  let failed = "";
  for (let i = 0; i < withEv.length; i += CHECK_BATCH) {
    const batch = withEv.slice(i, i + CHECK_BATCH);
    onStep?.(`Checking links (${Math.min(i + CHECK_BATCH, withEv.length)} of ${withEv.length})...`);
    const lines = batch.map((c, j) => {
      const a = nodes[c.source], b = nodes[c.target];
      const ev = c.evidence ? `${evidenceLabel(c.evidence)} mentions "${a.name}": "${c.evidence.snippet}"` : "none found";
      return `k${j + 1}: A = "${a.name}" (${oneLine(a.definition, 160)}) → B = "${b.name}" (${oneLine(b.definition, 160)})\n   proposed because: ${c.reason || "(no reason given)"}\n   lecture evidence: ${ev}`;
    }).join("\n");
    let checks = [];
    try { checks = await askJSON(callClaude, LINK_CHECK_PROMPT, lines, 3000, "checks"); }
    catch (e) { failed = failed || e.message; checks = []; }
    const byId = Object.fromEntries(checks.map(x => [x?.id, x]));
    batch.forEach((c, j) => {
      const x = byId[`k${j + 1}`];
      const verdict = ["keep", "reverse", "drop"].includes(x?.verdict) ? x.verdict : "unchecked";
      const confidence = verdict === "unchecked" ? "unchecked" : (["high", "medium", "low"].includes(x?.confidence) ? x.confidence : "medium");
      out.push({ ...c, verdict, confidence, checkNote: oneLine(x?.reason) });
    });
  }
  return { checked: out, failed };
};

// ── 4. save what passed ──
/** Adds the checked links to the graph. Keeps the strongest links first, never a loop,
 *  never a pair a person removed. Dropped links are remembered (for the links CSV). */
export const applyChecked = (graph, nodes, docs, checked) => {
  let g = { ...graph, edges: [...(graph.edges || [])], removedLinks: [...(graph.removedLinks || [])] };
  const blocked = personRemovedSet(g);
  const stats = { within: 0, across: 0, dropped: 0, reversed: 0, unchecked: 0, loops: 0 };
  const sorted = [...checked].sort((x, y) => (x.verdict === "drop") - (y.verdict === "drop") || CONF_RANK[x.confidence] - CONF_RANK[y.confidence]);
  const now = Date.now();
  for (const c of sorted) {
    if (c.verdict === "drop") {
      stats.dropped++;
      g.removedLinks = g.removedLinks.filter(r => !(r.source === c.source && r.target === c.target && r.removedBy === "checker"));
      g.removedLinks.push({ source: c.source, target: c.target, type: "prerequisite", reason: c.reason, checkNote: c.checkNote, confidence: c.confidence, evidence: c.evidence, origin: originOf(nodes, c.source, c.target), removedBy: "checker", removedAt: now });
      continue;
    }
    let { source, target, evidence } = c;
    if (c.verdict === "reverse") { [source, target] = [target, source]; evidence = findEvidence(docs, nodes, source, target); }
    if (blocked.has(pairKey(source, target)) || hasEdge(g, source, target)) continue;
    if (graphEngine.wouldCreateCycle(g, source, target)) { stats.loops++; continue; }
    const origin = originOf(nodes, source, target);
    // re-check: if the checker could not answer, a link checked before keeps its earlier result
    if (c.verdict === "unchecked" && c.prev && c.prev.checkedBy === "ai") {
      const { source: _s, target: _t, type: _ty, ...prevFields } = c.prev;
      g = graphEngine.addEdge(g, source, target, "prerequisite", { ...prevFields, reason: c.prev.reason || c.reason, origin });
      if (origin === "within-pdf") stats.within++; else stats.across++;
      continue;
    }
    g = graphEngine.addEdge(g, source, target, "prerequisite", {
      reason: c.verdict === "reverse" ? (c.checkNote || c.reason) : c.reason,
      checkNote: c.checkNote || "", confidence: c.confidence, evidence: evidence || null, origin,
      checkedBy: c.verdict === "unchecked" ? "none" : "ai", createdAt: now,
    });
    g.removedLinks = g.removedLinks.filter(r => !(r.source === source && r.target === target && r.removedBy === "checker"));
    if (c.verdict === "reverse") stats.reversed++;
    if (c.verdict === "unchecked") stats.unchecked++;
    if (origin === "within-pdf") stats.within++; else stats.across++;
  }
  return { graph: g, stats };
};

const dedupe = (graph, list) => {
  const blocked = personRemovedSet(graph), seen = new Map(), out = [];
  for (const c of list) {
    const k = pairKey(c.source, c.target);
    if (seen.has(k)) { const first = seen.get(k); if (!first.reason && c.reason) first.reason = c.reason; continue; } // keep a reason if any copy has one
    if (blocked.has(k) || hasEdge(graph, c.source, c.target)) continue;
    const copy = { ...c }; seen.set(k, copy); out.push(copy);
  }
  return out;
};

/** At upload: links inside the new PDF + links to concepts from earlier PDFs, then the check.
 *  docIds = the new PDF's concepts (new and merged). docs must include the new document. */
export const linkNewDocument = async (callClaude, graph, docs, docIds, onStep) => {
  const nodes = graph.nodes || {};
  const inDoc = new Set(docIds);
  const earlierIds = Object.keys(nodes).filter(id => !inDoc.has(id));
  const problems = [];
  onStep?.("Finding prerequisite links (inside this PDF and to earlier PDFs)...");
  const [within, across] = await Promise.all([
    proposeWithin(callClaude, nodes, docIds).catch(e => { problems.push(`inside this PDF: ${e.message}`); return []; }),
    proposeAcross(callClaude, nodes, docIds, earlierIds).catch(e => { problems.push(`to earlier PDFs: ${e.message}`); return []; }),
  ]);
  const candidates = dedupe(graph, [...within, ...across]);
  const { checked, failed } = await checkLinks(callClaude, nodes, docs, candidates, onStep);
  if (failed) problems.push(`checker: ${failed}`);
  const { graph: g, stats } = applyChecked(graph, nodes, docs, checked);
  return { graph: g, stats: { ...stats, proposed: candidates.length, problems } };
};

/** "Re-check links" (Graph screen): propose again across the whole subject (PDF by PDF, in upload order),
 *  re-check every AI link, keep every link a person confirmed or added, never re-add one a person removed. */
export const recheckAllLinks = async (callClaude, graph, docs, onStep) => {
  const nodes = graph.nodes || {};
  const groups = (docs || []).map(d => Object.keys(nodes).filter(id => conceptDocIds(nodes[id]).includes(d.id)));
  const noDoc = Object.keys(nodes).filter(id => !conceptDocIds(nodes[id]).some(d => (docs || []).some(x => x.id === d)));
  if (noDoc.length) groups.push(noDoc);
  const problems = [];
  const tasks = [];
  const seenSoFar = new Set();
  groups.forEach((ids, gi) => {
    const earlier = [...seenSoFar].filter(id => !ids.includes(id));
    const label = docs[gi]?.name || "concepts without a document";
    tasks.push(() => proposeWithin(callClaude, nodes, ids).catch(e => { problems.push(`${label}: ${e.message}`); return []; }));
    if (earlier.length) tasks.push(() => proposeAcross(callClaude, nodes, ids, earlier).catch(e => { problems.push(`${label} ↔ earlier PDFs: ${e.message}`); return []; }));
    ids.forEach(id => seenSoFar.add(id));
  });
  const proposals = [];
  for (let i = 0; i < tasks.length; i += 3) {
    onStep?.(`Finding links (${Math.min(i + 3, tasks.length)} of ${tasks.length})...`);
    (await Promise.all(tasks.slice(i, i + 3).map(t => t()))).forEach(r => proposals.push(...r));
  }
  // start from the links people decided on; every AI link is checked again
  const personEdges = (graph.edges || []).filter(e => e.type === "prerequisite" && e.checkedBy === "person");
  const aiEdges = (graph.edges || []).filter(e => e.type === "prerequisite" && e.checkedBy !== "person");
  const otherEdges = (graph.edges || []).filter(e => e.type !== "prerequisite");
  const base = { ...graph, edges: [...otherEdges, ...personEdges], removedLinks: (graph.removedLinks || []).filter(r => r.removedBy === "person") };
  const personPairs = new Set(personEdges.flatMap(e => [pairKey(e.source, e.target), pairKey(e.target, e.source)]));
  const candidates = dedupe(base, [...aiEdges.map(e => ({ source: e.source, target: e.target, reason: e.reason || "", prev: e })), ...proposals])
    .filter(c => !personPairs.has(pairKey(c.source, c.target)));
  const { checked, failed } = await checkLinks(callClaude, nodes, docs, candidates, onStep);
  if (failed) problems.push(`checker: ${failed}`);
  const { graph: g, stats } = applyChecked(base, nodes, docs, checked);
  const before = new Set(aiEdges.map(e => pairKey(e.source, e.target)));
  const added = g.edges.filter(e => e.checkedBy !== "person" && !before.has(pairKey(e.source, e.target))).length;
  return { graph: g, stats: { ...stats, proposed: candidates.length, added, kept: stats.within + stats.across, personKept: personEdges.length, problems } };
};

// ── person's decisions (Graph screen) ──
const removeRecord = (graph, s, t, extra) => {
  const e = (graph.edges || []).find(x => x.source === s && x.target === t && x.type === "prerequisite");
  return {
    ...graph,
    edges: (graph.edges || []).filter(x => x !== e),
    removedLinks: [
      ...(graph.removedLinks || []).filter(r => !(r.source === s && r.target === t)),
      { ...(e || { source: s, target: t, type: "prerequisite" }), removedBy: "person", removedAt: Date.now(), ...extra },
    ],
  };
};

export const confirmLink = (graph, s, t) => ({
  ...graph,
  edges: (graph.edges || []).map(e => e.source === s && e.target === t && e.type === "prerequisite"
    ? { ...e, checkedBy: "person", personVerdict: "confirmed", confirmedAt: Date.now() } : e),
});

export const removeLink = (graph, s, t) => removeRecord(graph, s, t, { personVerdict: "removed" });

export const flipLink = (graph, docs, s, t) => {
  const old = (graph.edges || []).find(e => e.source === s && e.target === t && e.type === "prerequisite");
  const without = removeRecord(graph, s, t, { personVerdict: "flipped" });
  if (graphEngine.wouldCreateCycle(without, t, s)) return { graph, error: "Can't flip — the other direction would create a loop." };
  const nodes = graph.nodes || {};
  const g = graphEngine.addEdge(without, t, s, "prerequisite", {
    reason: `Flipped by a person${old?.reason ? ` (was: ${old.reason})` : ""}`, checkNote: "", confidence: "person",
    evidence: findEvidence(docs, nodes, t, s), origin: originOf(nodes, t, s), checkedBy: "person", personVerdict: "flipped", createdAt: Date.now(),
  });
  return { graph: { ...g, removedLinks: (g.removedLinks || []).filter(r => !(r.source === t && r.target === s)) }, error: "" };
};

export const addLink = (graph, docs, s, t, reason = "") => {
  if (!s || !t || s === t) return { graph, error: "Pick two different concepts." };
  if (hasEdge(graph, s, t)) return { graph, error: "This link already exists." };
  if (graphEngine.wouldCreateCycle(graph, s, t)) return { graph, error: "Can't add — this link would create a loop." };
  const nodes = graph.nodes || {};
  const g = graphEngine.addEdge(graph, s, t, "prerequisite", {
    reason: oneLine(reason) || "Added by a person", checkNote: "", confidence: "person",
    evidence: findEvidence(docs, nodes, s, t), origin: originOf(nodes, s, t), checkedBy: "person", personVerdict: "added", createdAt: Date.now(),
  });
  return { graph: { ...g, removedLinks: (g.removedLinks || []).filter(r => !(r.source === s && r.target === t)) }, error: "" };
};

// ── links CSV (for measuring link accuracy — TA point 13) ──
const LINK_COLUMNS = ["subject", "prerequisite", "concept", "status", "origin", "reason", "checker_note", "confidence", "checked_by", "person_verdict", "evidence", "evidence_text", "prerequisite_pdfs", "concept_pdfs"];
const csvCell = (v) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const linksCsv = (subject) => {
  const nodes = subject.graph?.nodes || {};
  const docName = Object.fromEntries((subject.docs || []).map(d => [d.id, d.name]));
  const pdfs = (id) => conceptDocIds(nodes[id] || {}).map(d => docName[d] || d).join("; ");
  const ORIGIN = { "within-pdf": "inside one PDF", "across-pdfs": "across PDFs" };
  const row = (e, status) => [
    subject.name, nodes[e.source]?.name || e.source, nodes[e.target]?.name || e.target, status,
    e.personVerdict === "added" ? "added by a person" : (ORIGIN[e.origin] || ""),
    e.reason, e.checkNote, e.confidence || "", e.checkedBy || (status === "active" ? "none" : ""), e.personVerdict || "",
    evidenceLabel(e.evidence), e.evidence?.snippet || "", pdfs(e.source), pdfs(e.target),
  ];
  const active = (subject.graph?.edges || []).filter(e => e.type === "prerequisite").map(e => row(e, "active"));
  const removed = (subject.graph?.removedLinks || []).map(r => row(r, r.removedBy === "person" ? "removed by person" : "dropped by checker"));
  return [LINK_COLUMNS, ...active, ...removed].map(r => r.map(csvCell).join(",")).join("\r\n");
};
