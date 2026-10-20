// ============================================================
// RETRIEVAL (TA point 11) — RAG search over a subject's documents
// 1. Cut each document into small passages tagged with page numbers
// 2. Rank passages three ways:
//      • keyword search (BM25) — exact terms like "ReLU", "RAG"
//      • meaning search (embeddings, in the browser) — same idea in different words
//      • where the concept was found at upload (anchors)
//    and combine the three rankings (Reciprocal Rank Fusion = "hybrid" search)
// 3. Return the best passages with citation labels, e.g. "L01.pdf, p.6"
// If the meaning-search model cannot load, keyword search + anchors still work.
// ============================================================
import { conceptDocIds } from './conceptExtraction.js';

// ── text → search words ──
const STOP = new Set("a an and are as at be been but by can do does for from has have how i if in into is it its of on or our so than that the their them then there these they this to was we were what when where which while who why will with you your also may such each other more most some any not no only very".split(" "));
const stem = (w) => w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
  : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
export const tokenize = (t = "") => String(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
  .filter(w => w.length > 1 && !STOP.has(w)).map(stem);

// ── page number for a position in the saved text (PDFs only) ──
export const pageAt = (doc, offset) => {
  const ps = doc?.pageStarts;
  if (!Array.isArray(ps) || !ps.length) return null;
  let p = 1;
  for (let i = 0; i < ps.length; i++) { if (ps[i] <= offset) p = i + 1; else break; }
  return p;
};

// ── 1. passages: ~900 characters on paragraph boundaries, with page / section labels.
//    For PDFs a passage never crosses a page, so a slide = a passage and citations name the exact page. ──
const passageCache = new Map();
export const makePassages = (doc, size = 900) => {
  const text = doc?.rawText || "";
  const key = `${doc?.id}:${text.length}`;
  if (passageCache.has(key)) return passageCache.get(key);
  const ps = Array.isArray(doc?.pageStarts) && doc.pageStarts.length ? doc.pageStarts : [0];
  const segments = ps.map((s, i) => [s, i + 1 < ps.length ? ps[i + 1] : text.length]).filter(([a, b]) => b > a);
  const spans = [];
  const cutLong = (a, b) => { // split a long paragraph near spaces
    let i = a;
    while (i < b) {
      let j = Math.min(b, i + size);
      if (j < b) { const sp = text.lastIndexOf(" ", j); if (sp > i + size * 0.6) j = sp; }
      spans.push([i, j]); i = j;
    }
  };
  for (const [segA, segB] of segments) {
    const paras = []; const re = /\n\s*\n/g; re.lastIndex = segA; let last = segA, m;
    while ((m = re.exec(text)) && m.index < segB) { paras.push([last, m.index]); last = re.lastIndex; }
    paras.push([last, segB]);
    let cur = null;
    for (const [a, b] of paras) {
      if (b <= a) continue;
      if (b - a > size * 1.5) { if (cur) { spans.push(cur); cur = null; } cutLong(a, b); continue; }
      if (cur && b - cur[0] > size) { spans.push(cur); cur = [a, b]; }
      else cur = cur ? [cur[0], b] : [a, b];
    }
    if (cur) spans.push(cur);
  }
  const out = spans
    .map(([s, e]) => ({ docId: doc.id, docName: doc.name || "Document", start: s, end: e, text: text.slice(s, e).trim() }))
    .filter(p => p.text.length >= 20);
  out.forEach((p, i) => {
    const a = pageAt(doc, p.start), b = pageAt(doc, Math.max(p.start, p.end - 1));
    p.section = i + 1;
    p.label = a ? `${p.docName}, p.${a === b ? a : `${a}–${b}`}` : `${p.docName}, section ${i + 1}`;
  });
  passageCache.set(key, out);
  return out;
};

// ── 2a. keyword search (BM25). query: Map(word → weight) ──
export const bm25Rank = (passages, queryWeights) => {
  const q = [...queryWeights.entries()];
  if (!q.length || !passages.length) return [];
  const docs = passages.map(p => tokenize(p.text));
  const N = docs.length, avg = docs.reduce((a, d) => a + d.length, 0) / N || 1;
  const df = {};
  docs.forEach(d => new Set(d).forEach(w => { df[w] = (df[w] || 0) + 1; }));
  const k1 = 1.5, b = 0.75;
  return docs.map((d, i) => {
    const tf = {}; d.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
    let s = 0;
    for (const [w, wt] of q) {
      if (!tf[w]) continue;
      const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
      s += wt * idf * (tf[w] * (k1 + 1)) / (tf[w] + k1 * (1 - b + b * d.length / avg));
    }
    return { i, s };
  }).filter(x => x.s > 0).sort((x, y) => y.s - x.s).map(x => x.i);
};

const weightedQuery = (concept, question) => {
  const w = new Map();
  const add = (t, wt) => tokenize(t).forEach(x => w.set(x, Math.max(w.get(x) || 0, wt)));
  add(concept?.definition, 1);
  add(concept?.name, 2);   // the concept's own name matters most
  add(question, 2);        // in chat, the learner's question matters too
  return w;
};

// ── 2b. meaning search (embeddings), loaded on demand from a CDN, runs in the browser ──
const MODEL_LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
const MODEL = "Xenova/all-MiniLM-L6-v2";
let embedderPromise = null;
export const loadEmbedder = () => {
  if (!embedderPromise) embedderPromise = (async () => {
    try {
      const { pipeline } = await import(/* @vite-ignore */ MODEL_LIB);
      const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
      return async (texts) => (await extractor(texts, { pooling: "mean", normalize: true })).tolist();
    } catch (e) {
      console.warn("Meaning search unavailable — using keyword search only.", e);
      return null;
    }
  })();
  return embedderPromise;
};
export const setEmbedderForTests = (fn) => { embedderPromise = Promise.resolve(fn); vecCache.clear(); };

const vecCache = new Map(); // passage → vector, kept for this session
const vecKey = (p) => `${p.docId}:${p.start}:${p.end}`;
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const embedRank = async (passages, queryText, embed) => {
  const missing = passages.filter(p => !vecCache.has(vecKey(p)));
  for (let i = 0; i < missing.length; i += 16) {
    const batch = missing.slice(i, i + 16);
    const vecs = await embed(batch.map(p => p.text.slice(0, 1000)));
    vecs.forEach((v, j) => vecCache.set(vecKey(batch[j]), v));
  }
  const [qv] = await embed([queryText]);
  return passages.map((p, i) => ({ i, s: dot(qv, vecCache.get(vecKey(p))) }))
    .sort((x, y) => y.s - x.s).map(x => x.i);
};

// ── 2c + 3. combine rankings and pick passages ──
const rrf = (lists, k = 60) => {
  const score = new Map();
  lists.forEach(list => list.forEach((idx, r) => score.set(idx, (score.get(idx) || 0) + 1 / (k + r + 1))));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([idx]) => idx);
};

