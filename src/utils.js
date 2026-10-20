// ============================================================
// GRAPH ENGINE
// ============================================================
const createGraph = () => ({ nodes: {}, edges: [] });
const graphEngine = {
  addNode(g, c) { return { ...g, nodes: { ...g.nodes, [c.id]: c } }; },
  addEdge(g, src, tgt, type="prerequisite") {
    if (type==="prerequisite" && graphEngine.wouldCreateCycle(g, src, tgt)) return g;
    if (g.edges.some(e=>e.source===src&&e.target===tgt&&e.type===type)) return g;
    return { ...g, edges: [...g.edges, { source:src, target:tgt, type }] };
  },
  wouldCreateCycle(g, src, tgt) {
    const v=new Set(), s=[tgt];
    while(s.length){ const n=s.pop(); if(n===src) return true; if(v.has(n)) continue; v.add(n); g.edges.filter(e=>e.source===n&&e.type==="prerequisite").forEach(e=>s.push(e.target)); }
    return false;
  },
  getPrereqs(g, id) { return g.edges.filter(e=>e.target===id&&e.type==="prerequisite").map(e=>e.source); },
  getReadyConcepts(g, mastery) {
    return Object.values(g.nodes).filter(n=>{
      if((mastery[n.id]||0)>=MASTERY_THRESHOLD) return false;
      return graphEngine.getPrereqs(g,n.id).every(p=>(mastery[p]||0)>=UNLOCK_THRESHOLD);
    });
  },
  getTopoOrder(g) {
    const v=new Set(), order=[];
    const visit=(id)=>{ if(v.has(id)) return; v.add(id); graphEngine.getPrereqs(g,id).forEach(visit); order.push(id); };
    Object.keys(g.nodes).forEach(visit);
    return order;
  }
};

// ============================================================
// MASTERY — Bayesian Knowledge Tracing (TA point 8)
// Mastery = how sure Learnova is that the learner knows a concept (0–100%).
// It is updated after EVERY answer, in Study and in Evaluation alike.
// ============================================================
const MASTERY_THRESHOLD = 95; // % — concept counts as Mastered (standard BKT cutoff)
const UNLOCK_THRESHOLD = 60;  // % — prerequisite known well enough to unlock the next concept
const BKT = {
  start: 0.10,                      // starting knowledge before any answer
  learn: 0.10,                      // chance of learning it from one practice question
  slip:  0.10,                      // chance a learner who knows it still answers wrong
  guess: { mcq: 0.25, desc: 0.10 }, // chance of a lucky right answer (1 in 4 options; written answers are hard to guess)
};

// One answer → new mastery (whole %). 0 means "no answers yet", so BKT.start is used.
// Certainty is capped at 99% inside the formula: at exactly 100% a wrong answer could never lower it.
const bktUpdate = (masteryPct, correct, type="mcq") => {
  const g = BKT.guess[type] ?? BKT.guess.mcq, s = BKT.slip, t = BKT.learn;
  const p = masteryPct > 0 ? Math.min(masteryPct / 100, 0.99) : BKT.start;
  const known = correct
    ? (p * (1 - s)) / (p * (1 - s) + (1 - p) * g)
    : (p * s) / (p * s + (1 - p) * (1 - g));
  return Math.round((known + (1 - known) * t) * 100);
};

// Several answers in order → final mastery + the before/after of each answer (for the answer log)
const applyAnswers = (masteryPct, answers = []) => {
  let m = masteryPct || 0;
  const steps = answers.map(a => {
    const before = m;
    m = bktUpdate(m, !!a.correct, a.type);
    return { ...a, masteryBefore: before, masteryAfter: m };
  });
  return { mastery: m, steps };
};

const ME = {
  getLevel(s){
    if(s>=MASTERY_THRESHOLD) return {label:"Mastered", color:"#16a34a",bg:"#f0fdf4",border:"#86efac"};             // 95–100%
    if(s>=75) return {label:"Proficient", color:"#0d9488",bg:"#f0fdfa",border:"#99f6e4"};                           // 75–94%
    if(s>=50) return {label:"Good Learner", color:"#2563eb",bg:"#eff6ff",border:"#bfdbfe"};                         // 50–74%
    if(s>=25) return {label:"Intermediate", color:"#d97706",bg:"#fffbeb",border:"#fcd34d"};                 // 25–49%
    if(s>0)   return {label:"Beginner", color:"#ea580c",bg:"#fff7ed",border:"#fdba74"};                             // 1–24%
    return           {label:"Not Started",color:"#64748b",bg:"#f8fafc",border:"#cbd5e1"};                         // 0%
  }
};

const exJSON = (text) => {
  try { const m=text.match(/```json\n?([\s\S]*?)\n?```/)||text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/); return JSON.parse(m?m[1]:text); } catch { return null; }
};

// ============================================================
// ...
// ============================================================
const buildDemoSubjects = () => { return {}; };


// ============================================================
// STYLES
// ============================================================

// ============================================================
// KEY GATE
// ============================================================

const subjectAvg = (subject) => {
  const vals=Object.values(subject.mastery);
  if(!vals.length) return 0;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
};

// ============================================================
// ANSWER LOG EXPORT (TA point 9) — one row per answer, for checking mastery reliability
// ============================================================
const ANSWER_LOG_COLUMNS = ["subject","concept_id","concept_name","question","correct","answer_type","screen","date_time","mastery_before","mastery_after"];
const csvCell = (v) => {
  const s = v===undefined||v===null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
};
const answerLogCsv = (subject) => {
  const rows = (subject.answerLog||[]).map(e => [
    subject.name, e.conceptId, subject.graph?.nodes?.[e.conceptId]?.name || "", e.question,
    e.correct ? 1 : 0, e.type, e.screen, e.at ? new Date(e.at).toISOString() : "", e.masteryBefore, e.masteryAfter,
  ]);
  return [ANSWER_LOG_COLUMNS, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
};

// ============================================================
// ...
// ============================================================

export { graphEngine, ME, exJSON, buildDemoSubjects, subjectAvg, createGraph, MASTERY_THRESHOLD, UNLOCK_THRESHOLD, BKT, bktUpdate, applyAnswers, answerLogCsv };
