// ============================================================
// KNOWLEDGE GRAPH — CARD VIEW (what each card shows) + the order of "Ready to learn"
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
/** up to 3 names in full, otherwise "A, B and 3 more" */
const shortNames = (names) => names.length <= 3 ? listNames(names) : `${names[0]}, ${names[1]} and ${names.length - 2} more`;

const graphOf = (subject) => ({ ...(subject?.graph || {}), nodes: subject?.graph?.nodes || {}, edges: subject?.graph?.edges || [] });

// links of the whole subject, both ways (same as graphEngine.getPrereqs)
const linkMaps = (graph) => {
  const nodes = graph.nodes, prereqsOf = {}, dependentsOf = {};
  for (const id of Object.keys(nodes)) { prereqsOf[id] = graphEngine.getPrereqs(graph, id).filter(p => nodes[p]); dependentsOf[id] = []; }
  for (const [id, ps] of Object.entries(prereqsOf)) ps.forEach(p => dependentsOf[p].push(id));
  return { prereqsOf, dependentsOf };
};

// the unlock rule Study uses: a concept is locked while any prerequisite is under 60% (and it is not Mastered)
const lockRule = (graph, mastery, prereqsOf) => {
  const score = (id) => mastery[id] || 0;
  const isDone = (id) => score(id) >= MASTERY_THRESHOLD;
  const isLocked = (id) => !isDone(id) && prereqsOf[id].some(p => score(p) < UNLOCK_THRESHOLD);
  const unmet = (id) => prereqsOf[id].filter(p => score(p) < UNLOCK_THRESHOLD);
  return { score, isDone, isLocked, unmet };
};

/** Is this concept still waiting for a prerequisite (display only — Study still lets the learner open it)? */
export const isConceptLocked = (subject, id) => {
  const graph = graphOf(subject);
  if (!graph.nodes[id]) return false;
  const { prereqsOf } = linkMaps(graph);
  return lockRule(graph, subject?.mastery || {}, prereqsOf).isLocked(id);
};

/**
 * "Ready to learn" (not Mastered, every prerequisite at 60%+ — the same list as before), most useful first:
 * 1. opens the most locked concepts by itself (it is their only missing prerequisite)
 * 2. is still needed by the most locked concepts
 * 3. higher mastery, then course order.
 * → [{node, opens: [ids], helps: [ids]}]
 */
export const readyInOrder = (subject) => {
  const graph = graphOf(subject), mastery = subject?.mastery || {};
  const { prereqsOf, dependentsOf } = linkMaps(graph);
  const { score, isLocked, unmet } = lockRule(graph, mastery, prereqsOf);
  const order = Object.fromEntries(Object.keys(graph.nodes).map((id, i) => [id, i]));
  return graphEngine.getReadyConcepts(graph, mastery).map(n => {
    const helps = score(n.id) >= UNLOCK_THRESHOLD ? [] : dependentsOf[n.id].filter(d => isLocked(d));
    return { node: n, helps, opens: helps.filter(d => unmet(d).every(p => p === n.id)) };
  }).sort((a, b) => b.opens.length - a.opens.length || b.helps.length - a.helps.length
    || score(b.node.id) - score(a.node.id) || order[a.node.id] - order[b.node.id]);
};

/**
 * subject → everything the card view needs.
 * docId: show only that PDF's concepts (rows use the links among them; status always uses the whole subject).
 * adaptive: false in Static mode → no Locked / Next up / Feeds (Static gives no suggestions, TA point 21).
 */
export const buildGraphView = (subject, { docId = null, adaptive = true } = {}) => {
  const graph = graphOf(subject);
  const nodes = graph.nodes;
  const mastery = subject?.mastery || {};
  const all = Object.values(nodes);
  const concepts = docId ? all.filter(c => conceptDocIds(c).includes(docId)) : all;
  const shown = new Set(concepts.map(c => c.id));
  const { prereqsOf, dependentsOf } = linkMaps(graph);
  const rule = lockRule(graph, mastery, prereqsOf);
  const { score, isDone } = rule;
  const isLocked = (id) => adaptive && rule.isLocked(id);

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

  // ── closest needs: a need that another need already depends on is left off the card
  //    (e.g. RLHF needs Reward Model, which needs SFT, which needs Pretraining → RLHF shows Reward Model only).
  //    The links themselves stay, and the unlock rule still checks all of them. ──
  const anc = {};
  const ancestorsOf = (id) => {
    if (anc[id]) return anc[id];
    const s = new Set(); anc[id] = s;
    for (const p of prereqsOf[id]) { s.add(p); for (const a of ancestorsOf(p)) s.add(a); }
    return s;
  };
  const closest = (id) => prereqsOf[id].filter(p => !prereqsOf[id].some(q => q !== p && ancestorsOf(q).has(p)));
  const cardNeeds = (id) => {
    const near = new Set(closest(id));
    // if every closest need is cleared but the concept is still locked, show the earlier need that blocks it
    const showBlockers = isLocked(id) && [...near].every(p => score(p) >= UNLOCK_THRESHOLD);
    return prereqsOf[id].filter(p => near.has(p) || (showBlockers && score(p) < UNLOCK_THRESHOLD));
  };

  // ── status of every concept (whole subject, so the PDF-wise view agrees with the full graph) ──
  const info = {};
  for (const c of concepts) {
    const id = c.id, s = score(id), done = isDone(id), locked = isLocked(id);
    const unmet = rule.unmet(id);
    info[id] = {
      id, name: c.name, score: s, done, locked,
      status: done ? "done" : locked ? "locked" : s > 0 ? "progress" : "new",
      notLinked: all.length > 1 && !prereqsOf[id].length && !dependentsOf[id].length,
      goal: maxLayer > 0 && layerOf[id] === maxLayer && !dependentsOf[id].length,
      prereqs: cardNeeds(id).map(p => ({ id: p, name: nodes[p].name, score: score(p), cleared: score(p) >= UNLOCK_THRESHOLD })),
      unlocks: dependentsOf[id].filter(d => closest(d).includes(id)).length,
      // a locked concept whose missing prerequisites can all be studied now → "Opens at 60% in …"
      opensIn: locked && unmet.every(p => !isLocked(p)) ? unmet.map(p => nodes[p].name) : [],
    };
  }

  // ── Next up: the first of "Ready to learn" (same order as Study and the Dashboard) ──
  let nextUp = null;
  if (adaptive) {
    const best = readyInOrder(subject).find(r => shown.has(r.node.id));
    if (best) {
      const s = score(best.node.id), names = (ids) => shortNames(ids.map(d => nodes[d].name));
      nextUp = {
        id: best.node.id,
        text: best.opens.length ? `${UNLOCK_THRESHOLD - s}% more to open ${names(best.opens)}`
          : best.helps.length ? `${UNLOCK_THRESHOLD - s}% more to clear it for ${names(best.helps)}`
          : `${MASTERY_THRESHOLD - s}% more to Mastered`,
      };
    }
  }
  const feeds = new Set(nextUp ? info[nextUp.id]?.prereqs.map(p => p.id) || cardNeeds(nextUp.id) : []);

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
