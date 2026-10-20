// ============================================================
// KNOWLEDGE GRAPH — CARD VIEW (what each card shows)
// Display only: it reads concepts, links and mastery and decides how to show them.
// It changes nothing — the unlock rule (prerequisites at 60%) and Mastered (95%) are the same ones Study uses.
// ============================================================
import { graphEngine, MASTERY_THRESHOLD, UNLOCK_THRESHOLD } from './utils.js';
import { conceptDocIds } from './conceptExtraction.js';

export const LAYER_COLORS = ['#e8503f', '#7c3aed', '#0d9488', '#d97706', '#2563eb', '#16a34a', '#db2777'];
export const layerColor = (i) => LAYER_COLORS[i % LAYER_COLORS.length];
export const layerName = (i, maxLayer) => i === 0 ? "Foundation" : i === maxLayer && maxLayer > 0 ? "Advanced" : `Layer ${i}`;

/** "A", "A and B", "A, B and C" */
export const listNames = (names) => names.length <= 1 ? (names[0] || "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * subject → everything the card view needs.
 * docId: show only that PDF's concepts (rows use the links among them; status always uses the whole subject).
 * adaptive: false in Static mode → no Locked / Next up / Feeds (Static gives no suggestions, TA point 21).
 */
export const buildGraphView = (subject, { docId = null, adaptive = true } = {}) => {
  const graph = { ...(subject?.graph || {}), nodes: subject?.graph?.nodes || {}, edges: subject?.graph?.edges || [] };
  const nodes = graph.nodes;
  const mastery = subject?.mastery || {};
  const all = Object.values(nodes);
  const concepts = docId ? all.filter(c => conceptDocIds(c).includes(docId)) : all;
  const shown = new Set(concepts.map(c => c.id));
  const order = Object.fromEntries(concepts.map((c, i) => [c.id, i]));
  const score = (id) => mastery[id] || 0;

  // links of the whole subject (same as graphEngine.getPrereqs)
  const prereqsOf = {}, dependentsOf = {};
  for (const id of Object.keys(nodes)) { prereqsOf[id] = graphEngine.getPrereqs(graph, id).filter(p => nodes[p]); dependentsOf[id] = []; }
  for (const [id, ps] of Object.entries(prereqsOf)) ps.forEach(p => dependentsOf[p].push(id));

  // ── rows: a concept sits one row below the last thing it needs (links among the shown concepts) ──
  const layerOf = {};
  const indeg = {}, kids = {};
  concepts.forEach(c => { indeg[c.id] = 0; kids[c.id] = []; });
  concepts.forEach(c => prereqsOf[c.id].filter(p => shown.has(p)).forEach(p => { indeg[c.id]++; kids[p].push(c.id); }));
  const queue = concepts.filter(c => indeg[c.id] === 0).map(c => c.id);
  queue.forEach(id => { layerOf[id] = 0; });
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const k of kids[cur]) {
      layerOf[k] = Math.max(layerOf[k] ?? 0, layerOf[cur] + 1);
      if (--indeg[k] === 0) queue.push(k);
    }
  }
  concepts.forEach(c => { if (layerOf[c.id] === undefined) layerOf[c.id] = 0; });   // only if links ever formed a loop
  const maxLayer = Math.max(0, ...Object.values(layerOf));
  const rows = Array.from({ length: maxLayer + 1 }, (_, i) => concepts.filter(c => layerOf[c.id] === i).map(c => c.id));

  // ── status of every concept (whole subject, so the PDF-wise view agrees with the full graph) ──
  const isDone = (id) => score(id) >= MASTERY_THRESHOLD;
  const isLocked = (id) => adaptive && !isDone(id) && prereqsOf[id].some(p => score(p) < UNLOCK_THRESHOLD);
  const info = {};
  for (const c of concepts) {
    const id = c.id, s = score(id), done = isDone(id), locked = isLocked(id);
    const unmet = prereqsOf[id].filter(p => score(p) < UNLOCK_THRESHOLD);
    info[id] = {
      id, name: c.name, score: s, done, locked,
      status: done ? "done" : locked ? "locked" : s > 0 ? "progress" : "new",
      notLinked: all.length > 1 && !prereqsOf[id].length && !dependentsOf[id].length,
      goal: maxLayer > 0 && layerOf[id] === maxLayer && !dependentsOf[id].length,
      prereqs: prereqsOf[id].map(p => ({ id: p, name: nodes[p].name, score: score(p), cleared: score(p) >= UNLOCK_THRESHOLD })),
      unlocks: dependentsOf[id].length,
      // a locked concept whose missing prerequisites can all be studied now → "Opens at 60% in …"
      opensIn: locked && unmet.every(p => !isLocked(p)) ? unmet.map(p => nodes[p].name) : [],
    };
  }

  // ── Next up: of the concepts ready to study, the one that opens the most locked concepts; then higher mastery ──
  let nextUp = null;
  if (adaptive) {
    const ready = graphEngine.getReadyConcepts(graph, mastery).filter(n => shown.has(n.id));
    const opens = (id) => score(id) >= UNLOCK_THRESHOLD ? [] : dependentsOf[id].filter(d => isLocked(d));
    const best = ready
      .map(n => ({ id: n.id, opens: opens(n.id) }))
      .sort((a, b) => b.opens.length - a.opens.length || score(b.id) - score(a.id) || order[a.id] - order[b.id])[0];
    if (best) {
      const s = score(best.id), first = best.opens[0];
      nextUp = {
        id: best.id,
        text: first
          ? `${UNLOCK_THRESHOLD - s}% more to open ${nodes[first].name}${best.opens.length > 1 ? ` and ${best.opens.length - 1} more` : ""}`
          : `${MASTERY_THRESHOLD - s}% more to Mastered`,
      };
    }
  }
  const feeds = new Set(nextUp ? prereqsOf[nextUp.id] : []);

  const counts = { all: concepts.length, done: 0, progress: 0, locked: 0, new: 0, notLinked: 0 };
  concepts.forEach(c => { counts[info[c.id].status]++; if (info[c.id].notLinked) counts.notLinked++; });

  /** the concept and everything it needs, all the way down (for "tap a card to light up what it needs") */
  const needsAll = (id) => {
    const seen = new Set([id]), stack = [id];
    while (stack.length) for (const p of prereqsOf[stack.pop()] || []) if (!seen.has(p)) { seen.add(p); stack.push(p); }
    return seen;
  };

  return { concepts, rows, layerOf, maxLayer, info, nextUp, nextName: nextUp ? nodes[nextUp.id].name : "", feeds, counts, needsAll, adaptive };
};

/** filter chip → does this concept show? */
export const matchesFilter = (i, filter) =>
  filter === "all" ? true : filter === "notLinked" ? i.notLinked : i.status === filter;