const pick = (passages, order, k, maxChars) => {
  const out = []; let chars = 0;
  for (const idx of order) {
    if (out.length >= k) break;
    const p = passages[idx];
    if (out.length && chars + p.text.length > maxChars) continue;
    out.push(p); chars += p.text.length;
  }
  return out;
};

/**
 * Find the best passages for a concept (and, in chat, a learner's question).
 * mode: "hybrid" (default) | "keyword" | "meaning" | "question-only" | "first-8000"
 * Returns { passages: [{text, label, docName, start, end, ...}], mode: what was actually used }
 */
export const retrieve = async (subject, concept, { question = "", k = 5, maxChars = 6000, mode = "hybrid" } = {}) => {
  const ids = conceptDocIds(concept);
  const docs = (subject?.docs || []).filter(d => ids.includes(d.id) && (d.rawText || "").length > 0);
  const passages = docs.flatMap(d => makePassages(d));
  if (!passages.length) return { passages: [], mode: "none" };

  if (mode === "first-8000") { // how Learnova worked before point 11 (for the search test)
    const first = docs[0]; const cut = 8000;
    const ps = passages.map((p, i) => i).filter(i => passages[i].docId === first.id && passages[i].start < cut);
    return { passages: ps.map(i => passages[i]), mode };
  }
  if (mode === "question-only") { // like the old RAG: the learner's words only
    return { passages: pick(passages, bm25Rank(passages, weightedQuery(null, question)), k, maxChars), mode };
  }

  const lists = [];
  const kw = bm25Rank(passages, weightedQuery(concept, question));
  if (mode !== "meaning") lists.push(kw);

  // passages from where the concept was found at upload, best keyword match first
  const anchors = Array.isArray(concept?.anchors) ? concept.anchors : [];
  if (anchors.length && mode !== "meaning") {
    const pos = new Map(kw.map((idx, r) => [idx, r]));
    const anchored = passages.map((_, i) => i)
      .filter(i => anchors.some(a => a.docId === passages[i].docId && a.start < passages[i].end && a.end > passages[i].start))
      .sort((x, y) => (pos.has(x) ? pos.get(x) : 1e9) - (pos.has(y) ? pos.get(y) : 1e9));
    lists.push(anchored);
  }

  let used = mode === "keyword" ? "keyword" : "keyword (meaning search unavailable)";
  if (mode === "hybrid" || mode === "meaning") {
    const embed = await loadEmbedder();
    if (embed) {
      try {
        const queryText = [concept?.name, concept?.definition, question].filter(Boolean).join(". ");
        lists.push(await embedRank(passages, queryText, embed));
        used = mode;
      } catch (e) { console.warn("Meaning search failed — using keyword search only.", e); }
    }
  }
  return { passages: pick(passages, rrf(lists), k, maxChars), mode: used };
};

// ── helpers for prompts and the Sources list ──
export const passagesForPrompt = (ps) => ps.map((p, i) => `[S${i + 1}] (${p.label})\n${p.text}`).join("\n\n");
export const sourcesOf = (ps) => ps.map((p, i) => ({ tag: `S${i + 1}`, label: p.label, snippet: p.text.replace(/\s+/g, " ").slice(0, 160) }));
