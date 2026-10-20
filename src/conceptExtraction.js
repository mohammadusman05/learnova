import { LECTURE_GUARD } from './privacy.js';
// ============================================================
// CONCEPT EXTRACTION HELPERS  (TA feedback point 6: concept granularity)
// Pure functions + prompts used by UploadScreen. No API calls here.
// ============================================================

// Part 1 — written definition of a concept, used in every extraction prompt
export const CONCEPT_DEFINITION = `A CONCEPT is the smallest idea that:
(1) can be explained on its own in about 5-10 minutes,
(2) can be tested with at least 3 different questions, and
(3) a lecturer would use as a slide title.

Right size: "Backpropagation", "Attention Mechanism", "Gradient Descent", "Tokenization"
Too broad (do NOT extract): "Deep Learning", "Large Language Models", "Machine Learning"
Too narrow (do NOT extract): "Derivative of sigmoid", "Weight w11", "Learning rate of 0.01"
Not concepts (do NOT extract): example sentences, people's names, course logistics, copyright or watermark notices, slide numbers, and topics that are only listed in a roadmap or agenda but not actually taught in the text.`;

// Parts 2 + 3 — per-part extraction prompt (no fixed concept count)
export const EXTRACT_PROMPT = `You extract the concepts TAUGHT in one part of a lecture document.

${CONCEPT_DEFINITION}

Rules:
- Extract every concept in this part that fits the definition. There is no fixed number; if this part teaches no concept, return an empty list.
- Use the name a lecturer would use. The definition is one clear sentence based on the text.
- Return ONLY valid JSON, nothing else:
{"topic":"Overall topic of this part","concepts":[{"name":"Name","definition":"One clear sentence","importance":0.8,"difficulty":0.5}]}
${LECTURE_GUARD}`;

// Part 5 — decide which concepts are the same idea
export const MERGE_PROMPT = `You decide which concepts are the SAME idea.
NEW = concepts just extracted from one document. EXISTING = concepts already in the subject.
Two concepts are the same only if they describe the same idea at the same level of detail, even if worded differently (e.g. "Attention Mechanism" and "Attention").
A broader or narrower concept is NOT the same (e.g. "Attention" and "Multi-Head Attention" are different).
Return ONLY valid JSON, nothing else:
{"sameAsExisting":[{"new":"n1","existing":"e3"}],"duplicatesWithinNew":[{"keep":"n2","drop":"n5"}]}
Use empty lists when there are no matches.`;

// Prerequisite-link prompts moved to prereqLinks.js (TA point 12)

