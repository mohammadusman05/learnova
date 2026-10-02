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
      if((mastery[n.id]||0)>=75) return false;
      return graphEngine.getPrereqs(g,n.id).every(p=>(mastery[p]||0)>=60);
    });
  },
  getTopoOrder(g) {
    const v=new Set(), order=[];
    const visit=(id)=>{ if(v.has(id)) return; v.add(id); graphEngine.getPrereqs(g,id).forEach(visit); order.push(id); };
    Object.keys(g.nodes).forEach(visit);
    return order;
  }
};

const ME = {
  update(cur,score){ return Math.round((cur+score)/2); },
  getLevel(s){
    if(s>=90) return {label:"Expert",   color:"#0d9488",bg:"#f0fdfa",border:"#99f6e4"};
    if(s>=75) return {label:"Mastered", color:"#16a34a",bg:"#f0fdf4",border:"#86efac"};
    if(s>=50) return {label:"Learning", color:"#d97706",bg:"#fffbeb",border:"#fcd34d"};
    if(s>=25) return {label:"Beginner", color:"#ea580c",bg:"#fff7ed",border:"#fdba74"};
    return           {label:"Not Started",color:"#64748b",bg:"#f8fafc",border:"#cbd5e1"};
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
// ...
// ============================================================

export { graphEngine, ME, exJSON, buildDemoSubjects, subjectAvg, createGraph };