// Lower-case, drop punctuation, collapse spaces, drop simple plural "s"
export const normalizeName = (name = "") =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map(w => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");

// Part 4 — remove short lines that repeat on many pages (watermarks, footers, page numbers).
// Only lines of 12–150 characters are candidates, so long content lines are never removed.
export const stripRepeatedLines = (text = "", minRepeats = 3) => {
  const lines = String(text).split(/\r?\n/);
  const key = l => l.toLowerCase().replace(/[0-9]+/g, "").replace(/\s+/g, " ").trim();
  const isCandidate = k => k.length >= 12 && k.length <= 150;
  const counts = {};
  lines.forEach(l => {
    const k = key(l);
    if (isCandidate(k)) counts[k] = (counts[k] || 0) + 1;
  });
  return lines
    .filter(l => {
      const k = key(l);
      return !(isCandidate(k) && counts[k] >= minRepeats);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Part 4 — split text into parts of about `size` characters, on paragraph boundaries.
// Also returns where each part sits in the text (start/end), so concepts can be located later (point 11).
export const splitIntoPartsWithOffsets = (text = "", size = 6000) => {
  const s = String(text);
  const paras = []; const re = /\n\s*\n/g; let last = 0, m;
  while ((m = re.exec(s))) { paras.push([last, m.index]); last = re.lastIndex; }
  paras.push([last, s.length]);
  const parts = []; let cur = null;
  const push = (a, b) => { const t = s.slice(a, b).trim(); if (t) parts.push({ text: t, start: a, end: b }); };
  for (const [a, b] of paras) {
    if (b - a > size) {
      if (cur) { push(cur[0], cur[1]); cur = null; }
      for (let i = a; i < b; i += size) push(i, Math.min(b, i + size));
      continue;
    }
    if (cur && b - cur[0] > size) { push(cur[0], cur[1]); cur = [a, b]; }
    else cur = cur ? [cur[0], b] : [a, b];
  }
  if (cur) push(cur[0], cur[1]);
  return parts;
};
export const splitIntoParts = (text = "", size = 6000) => splitIntoPartsWithOffsets(text, size).map(p => p.text);

// Part 4 — combine the concepts found in each part, removing exact repeats.
// `parts` lists which parts each concept was found in (used for point 11 anchors).
export const combineConcepts = (partResults = []) => {
  const byKey = new Map();
  partResults.forEach((r, idx) =>
    (r?.concepts || []).forEach(c => {
      if (!c?.name) return;
      const k = normalizeName(c.name);
      if (!k) return;
      if (byKey.has(k)) { const e = byKey.get(k); if (!e.parts.includes(idx)) e.parts.push(idx); return; }
      byKey.set(k, {
        name: String(c.name).trim(),
        definition: String(c.definition || "").trim(),
        importance: c.importance,
        difficulty: c.difficulty,
        parts: [idx],
      });
    })
  );
  return [...byKey.values()];
};

// Point 11 — PDF pages are joined with markers like "[[PAGE 3]]" before cleaning.
// This removes the markers and records where each page starts in the cleaned text.
export const joinPagesWithMarkers = (pages = []) => pages.map((p, i) => `[[PAGE ${i + 1}]]\n${p}`).join("\n\n");
export const removePageMarkers = (marked = "") => {
  const re = /\[\[PAGE (\d+)\]\]\n?/g;
  let out = "", last = 0, m; const pageStarts = [];
  while ((m = re.exec(marked))) {
    out += marked.slice(last, m.index);
    pageStarts[Number(m[1]) - 1] = out.length;
    last = re.lastIndex;
  }
  out += marked.slice(last);
  // pages whose text was entirely removed (e.g. only a watermark) start where the next text starts
  for (let i = 0; i < pageStarts.length; i++) if (pageStarts[i] === undefined) pageStarts[i] = i ? pageStarts[i - 1] : 0;
  const text = out.replace(/^\s+/, "");
  const shift = out.length - text.length;
  return { text, pageStarts: pageStarts.map(x => Math.max(0, x - shift)) };
};

// Part 5 — decide, for every new concept, whether it is new, the same as an existing
// concept, or a duplicate of another new concept.
//   newConcepts:   [{localId, name, ...}]
//   existingNodes: [{id, name, ...}]
//   llm:           {sameAsExisting:[{new, existing(real id)}], duplicatesWithinNew:[{keep, drop}]}
// Returns { [localId]: {existing: realId} | {new: localId} }
export const planMerge = (newConcepts = [], existingNodes = [], llm = {}) => {
  const existingByKey = new Map();
  existingNodes.forEach(n => {
    const k = normalizeName(n.name);
    if (k && !existingByKey.has(k)) existingByKey.set(k, n.id);
  });
  const existingIds = new Set(existingNodes.map(n => n.id));
  const localIds = new Set(newConcepts.map(c => c.localId));
  const map = {};

  // 1. exact / near-identical names merge automatically
  newConcepts.forEach(c => {
    const hit = existingByKey.get(normalizeName(c.name));
    if (hit) map[c.localId] = { existing: hit };
  });
  // 2. Claude's judgement for close-but-not-identical names
  (llm.sameAsExisting || []).forEach(p => {
    if (localIds.has(p?.new) && existingIds.has(p?.existing) && !map[p.new]) map[p.new] = { existing: p.existing };
  });
  // 3. duplicates inside the same document (first answer wins; never create a loop)
  const leadsTo = (from, target) => {
    const seen = new Set();
    let cur = from;
    while (map[cur]?.sameAs && !seen.has(cur)) { seen.add(cur); cur = map[cur].sameAs; if (cur === target) return true; }
    return false;
  };
  (llm.duplicatesWithinNew || []).forEach(p => {
    if (!localIds.has(p?.keep) || !localIds.has(p?.drop) || p.keep === p.drop || map[p.drop]) return;
    if (leadsTo(p.keep, p.drop)) return;
    map[p.drop] = { sameAs: p.keep };
  });

  const resolve = (lid, seen = new Set()) => {
    const m = map[lid];
    if (!m) return { new: lid };
    if (m.existing) return { existing: m.existing };
    if (seen.has(lid)) return { new: lid };
    seen.add(lid);
    return resolve(m.sameAs, seen);
  };
  const result = {};
  newConcepts.forEach(c => { result[c.localId] = resolve(c.localId); });
  return result;
};

// Which documents a concept belongs to (old concepts only have sourceDocId)
export const conceptDocIds = (c) =>
  Array.isArray(c?.sourceDocIds) && c.sourceDocIds.length ? c.sourceDocIds : (c?.sourceDocId ? [c.sourceDocId] : []);
