const fs = require("fs");
const path = require("path");

fs.mkdirSync("src", { recursive: true });
console.log("Created src/");
fs.writeFileSync("src/App.css", `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
    --bg:#f8f9ff; --s1:#ffffff; --s2:#ffffff; --s3:#f1f5f9; --s4:#e2e8f0;
    --b1:#e2e8f0; --b2:#cbd5e1; --b3:#94a3b8;
    --coral:#ff6f61; --coral-d:#e8503f; --coral-l:#fff5f4; --coral-b:#ffb3ad;
    --charcoal:#263238; --charcoal-d:#1c2b33; --charcoal-l:#37474f;
    --teal:#0d9488; --teal-l:#f0fdfa; --teal-b:#99f6e4;
    --green:#16a34a; --green-l:#f0fdf4; --green-b:#86efac;
    --yellow:#d97706; --yellow-l:#fffbeb; --yellow-b:#fcd34d;
    --red:#dc2626; --red-l:#fef2f2; --red-b:#fecaca;
    --t1:#0f172a; --t2:#334155; --t3:#64748b; --t4:#94a3b8;
    --font:'Inter',sans-serif; --mono:'JetBrains Mono',monospace;
  }
  body{font-family:var(--font);color:var(--t1);background:var(--bg);}
  .app{display:flex;height:100vh;overflow:hidden;}

  /* SIDEBAR */
  .sidebar{width:250px;flex-shrink:0;background:linear-gradient(160deg,#1c2b33 0%,#263238 55%,#3d1f1a 100%);display:flex;flex-direction:column;overflow:hidden;}
  .brand{padding:24px 20px 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
  .brand-logo{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
  .brand-name{font-size:22px;font-weight:800;letter-spacing:-0.5px;line-height:1;}
  .brand-tag{font-size:9px;color:rgba(255,255,255,0.45);letter-spacing:2px;font-family:var(--mono);}

  /* SUBJECT SWITCHER */
  .subject-switcher{padding:12px;}
  .subject-switcher-label{font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:2px;font-family:var(--mono);padding:0 8px;margin-bottom:6px;}
  .subject-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all 0.15s;margin-bottom:2px;}
  .subject-item:hover{background:rgba(255,255,255,0.1);}
  .subject-item.active{background:rgba(255,111,97,0.2);border:1px solid rgba(255,111,97,0.3);}
  .subject-emoji{font-size:16px;width:20px;text-align:center;}
  .subject-name{font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);}
  .subject-item.active .subject-name{color:#ff6f61;}
  .subject-mastery{font-size:10px;color:rgba(255,255,255,0.4);font-family:var(--mono);margin-left:auto;}
  .subject-item.active .subject-mastery{color:rgba(255,111,97,0.7);}
  .add-subject-btn{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all 0.15s;border:1px dashed rgba(255,255,255,0.2);color:rgba(255,255,255,0.4);font-size:12px;font-weight:500;margin-top:4px;}
  .add-subject-btn:hover{border-color:rgba(255,111,97,0.5);color:#ff6f61;background:rgba(255,111,97,0.06);}

  /* NAV */
  .nav-group{padding:12px;border-top:1px solid rgba(255,255,255,0.08);}
  .nav-label{font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:2px;font-family:var(--mono);padding:0 8px;margin-bottom:6px;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;color:rgba(255,255,255,0.55);font-size:13px;font-weight:500;transition:all 0.15s;margin-bottom:2px;}
  .nav-item:hover{color:#fff;background:rgba(255,255,255,0.1);}
  .nav-item.active{color:#fff;background:rgba(255,255,255,0.18);font-weight:700;}
  .nav-icon{font-size:15px;width:18px;text-align:center;}

  /* SIDEBAR FOOTER */
  .sidebar-footer{margin-top:auto;padding:16px 20px;border-top:1px solid rgba(255,255,255,0.08);}
  .pbar-top{display:flex;justify-content:space-between;margin-bottom:6px;}
  .pbar{height:4px;background:rgba(255,255,255,0.15);border-radius:2px;overflow:hidden;}
  .pbar-fill{height:100%;background:linear-gradient(90deg,#ff6f61,#ffb3ad);border-radius:2px;transition:width 0.5s ease;}

  /* MAIN */
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);}
  .topbar{height:60px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;padding:0 32px;flex-shrink:0;background:#fff;box-shadow:0 1px 0 var(--b1);}
  .topbar-left{display:flex;align-items:center;gap:12px;}
  .topbar-subject{display:flex;align-items:center;gap:8px;padding:5px 12px;background:var(--coral-l);border:1px solid var(--coral-b);border-radius:20px;font-size:12px;font-weight:700;color:var(--coral-d);}
  .live-badge{display:flex;align-items:center;gap:6px;padding:5px 12px;background:#fff5f4;border:1px solid #ffb3ad;border-radius:20px;font-size:11px;color:#e8503f;font-family:var(--mono);font-weight:600;}
  .live-dot{width:6px;height:6px;border-radius:50%;background:#ff6f61;animation:pulse 2s infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .content{flex:1;overflow-y:auto;padding:32px;}

  /* CARDS */
  .card{background:#fff;border:1px solid var(--b1);border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .card-sm{padding:20px;}
  .card-label{font-size:10px;color:var(--t3);letter-spacing:2px;font-family:var(--mono);margin-bottom:10px;text-transform:uppercase;font-weight:600;}
  .stat-card{background:#fff;border:1px solid var(--b1);border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.04);border-left:4px solid;}
  .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
  .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  .gauto{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;}

  /* BUTTONS */
  .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:10px;border:none;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s;letter-spacing:0.2px;white-space:nowrap;}
  .btn-primary{background:linear-gradient(135deg,#ff6f61,#e8503f);color:#fff;box-shadow:0 4px 14px rgba(255,111,97,0.35);}
  .btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(255,111,97,0.5);}
  .btn-secondary{background:var(--s3);color:var(--t2);border:1px solid var(--b1);}
  .btn-secondary:hover{border-color:#ff6f61;color:#e8503f;background:#fff5f4;}
  .btn-ghost{background:transparent;color:var(--t3);border:1px solid transparent;}
  .btn-ghost:hover{color:var(--t1);background:var(--s3);border-color:var(--b1);}
  .btn-danger{background:var(--red-l);color:var(--red);border:1px solid var(--red-b);}
  .btn:disabled{opacity:0.4;cursor:not-allowed;transform:none!important;box-shadow:none!important;}
  .btn-lg{padding:13px 28px;font-size:14px;border-radius:12px;}
  .btn-sm{padding:7px 14px;font-size:12px;border-radius:8px;}
  .btn-xs{padding:4px 10px;font-size:11px;border-radius:6px;}

  /* CONCEPT CARDS */
  .cc{background:#fff;border:1px solid var(--b1);border-radius:14px;padding:18px;cursor:pointer;transition:all 0.18s;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .cc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ff6f61,#263238,#0d9488);opacity:0;transition:opacity 0.18s;}
  .cc:hover{border-color:#ff6f61;transform:translateY(-3px);box-shadow:0 8px 24px rgba(255,111,97,0.14);}
  .cc:hover::before{opacity:1;}
  .cc-name{font-size:14px;font-weight:700;margin-bottom:6px;color:var(--t1);}
  .cc-def{font-size:11px;color:var(--t3);font-family:var(--mono);line-height:1.6;}
  .mbar{height:4px;background:var(--s4);border-radius:2px;margin-top:14px;overflow:hidden;}
  .mfill{height:100%;border-radius:2px;transition:width 0.6s ease;}

  /* TAGS */
  .tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.5px;font-family:var(--mono);border:1px solid;}
  .tag-coral{background:#fff5f4;color:#e8503f;border-color:#ffb3ad;}
  .tag-green{background:var(--green-l);color:var(--green);border-color:var(--green-b);}
  .tag-yellow{background:var(--yellow-l);color:var(--yellow);border-color:var(--yellow-b);}
  .tag-teal{background:var(--teal-l);color:var(--teal);border-color:var(--teal-b);}

  /* LOADER */
  .spin{width:18px;height:18px;border:2px solid var(--b2);border-top-color:#ff6f61;border-radius:50%;animation:rot 0.7s linear infinite;display:inline-block;}
  @keyframes rot{to{transform:rotate(360deg)}}
  .loading{display:flex;align-items:center;gap:10px;color:var(--t3);font-size:13px;font-family:var(--mono);padding:16px 0;}

  /* MESSAGES */
  .msg{border-radius:14px;padding:20px;margin-bottom:14px;line-height:1.8;font-size:14px;}
  .msg.ai{background:#fff9f8;border:1px solid #ffe4e0;border-left:4px solid #ff6f61;}
  .msg.user{background:#f5faf9;border:1px solid #b2dfdb;border-left:4px solid #0d9488;}
  .msg-label{font-size:9px;letter-spacing:2px;color:var(--t4);font-family:var(--mono);margin-bottom:10px;text-transform:uppercase;font-weight:700;}

  /* INPUT */
  .iarea{background:#fff;border:1.5px solid var(--b2);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-end;transition:border-color 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .iarea:focus-within{border-color:#ff6f61;box-shadow:0 0 0 3px rgba(255,111,97,0.1);}
  .iarea textarea{flex:1;background:transparent;border:none;outline:none;color:var(--t1);font-family:var(--font);font-size:14px;resize:none;min-height:44px;max-height:180px;line-height:1.6;}
  .iarea textarea::placeholder{color:var(--t4);}
  .input-full{width:100%;background:var(--s3);border:1.5px solid var(--b1);border-radius:10px;padding:12px 16px;color:var(--t1);font-family:var(--mono);font-size:13px;outline:none;transition:all 0.2s;line-height:1.6;}
  .input-full:focus{border-color:#ff6f61;background:#fff;box-shadow:0 0 0 3px rgba(255,111,97,0.1);}
  textarea.input-full{resize:vertical;}

  /* QUIZ */
  .qopt{padding:14px 18px;border:1.5px solid var(--b1);border-radius:10px;cursor:pointer;font-size:14px;transition:all 0.15s;margin-bottom:10px;background:#fff;color:var(--t2);}
  .qopt:hover{border-color:#ff6f61;background:#fff5f4;color:#e8503f;}
  .qopt.sel{border-color:#ff6f61;background:#fff5f4;color:#e8503f;font-weight:600;}
  .qopt.correct{border-color:var(--green);background:var(--green-l);color:var(--green);font-weight:600;}
  .qopt.wrong{border-color:var(--red);background:var(--red-l);color:var(--red);}

  /* GRAPH */
  .gcanvas{width:100%;height:520px;position:relative;overflow:hidden;background:#fff;border:1px solid var(--b1);border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);}
  .gnode{position:absolute;transform:translate(-50%,-50%);padding:10px 18px;border-radius:24px;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;border:2px solid;white-space:nowrap;letter-spacing:0.2px;box-shadow:0 3px 10px rgba(0,0,0,0.1);}
  .gnode:hover{transform:translate(-50%,-50%) scale(1.1);z-index:10;box-shadow:0 8px 24px rgba(0,0,0,0.2);}
  svg.gedges{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}

  /* UPLOAD */
  .uzone{border:2px dashed var(--b2);border-radius:16px;padding:28px;text-align:center;cursor:pointer;transition:all 0.2s;background:#fff;}
  .uzone:hover,.uzone.drag{border-color:#ff6f61;background:#fff5f4;}

  /* SUBJECT HOME */
  .subject-home-card{background:#fff;border:1px solid var(--b1);border-radius:20px;padding:28px;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
  .subject-home-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;transition:opacity 0.2s;opacity:0;}
  .subject-home-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,0.1);border-color:var(--b2);}
  .subject-home-card:hover::before{opacity:1;}
  .new-subject-card{background:transparent;border:2px dashed var(--b2);border-radius:20px;padding:28px;cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:160px;}
  .new-subject-card:hover{border-color:#ff6f61;background:#fff5f4;}

  /* MODAL */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;}
  .modal{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,0.2);}
  .modal-title{font-size:18px;font-weight:800;margin-bottom:6px;color:var(--t1);}
  .modal-sub{font-size:13px;color:var(--t3);margin-bottom:24px;font-family:var(--mono);}

  /* MISC */
  .section-title{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;color:var(--t1);}
  .section-sub{font-size:13px;color:var(--t3);margin-bottom:28px;font-family:var(--mono);}
  .empty{text-align:center;padding:60px 20px;color:var(--t3);}
  .empty-icon{font-size:44px;margin-bottom:16px;}
  .score-big{font-size:80px;font-weight:900;letter-spacing:-4px;background:linear-gradient(135deg,#ff6f61,#263238);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  .fade{animation:fadeUp 0.35s ease;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .f{display:flex;} .fc{flex-direction:column;} .ac{align-items:center;} .jb{justify-content:space-between;} .jc{justify-content:center;} .fw{flex-wrap:wrap;}
  .g8{gap:8px;} .g12{gap:12px;} .g16{gap:16px;} .g20{gap:20px;}
  .mb4{margin-bottom:4px;} .mb8{margin-bottom:8px;} .mb12{margin-bottom:12px;} .mb16{margin-bottom:16px;} .mb20{margin-bottom:20px;} .mb24{margin-bottom:24px;}
  .mt8{margin-top:8px;} .mt12{margin-top:12px;} .mt16{margin-top:16px;}
  .t1{color:var(--t1);} .t2{color:var(--t2);} .t3{color:var(--t3);} .t4{color:var(--t4);}
  .ts{font-size:12px;} .txs{font-size:11px;} .tm{font-family:var(--mono);} .fw7{font-weight:700;} .fw6{font-weight:600;}
  .chip{display:inline-flex;align-items:center;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid var(--b1);background:#fff;cursor:pointer;transition:all 0.15s;}
  .chip:hover{border-color:#ff6f61;color:#e8503f;background:#fff5f4;}
  .concept-flow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
  .row-hover{transition:background 0.15s;border-radius:10px;}
  .row-hover:hover{background:var(--s3);}`, "utf8");
console.log("Written src/App.css");
fs.writeFileSync("src/App.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { graphEngine, ME, exJSON, buildDemoSubjects, subjectAvg, createGraph } from './utils.js';
import KeyGate from './KeyGate.jsx';
import NewSubjectModal from './NewSubjectModal.jsx';
import Ring from './Ring.jsx';
import SubjectsHome from './SubjectsHome.jsx';
import Dashboard from './Dashboard.jsx';
import UploadScreen from './UploadScreen.jsx';
import LibraryScreen from './LibraryScreen.jsx';
import GraphScreen from './GraphScreen.jsx';
import LearnScreen from './LearnScreen.jsx';
import EvalScreen from './EvalScreen.jsx';
import './App.css';

const LEARNOVA_LOGO = "data:image/png;base64,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";

const getStorageInfo = () => {
  try {
    const data = localStorage.getItem("learnova_subjects") || "";
    const usedBytes = new Blob([data]).size;
    const totalBytes = 5 * 1024 * 1024;
    const usedMB = (usedBytes / (1024*1024)).toFixed(2);
    const totalMB = 5;
    const pct = Math.round((usedBytes / totalBytes) * 100);
    return { usedMB, totalMB, pct };
  } catch(e) {
    return { usedMB: "0.00", totalMB: 5, pct: 0 };
  }
};

const StorageBar = () => {
  const s = getStorageInfo();
  return (
    <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:10,fontFamily:"var(--mono)",color:"rgba(255,255,255,0.4)",letterSpacing:"1px"}}>STORAGE</span>
        <span style={{fontSize:10,fontFamily:"var(--mono)",color:s.pct>=80?"#ff6f61":"rgba(255,255,255,0.5)",fontWeight:700}}>{s.usedMB} / {s.totalMB} MB</span>
      </div>
      <div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:2,transition:"width 0.3s",
          background:s.pct>=90?"#ef4444":s.pct>=80?"#f97316":"#ff6f61",
          width:\`\${Math.min(100,s.pct)}%\`}}/>
      </div>
      {s.pct>=80&&(
        <div style={{marginTop:6,fontSize:10,color:"#ff6f61",fontFamily:"var(--mono)"}}>
          {s.pct>=90?"⚠ Storage critical! Delete subjects.":"⚠ Storage nearly full."}
        </div>
      )}
    </div>
  );
};


// ============================================================
// APP ROOT
// ============================================================
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={error:null}; }
  componentDidCatch(e,i){ this.setState({error:e.message+"|"+JSON.stringify(i)}); }
  render(){
    if(this.state.error) return <div style={{padding:40,fontFamily:"monospace",color:"#dc2626",background:"#fef2f2",minHeight:"100vh"}}><h2>Error</h2><pre style={{whiteSpace:"pre-wrap",fontSize:12}}>{this.state.error}</pre></div>;
    return this.props.children;
  }
}

const App = () => {
  const [apiKey,setApiKey]=useState(null);
  const [subjects,setSubjects]=useState(()=>{
    try{
      const saved=localStorage.getItem("learnova_subjects");
      return saved?JSON.parse(saved):{};
    }catch(e){return {};}
  });
  const [activeSubjectId,setActiveSubjectId]=useState(null);
  // ...
  useEffect(()=>{
    try{ localStorage.setItem("learnova_subjects", JSON.stringify(subjects)); }catch(e){}
  },[subjects]); // null = subjects home
  const [screen,setScreen]=useState("home"); // home | dashboard | upload | graph | learn | eval
  const [learnId,setLearnId]=useState(null);
  const [evalConceptId,setEvalConceptId]=useState(null);
  const [showNewSubject,setShowNewSubject]=useState(false);

  const activeSubject = activeSubjectId ? subjects[activeSubjectId] : null;

  const updateSubject = (updated) => {
    setSubjects(prev=>({...prev,[updated.id]:updated}));
  };

  const deleteSubject = (id) => {
    if(!window.confirm('Delete this subject and all its content? This cannot be undone.')) return;
    setSubjects(prev => { const next={...prev}; delete next[id]; return next; });
    setActiveSubjectId(null);
    setScreen('home');
  };

  const createSubject = (name, emoji) => {
    const id = \`sub_\${name.toLowerCase().replace(/\\s+/g,"_")}_\${Date.now()}\`;
    const newSub = { id, name, emoji, graph:createGraph(), mastery:{}, docs:[], createdAt:Date.now() };
    setSubjects(prev=>({...prev,[id]:newSub}));
    setActiveSubjectId(id);
    setScreen("upload");
    setShowNewSubject(false);
  };

  const selectSubject = (id) => {
    setActiveSubjectId(id);
    setScreen("dashboard");
    setLearnId(null);
  };

  const navigate = (s, id=null) => {
    setScreen(s);
    if(id) setLearnId(id);
  };

  const total = activeSubject ? Object.keys(activeSubject.graph.nodes).length : 0;
  const mastered = activeSubject ? Object.values(activeSubject.graph.nodes).filter(c=>(activeSubject.mastery[c.id]||0)>=75).length : 0;

  const nav=[
    {id:"dashboard",icon:"◈",label:"Dashboard"},
    {id:"upload",icon:"⊕",label:"Ingest Content"},
    {id:"library",icon:"◫",label:"Library"},
    {id:"graph",icon:"⬡",label:"Knowledge Graph"},
    {id:"learn",icon:"◎",label:"Study"},
    {id:"eval",icon:"✦",label:"Evaluation"},
  ];
  const titles={home:"All Subjects",dashboard:"Overview",upload:"Ingest Content",library:"Document Library",graph:"Knowledge Graph",learn:"Study Mode",eval:"Weekly Evaluation"};

  if(!apiKey) return (<><KeyGate onUnlock={setApiKey} logo={LEARNOVA_LOGO}/></>);

  return (
    <>
      
      {showNewSubject&&<NewSubjectModal onSave={createSubject} onClose={()=>setShowNewSubject(false)}/>}
      <div className="app">
        {/* SIDEBAR */}
        <div className="sidebar">
          {/* Brand */}
          <div className="brand">
            <div className="brand-logo">
              <div style={{width:36,height:36,borderRadius:9,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 4 L4 20 L11 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 8 L13 20 M13 8 C13 8 13 4 17 4 C21 4 21 8 21 8 L21 20" stroke="#ff6f61" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="19" cy="4.5" r="2" fill="#ff6f61"/>
                </svg>
              </div>
              <div className="brand-name"><span style={{color:"#fff"}}>learn</span><span style={{color:"#ff6f61"}}>ova</span></div>
            </div>
            <div className="brand-tag">AI LEARNING OPERATING SYSTEM</div>
          </div>

          {/* Subject Switcher */}
          <div className="subject-switcher">
            <div className="subject-switcher-label">SUBJECTS</div>
            {/* All Subjects link */}
            <div className={\`subject-item \${screen==="home"?"active":""}\`} onClick={()=>{setActiveSubjectId(null);setScreen("home");}}>
              <span className="subject-emoji">🏠</span>
              <span className="subject-name">All Subjects</span>
            </div>
            {Object.values(subjects).map(sub=>{
              const avg=subjectAvg(sub);
              return(
                <div key={sub.id} className={\`subject-item \${activeSubjectId===sub.id&&screen!=="home"?"active":""}\`}
                  onClick={()=>selectSubject(sub.id)}>
                  <span className="subject-emoji">{sub.emoji}</span>
                  <span className="subject-name">{sub.name}</span>
                  <span className="subject-mastery">{avg}%</span>
                  <span onClick={e=>{e.stopPropagation();deleteSubject(sub.id);}}
                    style={{marginLeft:4,fontSize:11,color:"rgba(255,100,80,0.5)",cursor:"pointer",padding:"2px 4px",borderRadius:4}}
                    onMouseEnter={e=>e.currentTarget.style.color="rgba(255,80,60,1)"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,100,80,0.5)"}>✕</span>
                </div>
              );
            })}
            {/* Storage indicator */}
            <StorageBar/>
            <div className="add-subject-btn" onClick={()=>setShowNewSubject(true)}>
              <span style={{fontSize:14}}>＋</span>
              <span>New Subject</span>
            </div>
          </div>

          {/* Nav — only when a subject is active */}
          {activeSubject&&(
            <div className="nav-group">
              <div className="nav-label">NAVIGATE</div>
              {nav.map(item=>(
                <div key={item.id} className={\`nav-item \${screen===item.id?"active":""}\`}
                  onClick={()=>{setScreen(item.id);if(item.id!=="learn")setLearnId(null);if(item.id==="eval"){setEvalConceptId(null);}}}>
                  <span className="nav-icon">{item.icon}</span>{item.label}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="sidebar-footer">
            {activeSubject?(
              <>
                <div className="pbar-top">
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontFamily:"var(--mono)",letterSpacing:"1px"}}>PROGRESS</span>
                  <span style={{fontSize:11,color:"#ff6f61",fontFamily:"var(--mono)",fontWeight:700}}>{mastered}/{total}</span>
                </div>
                <div className="pbar"><div className="pbar-fill" style={{width:total?\`\${(mastered/total)*100}%\`:"0%"}}/></div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4}}>{activeSubject.emoji} {activeSubject.name}</div>
              </>
            ):(
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>
                {Object.keys(subjects).length} subject{Object.keys(subjects).length!==1?"s":""} · {Object.values(subjects).reduce((a,s)=>a+Object.keys(s.graph.nodes).length,0)} concepts total
              </div>
            )}
            <button className="btn btn-xs" style={{background:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.15)",fontSize:10,marginTop:12}} onClick={()=>setApiKey(null)}>🔒 Lock Session</button>
          </div>
        </div>

        {/* MAIN */}
        <div className="main">
          <div className="topbar">
            <div className="topbar-left">
              <div style={{fontSize:15,fontWeight:700,color:"var(--t1)"}}>{titles[screen]}</div>
              {activeSubject&&screen!=="home"&&(
                <div className="topbar-subject">{activeSubject.emoji} {activeSubject.name}</div>
              )}
            </div>
            <div className="live-badge"><div className="live-dot"/>AI Active · {Object.values(subjects).reduce((a,s)=>a+Object.keys(s.graph.nodes).length,0)} Concepts</div>
          </div>
          <div className="content">
            {screen==="home"&&<SubjectsHome subjects={subjects} onSelect={selectSubject} onCreate={()=>setShowNewSubject(true)}/>}
            {screen==="dashboard"&&activeSubject&&<Dashboard subject={activeSubject} onNavigate={navigate} onUpdate={updateSubject}/>}
            {screen==="upload"&&activeSubject&&<UploadScreen subject={activeSubject} onUpdate={updateSubject} apiKey={apiKey}/>}
            {screen==="library"&&activeSubject&&<LibraryScreen subject={activeSubject}/>}
            {screen==="graph"&&activeSubject&&<GraphScreen subject={activeSubject} onSelect={id=>navigate("learn",id)}/>}
            {screen==="learn"&&activeSubject&&<LearnScreen key={learnId} subject={activeSubject} onUpdate={updateSubject} initialId={learnId} apiKey={apiKey} onGoToEval={(cId)=>{setEvalConceptId(cId);setScreen("eval");}}/>}
            {screen==="eval"&&activeSubject&&<EvalScreen subject={activeSubject} onUpdate={updateSubject} apiKey={apiKey} initialConceptId={evalConceptId} onClearConcept={()=>setEvalConceptId(null)}/>}
          </div>
        </div>
      </div>
    </>
  );
};


export default App;
`, "utf8");
console.log("Written src/App.jsx");
fs.writeFileSync("src/Dashboard.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME, graphEngine } from './utils.js';
import Ring from './Ring.jsx';
const Dashboard = ({ subject, onNavigate, onUpdate }) => {
  const {graph,mastery}=subject;
  const concepts=Object.values(graph.nodes);
  const total=concepts.length;
  const mastered=concepts.filter(c=>(mastery[c.id]||0)>=75).length;
  const avg=total?Math.round(concepts.reduce((s,c)=>s+(mastery[c.id]||0),0)/total):0;
  const ready=graphEngine.getReadyConcepts(graph,mastery);
  const weak=concepts.filter(c=>(mastery[c.id]||0)>0&&(mastery[c.id]||0)<75).sort((a,b)=>mastery[a.id]-mastery[b.id]);
  const order=graphEngine.getTopoOrder(graph);
  const stats=[
    {label:"TOTAL CONCEPTS",value:total,sub:"in knowledge graph",color:"#ff6f61"},
    {label:"MASTERED",value:mastered,sub:"≥ 75% mastery",color:"#16a34a"},
    {label:"AVG MASTERY",value:\`\${avg}%\`,sub:"across all concepts",color:"#263238"},
    {label:"READY TO LEARN",value:ready.length,sub:"prerequisites cleared",color:"#e8503f"},
  ];
  return (
    <div className="fade">
      <div className="section-title">{subject.emoji} {subject.name}</div>
      <div className="section-sub">Knowledge graph progress for this subject</div>
      <div className="g4 mb24">
        {stats.map(s=>(
          <div key={s.label} className="stat-card" style={{borderLeftColor:s.color}}>
            <div className="card-label">{s.label}</div>
            <div style={{fontSize:30,fontWeight:800,letterSpacing:"-1px",color:s.color}}>{s.value}</div>
            <div className="txs t3 tm mt8">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="g2 mb24">
        <div className="card">
          <div className="card-label">CONCEPT MASTERY</div>
          {order.length===0&&<div className="ts t3 tm">Upload a lecture to see concepts here.</div>}
          {order.map(id=>{
            const c=graph.nodes[id]; if(!c) return null;
            const score=mastery[id]||0;
            const {color,label,bg,border}=ME.getLevel(score);
            return (
              <div key={id} className="f ac g12 mb8 row-hover" style={{cursor:"pointer",padding:"10px"}}
                onClick={()=>onNavigate("learn",id)}>
                <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                <div style={{width:135,fontSize:13,fontWeight:600,color:"var(--t1)"}}>{c.name}</div>
                <div style={{flex:1}}><div className="mbar"><div className="mfill" style={{width:\`\${score}%\`,background:color}}/></div></div>
                <div style={{width:36,fontSize:12,fontFamily:"var(--mono)",color,fontWeight:700,textAlign:"right"}}>{score}%</div>
                <div className="tag" style={{background:bg,color,borderColor:border,fontSize:9,minWidth:72,justifyContent:"center"}}>{label.toUpperCase()}</div>
              </div>
            );
          })}
        </div>
        <div className="f fc g16">
          <div className="card" style={{flex:1}}>
            <div className="card-label">⚡ READY TO LEARN</div>
            {ready.length===0
              ? <div className="ts t3 tm">{total===0?"Upload a lecture to get started.":"All concepts completed! 🎉"}</div>
              : ready.slice(0,5).map(c=>(
                <div key={c.id} className="f ac jb mb8"
                  style={{padding:"12px 14px",borderRadius:12,background:"linear-gradient(135deg,#fff9f8,#fff3f2)",border:"1px solid #ffcdc9",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(255,111,97,0.15)";e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}
                  onClick={()=>onNavigate("learn",c.id)}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{c.name}</div>
                    <div className="txs t3">{graphEngine.getPrereqs(graph,c.id).map(p=>graph.nodes[p]?.name).filter(Boolean).join(" → ")||"No prerequisites"}</div>
                  </div>
                  <div className="tag tag-coral">START →</div>
                </div>
              ))
            }
          </div>
          {weak.length>0&&(
            <div className="card" style={{flex:1}}>
              <div className="card-label">⚠️ NEEDS REVIEW</div>
              {weak.slice(0,4).map(c=>(
                <div key={c.id} className="f ac jb mb8"
                  style={{padding:"12px 14px",borderRadius:12,background:"#fffbeb",border:"1px solid #fde68a",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";}}
                  onClick={()=>onNavigate("learn",c.id)}>
                  <div style={{fontSize:13,fontWeight:700}}>{c.name}</div>
                  <div className="f ac g8"><Ring score={mastery[c.id]||0} size={34} sw={3}/><span className="txs tm fw7" style={{color:"var(--yellow)"}}>{mastery[c.id]}%</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// UPLOAD SCREEN (per-subject)
// ============================================================
export default Dashboard;
`, "utf8");
console.log("Written src/Dashboard.jsx");
fs.writeFileSync("src/EvalScreen.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME, exJSON } from './utils.js';
const AttemptHistory = ({ attempts }) => {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="card mb20" style={{background:"#f8fafc"}}>
      <div className="card-label">ATTEMPT HISTORY · click to review answers</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[...attempts].reverse().map((a,ri) => {
          const i = attempts.length - 1 - ri;
          const isOpen = expanded === a.id;
          return (
            <div key={a.id}>
              <div onClick={()=>setExpanded(isOpen?null:a.id)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",borderRadius:10,cursor:"pointer",
                  background:a.passed?"#f0fdf4":"#fef2f2",
                  border:\`1px solid \${a.passed?"#86efac":"#fecaca"}\`,
                  transition:"all 0.15s"}}>
                <div>
                  <div className="ts fw7" style={{color:a.passed?"#16a34a":"#dc2626"}}>
                    Attempt {i+1}: {a.score}% {a.passed?"✅ PASS":"❌ FAIL"}
                  </div>
                  <div className="txs t3 tm">{new Date(a.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"})} · {a.totalQs} questions · {a.config?.difficulty||""} {a.config?.type||""}</div>
                </div>
                <div style={{fontSize:14,color:a.passed?"#16a34a":"#dc2626",fontWeight:700}}>{isOpen?"▲":"▼"}</div>
              </div>
              {isOpen && (
                <div style={{marginTop:4,padding:"12px",background:"#fff",borderRadius:10,border:"1px solid var(--b1)"}}>
                  {a.results?.map((r,qi)=>(
                    <div key={qi} style={{marginBottom:12,paddingBottom:12,borderBottom:qi<a.results.length-1?"1px solid var(--b1)":"none"}}>
                      <div className="f ac jb mb8">
                        <div className="ts fw7 t2">Q{qi+1}: {r.q}</div>
                        <div className="tag" style={{background:r.isCorrect?"#f0fdf4":"#fef2f2",color:r.isCorrect?"#16a34a":"#dc2626",borderColor:r.isCorrect?"#86efac":"#fecaca",flexShrink:0,marginLeft:8}}>
                          {r.isCorrect?"✓ Correct":"✗ Wrong"}
                        </div>
                      </div>
                      <div className="f g8 mb4">
                        <div style={{flex:1,padding:"6px 10px",borderRadius:6,background:"#f0f9ff",border:"1px solid #bae6fd"}}>
                          <div style={{fontSize:9,color:"#0369a1",fontFamily:"var(--mono)",fontWeight:700,marginBottom:2}}>YOUR ANSWER</div>
                          <div className="txs t2">{r.userAnswer||"Not answered"}</div>
                        </div>
                        {!r.isCorrect&&(
                          <div style={{flex:1,padding:"6px 10px",borderRadius:6,background:"#f0fdf4",border:"1px solid #86efac"}}>
                            <div style={{fontSize:9,color:"#16a34a",fontFamily:"var(--mono)",fontWeight:700,marginBottom:2}}>CORRECT ANSWER</div>
                            <div className="txs t2">{r.correctAnswer}</div>
                          </div>
                        )}
                      </div>
                      {r.feedback&&<div className="txs t3 tm" style={{padding:"4px 8px",background:"#fffbeb",borderRadius:6,border:"1px solid #fde68a"}}>💡 {r.feedback}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ============================================================
// ...
// ============================================================
const EvalScreen = ({ subject, onUpdate, apiKey, initialConceptId, onClearConcept }) => {
  const {graph, mastery} = subject;
  const allConcepts = Object.values(graph.nodes);
  // ...
  const readProgress = subject.readProgress || {};
  const concepts = allConcepts.filter(c => (readProgress[c.id]||0) >= 80);
  // phase: select | config | quiz | results
  const [phase, setPhase] = useState(initialConceptId ? "config" : "select");
  const [selectedConcept, setSelectedConcept] = useState(initialConceptId || null);
  const [config, setConfig] = useState({ type:"mcq", difficulty:"medium", mcqCount:10, descCount:3 });
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // ...
  useEffect(()=>{
    if(initialConceptId){ setSelectedConcept(initialConceptId); setPhase("config"); }
  },[initialConceptId]);

  const callClaude = async (sys, usr, mt=3000) => {
    const res = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:mt,system:sys,messages:[{role:"user",content:usr}]})
    });
    const d = await res.json(); return d.content?.[0]?.text || "";
  };

  const concept = selectedConcept ? graph.nodes[selectedConcept] : null;

  // ── GENERATE QUIZ ──
  const generateQuiz = async () => {
    setLoading(true); setPhase("quiz"); setAnswers({});
    const c = concept;
    const diffMap = {easy:"simple and foundational",medium:"moderately challenging",hard:"advanced and analytical"};
    const diffStr = diffMap[config.difficulty];

    let qs = [];

    // MCQ questions
    if(config.type === "mcq" || config.type === "combo") {
      const n = config.mcqCount;
      const raw = await callClaude(
        \`Generate exactly \${n} multiple choice questions. Return ONLY valid JSON:
{"questions":[{"q":"Question?","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"Why A is correct"}]}\`,
        \`Generate \${n} \${diffStr} MCQ questions about: "\${c.name}" — \${c.definition}
Subject: \${subject.name}
Difficulty: \${config.difficulty}\`
      , 4000);
      const parsed = exJSON(raw);
      if(parsed?.questions) {
        parsed.questions.slice(0,n).forEach((q,i) => qs.push({...q, id:\`mcq_\${i}\`, type:"mcq"}));
      }
    }

    // Descriptive questions
    if(config.type === "desc" || config.type === "combo") {
      const n = config.descCount;
      const raw = await callClaude(
        \`Generate exactly \${n} descriptive/short-answer questions. Return ONLY valid JSON:
{"questions":[{"q":"Question requiring a written explanation?","sampleAnswer":"A thorough sample answer","keyPoints":["key point 1","key point 2"]}]}\`,
        \`Generate \${n} \${diffStr} descriptive questions about: "\${c.name}" — \${c.definition}
Subject: \${subject.name}
Difficulty: \${config.difficulty}\`
      , 3000);
      const parsed = exJSON(raw);
      if(parsed?.questions) {
        parsed.questions.slice(0,n).forEach((q,i) => qs.push({...q, id:\`desc_\${i}\`, type:"desc"}));
      }
    }

    setQuestions(qs);
    setLoading(false);
  };

  // ── SUBMIT & GRADE ──
  const submitQuiz = async () => {
    setLoading(true);
    const c = concept;
    let gradedResults = [];

    // Grade MCQ instantly
    const mcqQs = questions.filter(q => q.type === "mcq");
    mcqQs.forEach(q => {
      const userAns = answers[q.id];
      const correct = userAns === q.correct;
      gradedResults.push({
        ...q,
        userAnswer: userAns !== undefined ? q.options[userAns] : "Not answered",
        correctAnswer: q.options[q.correct],
        isCorrect: correct,
        points: correct ? 1 : 0,
        feedback: q.explanation,
      });
    });

    // ...
    const descQs = questions.filter(q => q.type === "desc");
    if(descQs.length > 0) {
      const gradingInput = descQs.map((q,i) => ({
        id: q.id,
        question: q.q,
        sampleAnswer: q.sampleAnswer,
        keyPoints: q.keyPoints,
        studentAnswer: answers[q.id] || ""
      }));

      const raw = await callClaude(
        \`You are grading descriptive answers. For each question, determine if student's answer is correct (1 point) or incorrect (0 points) based on whether it covers the key points. Return ONLY valid JSON:
{"grades":[{"id":"desc_0","isCorrect":true,"points":1,"feedback":"Why correct or incorrect","correctAnswer":"What a good answer looks like"}]}\`,
        \`Grade these answers:
\${JSON.stringify(gradingInput)}\`
      , 3000);

      const parsed = exJSON(raw);
      if(parsed?.grades) {
        parsed.grades.forEach(grade => {
          const q = descQs.find(dq => dq.id === grade.id);
          if(q) gradedResults.push({
            ...q,
            userAnswer: answers[q.id] || "Not answered",
            correctAnswer: grade.correctAnswer || q.sampleAnswer,
            isCorrect: grade.isCorrect,
            points: grade.points || 0,
            feedback: grade.feedback,
          });
        });
      } else {
        // Fallback if parsing fails
        descQs.forEach(q => {
          gradedResults.push({...q, userAnswer: answers[q.id]||"", correctAnswer: q.sampleAnswer, isCorrect:false, points:0, feedback:"Could not grade automatically."});
        });
      }
    }

    // Calculate score
    const totalPoints = gradedResults.reduce((a,r) => a+r.points, 0);
    const totalQs = gradedResults.length;
    const pct = totalQs > 0 ? Math.round((totalPoints/totalQs)*100) : 0;
    const passed = pct >= 75;

    // Build attempt record
    const attempt = {
      id: \`attempt_\${Date.now()}\`,
      date: Date.now(),
      score: pct,
      passed,
      totalPoints,
      totalQs,
      config: {...config},
      results: gradedResults,
    };

    // ...
    const existing = subject.evalHistory || {};
    const conceptHistory = existing[selectedConcept] || [];
    const newHistory = [...conceptHistory, attempt];

    let newMastery = {...subject.mastery};
    let newGraph = {...subject.graph};
    if(passed) {
      newMastery[selectedConcept] = Math.max(newMastery[selectedConcept]||0, pct);
      newGraph = {...newGraph, nodes:{...newGraph.nodes,[selectedConcept]:{...newGraph.nodes[selectedConcept],state:"MASTERED"}}};
    }

    onUpdate({...subject, mastery:newMastery, graph:newGraph, evalHistory:{...existing,[selectedConcept]:newHistory}});
    setResults({...attempt});
    setPhase("results");
    setLoading(false);
  };

  const resetToSelect = () => {
    setPhase("select"); setSelectedConcept(null); setQuestions([]); setAnswers({}); setResults(null);
    if(onClearConcept) onClearConcept();
  };

  const goRetake = () => {
    setPhase("config"); setQuestions([]); setAnswers({}); setResults(null);
  };

  // ────────────────────────────────────────────
  // PHASE: SELECT CONCEPT
  // ────────────────────────────────────────────
  if(phase === "select") return (
    <div className="fade">
      <div className="section-title">Evaluation</div>
      <div className="section-sub">Select a concept to be evaluated on</div>
      {concepts.length === 0
        ? <div className="empty">
            <div className="empty-icon">📖</div>
            <div style={{fontSize:14,color:"var(--t3)",marginBottom:8}}>No concepts ready for evaluation yet</div>
            <div className="ts t4 tm">Go to Study → read a concept to 80% → Take Quiz to unlock evaluation</div>
          </div>
        : <div className="gauto">
          {concepts.map(c => {
            const score = mastery[c.id]||0;
            const {color,label,bg,border} = ME.getLevel(score);
            const history = (subject.evalHistory||{})[c.id]||[];
            const lastAttempt = history[history.length-1];
            const aTag = lastAttempt
              ? lastAttempt.passed
                ? {txt:"PASSED",bg:"#f0fdf4",color:"#16a34a",border:"#86efac"}
                : {txt:"ATTEMPTED",bg:"#fff5f4",color:"#e8503f",border:"#ffb3ad"}
              : {txt:"NOT STARTED",bg,color,border};
            return (
              <div key={c.id} className="cc" onClick={()=>{setSelectedConcept(c.id);setPhase("config");}}>
                <div className="f jb ac mb8">
                  <div className="cc-name">{c.name}</div>
                  <div className="tag" style={{background:aTag.bg,color:aTag.color,borderColor:aTag.border,fontSize:9}}>{aTag.txt}</div>
                </div>
                <div className="cc-def mb8">{c.definition}</div>
                {lastAttempt && (
                  <div className="f ac g8" style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:lastAttempt.passed?"#f0fdf4":"#fef2f2",border:\`1px solid \${lastAttempt.passed?"#86efac":"#fecaca"}\`}}>
                    <span style={{fontSize:12}}>{lastAttempt.passed?"✅":"❌"}</span>
                    <span className="txs tm" style={{color:lastAttempt.passed?"#16a34a":"#dc2626"}}>
                      Last: {lastAttempt.score}% · {history.length} attempt{history.length!==1?"s":""}
                    </span>
                  </div>
                )}
                <div className="mbar mt8"><div className="mfill" style={{width:\`\${score}%\`,background:color}}/></div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );

  // ────────────────────────────────────────────
  // PHASE: CONFIG
  // ────────────────────────────────────────────
  if(phase === "config") return (
    <div className="fade">
      <div className="f ac g12 mb8">
        <button className="btn btn-ghost btn-sm" onClick={resetToSelect}>← Back</button>
        <div className="tag tag-coral">{subject.emoji} {subject.name}</div>
      </div>
      <div className="section-title">Configure Quiz</div>
      <div className="section-sub">{concept?.name} · {concept?.definition}</div>

      {/* Previous attempts — expandable */}
      {((subject.evalHistory||{})[selectedConcept]||[]).length > 0 && (
        <AttemptHistory attempts={(subject.evalHistory||{})[selectedConcept]||[]} />
      )}

      <div className="g2">
        <div className="card">
          <div className="card-label">QUESTION TYPE</div>
          {[{id:"mcq",label:"MCQ",desc:"Multiple choice questions",icon:"☑️"},
            {id:"desc",label:"Descriptive",desc:"Written answer questions",icon:"✍️"},
            {id:"combo",label:"Combination",desc:"MCQ + Descriptive",icon:"🔀"}
          ].map(t => (
            <div key={t.id} onClick={()=>setConfig(c=>({...c,type:t.id}))}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:8,
                border:\`1.5px solid \${config.type===t.id?"#ff6f61":"var(--b1)"}\`,
                background:config.type===t.id?"#fff5f4":"#fff",transition:"all 0.15s"}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:config.type===t.id?"#e8503f":"var(--t1)"}}>{t.label}</div>
                <div className="txs t3">{t.desc}</div>
              </div>
              {config.type===t.id && <div style={{marginLeft:"auto",color:"#ff6f61",fontWeight:700}}>✓</div>}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-label">DIFFICULTY</div>
          <div className="f g8 mb20">
            {[{id:"easy",label:"Easy",color:"#16a34a"},{id:"medium",label:"Medium",color:"#d97706"},{id:"hard",label:"Hard",color:"#dc2626"}].map(d => (
              <div key={d.id} onClick={()=>setConfig(c=>({...c,difficulty:d.id}))}
                style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",textAlign:"center",
                  border:\`1.5px solid \${config.difficulty===d.id?d.color:"var(--b1)"}\`,
                  background:config.difficulty===d.id?\`\${d.color}10\`:"#fff",transition:"all 0.15s"}}>
                <div style={{fontSize:13,fontWeight:700,color:config.difficulty===d.id?d.color:"var(--t2)"}}>{d.label}</div>
              </div>
            ))}
          </div>

          {/* MCQ count */}
          {(config.type==="mcq"||config.type==="combo") && (
            <div className="mb16">
              <div className="card-label">NUMBER OF MCQ QUESTIONS</div>
              <div className="f g8">
                {[5,10,15,20].map(n => (
                  <div key={n} onClick={()=>setConfig(c=>({...c,mcqCount:n}))}
                    style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,
                      border:\`1.5px solid \${config.mcqCount===n?"#ff6f61":"var(--b1)"}\`,
                      background:config.mcqCount===n?"#fff5f4":"#fff",color:config.mcqCount===n?"#e8503f":"var(--t2)",transition:"all 0.15s"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descriptive count */}
          {(config.type==="desc"||config.type==="combo") && (
            <div className="mb16">
              <div className="card-label">NUMBER OF DESCRIPTIVE QUESTIONS</div>
              <div className="f g8">
                {[1,2,3,4,5].map(n => (
                  <div key={n} onClick={()=>setConfig(c=>({...c,descCount:n}))}
                    style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,
                      border:\`1.5px solid \${config.descCount===n?"#ff6f61":"var(--b1)"}\`,
                      background:config.descCount===n?"#fff5f4":"#fff",color:config.descCount===n?"#e8503f":"var(--t2)",transition:"all 0.15s"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt16">
        <button className="btn btn-primary btn-lg" onClick={generateQuiz}>
          🚀 Start Quiz
        </button>
        <span className="txs t3 tm" style={{marginLeft:16}}>
          {config.type==="mcq"?\`\${config.mcqCount} MCQ\`:config.type==="desc"?\`\${config.descCount} Descriptive\`:\`\${config.mcqCount} MCQ + \${config.descCount} Descriptive\`}
          {" · "}{config.difficulty} difficulty
        </span>
      </div>
    </div>
  );

  // ────────────────────────────────────────────
  // PHASE: QUIZ
  // ────────────────────────────────────────────
  if(phase === "quiz") {
    const mcqQs = questions.filter(q=>q.type==="mcq");
    const descQs = questions.filter(q=>q.type==="desc");
    const totalAnswered = Object.keys(answers).length;
    const totalQs = questions.length;

    return (
      <div className="fade">
        <div className="f ac jb mb20">
          <div>
            <div className="f ac g12 mb4">
              <div className="tag tag-coral">{concept?.name}</div>
              <div className="tag" style={{background:"var(--s3)",color:"var(--t3)",borderColor:"var(--b1)"}}>{config.difficulty.toUpperCase()}</div>
            </div>
            <div className="section-title">Quiz</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#ff6f61"}}>{totalAnswered}/{totalQs}</div>
            <div className="txs t3 tm">answered</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{height:4,background:"var(--b1)",borderRadius:2,overflow:"hidden",marginBottom:24}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#ff6f61,#16a34a)",borderRadius:2,transition:"width 0.3s",width:\`\${totalQs>0?(totalAnswered/totalQs)*100:0}%\`}}/>
        </div>

        {loading ? (
          <div className="loading"><div className="spin"/><span>Evaluation in progress — generating questions...</span></div>
        ) : (
          <>
            {/* MCQ Section */}
            {mcqQs.length>0 && (
              <>
                <div className="card-label mb12">☑️ MULTIPLE CHOICE QUESTIONS</div>
                {mcqQs.map((q,qi)=>(
                  <div key={q.id} className="card mb16">
                    <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"var(--t1)"}}>
                      Q{qi+1}: {q.q}
                    </div>
                    {q.options.map((opt,oi)=>(
                      <div key={oi} className={\`qopt \${answers[q.id]===oi?"sel":""}\`}
                        onClick={()=>setAnswers(a=>({...a,[q.id]:oi}))}>
                        {opt}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}

            {/* Descriptive Section */}
            {descQs.length>0 && (
              <>
                <div className="card-label mb12" style={{marginTop:mcqQs.length?24:0}}>✍️ DESCRIPTIVE QUESTIONS</div>
                {descQs.map((q,qi)=>(
                  <div key={q.id} className="card mb16">
                    <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:"var(--t1)"}}>
                      Q{mcqQs.length+qi+1}: {q.q}
                    </div>
                    <textarea className="input-full" rows={4}
                      placeholder="Write your answer here..."
                      value={answers[q.id]||""}
                      onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}/>
                    {q.keyPoints&&(
                      <div className="txs t3 mt8 tm">💡 Hint: cover — {q.keyPoints.join(" · ")}</div>
                    )}
                  </div>
                ))}
              </>
            )}

            <button className="btn btn-primary btn-lg" onClick={submitQuiz}
              disabled={totalAnswered<totalQs||loading}>
              {loading?"Evaluation in progress — grading your answers...":"Submit & Get Results →"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────
  // PHASE: RESULTS
  // ────────────────────────────────────────────
  if(phase === "results" && results) {
    const passed = results.passed;
    return (
      <div className="fade">
        {/* Score banner */}
        <div style={{textAlign:"center",padding:"32px 20px",marginBottom:24,borderRadius:16,
          background:passed?"linear-gradient(135deg,#f0fdf4,#dcfce7)":"linear-gradient(135deg,#fef2f2,#fee2e2)",
          border:\`1px solid \${passed?"#86efac":"#fecaca"}\`}}>
          <div style={{fontSize:64,fontWeight:900,letterSpacing:"-3px",color:passed?"#16a34a":"#dc2626"}}>{results.score}%</div>
          <div style={{fontSize:22,fontWeight:800,marginBottom:8,color:passed?"#16a34a":"#dc2626"}}>
            {passed?"✅ PASSED":"❌ FAILED"}
          </div>
          <div className="ts t3 mb16">{results.totalPoints} / {results.totalQs} correct · {concept?.name}</div>
          {passed
            ? <div style={{fontSize:13,color:"#16a34a",fontFamily:"var(--mono)"}}>Concept marked as Mastered! Great work 🎉</div>
            : <div style={{fontSize:13,color:"#dc2626",fontFamily:"var(--mono)"}}>Score 75% or above to pass. Review the topic and retake.</div>
          }
        </div>

        {/* Action buttons */}
        <div className="f g12 mb24">
          {!passed&&<button className="btn btn-primary" onClick={goRetake}>🔄 Retake Quiz</button>}
          <button className="btn btn-secondary" onClick={resetToSelect}>← All Concepts</button>
        </div>

        {/* Per-question breakdown */}
        <div className="card-label mb12">📋 QUESTION BREAKDOWN</div>
        {results.results.map((r,i)=>(
          <div key={i} className="card mb12" style={{borderLeft:\`4px solid \${r.isCorrect?"#16a34a":"#dc2626"}\`}}>
            <div className="f ac jb mb12">
              <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--t3)",fontWeight:700}}>
                {r.type==="mcq"?"MCQ":"DESCRIPTIVE"} · Q{i+1}
              </div>
              <div className="tag" style={{background:r.isCorrect?"#f0fdf4":"#fef2f2",color:r.isCorrect?"#16a34a":"#dc2626",borderColor:r.isCorrect?"#86efac":"#fecaca"}}>
                {r.isCorrect?"✓ Correct":"✗ Wrong"} · {r.points} pt
              </div>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:12,color:"var(--t1)"}}>{r.q}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{padding:"10px 14px",borderRadius:8,background:"#f0f9ff",border:"1px solid #bae6fd"}}>
                <div style={{fontSize:9,letterSpacing:"1.5px",color:"#0369a1",fontFamily:"var(--mono)",fontWeight:700,marginBottom:4}}>YOUR ANSWER</div>
                <div style={{fontSize:13,color:"var(--t2)"}}>{r.userAnswer||"Not answered"}</div>
              </div>
              <div style={{padding:"10px 14px",borderRadius:8,background:"#f0fdf4",border:"1px solid #86efac"}}>
                <div style={{fontSize:9,letterSpacing:"1.5px",color:"#16a34a",fontFamily:"var(--mono)",fontWeight:700,marginBottom:4}}>CORRECT ANSWER</div>
                <div style={{fontSize:13,color:"var(--t2)"}}>{r.correctAnswer}</div>
              </div>
            </div>
            <div style={{padding:"10px 14px",borderRadius:8,background:"#fffbeb",border:"1px solid #fde68a"}}>
              <div style={{fontSize:9,letterSpacing:"1.5px",color:"#d97706",fontFamily:"var(--mono)",fontWeight:700,marginBottom:4}}>💡 EXPLANATION</div>
              <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.6}}>{r.feedback}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};


// ── StorageBar component ──
export default EvalScreen;
`, "utf8");
console.log("Written src/EvalScreen.jsx");
fs.writeFileSync("src/GraphScreen.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME } from './utils.js';
const KnowledgeGraph = ({ subject, filterDocId }) => {
  const { graph, mastery } = subject;
  // ...
  const allConcepts = Object.values(graph.nodes);
  const concepts = filterDocId
    ? allConcepts.filter(c => c.sourceDocId === filterDocId)
    : allConcepts;

  const [selected, setSelected] = useState(null);
  const [filterLayer, setFilterLayer] = useState(null);

  // Reset on doc change
  useEffect(()=>{ setSelected(null); setFilterLayer(null); },[filterDocId]);

  if(concepts.length === 0) return (
    <div className="empty" style={{padding:"40px 20px"}}>
      <div className="empty-icon">⬡</div>
      <div className="ts t3">{filterDocId?"No concepts found for this document":"Upload a lecture to build your knowledge graph"}</div>
    </div>
  );

  // ── Topological layer assignment ──
  const ids = new Set(concepts.map(c=>c.id));
  const edges = Object.values(graph.edges||{}).filter(e=>ids.has(e.source)&&ids.has(e.target));
  const inDegree = {}, adjList = {};
  concepts.forEach(c=>{ inDegree[c.id]=0; adjList[c.id]=[]; });
  edges.forEach(e=>{ inDegree[e.target]++; adjList[e.source].push(e.target); });
  const layer = {};
  const queue = concepts.filter(c=>inDegree[c.id]===0).map(c=>c.id);
  queue.forEach(id=>{ layer[id]=0; });
  let qi=0;
  while(qi<queue.length){
    const cur=queue[qi++];
    (adjList[cur]||[]).forEach(nid=>{
      layer[nid]=Math.max(layer[nid]||0,(layer[cur]||0)+1);
      if(!queue.includes(nid)) queue.push(nid);
    });
  }
  concepts.forEach(c=>{ if(layer[c.id]===undefined) layer[c.id]=0; });

  const maxLayer = Math.max(...Object.values(layer),0);
  const layers = [];
  for(let i=0;i<=maxLayer;i++) layers.push(concepts.filter(c=>layer[c.id]===i));

  // ── Layout ──
  const NODE_W=148, NODE_H=36, GAP_X=80, GAP_Y=20;
  const LAYER_W=NODE_W+GAP_X;
  const totalW=Math.max(700, layers.length*LAYER_W+60);
  const maxPerLayer=Math.max(...layers.map(l=>l.length));
  const totalH=Math.max(240, maxPerLayer*(NODE_H+GAP_Y)+80);

  const pos={};
  layers.forEach((lyr,li)=>{
    const x=40+li*LAYER_W+NODE_W/2;
    const totalH_lyr=lyr.length*(NODE_H+GAP_Y)-GAP_Y;
    const startY=(totalH-totalH_lyr)/2;
    lyr.forEach((c,ci)=>{ pos[c.id]={x, y:startY+ci*(NODE_H+GAP_Y)+NODE_H/2}; });
  });

  const layerColors=['#e8503f','#7c3aed','#0d9488','#d97706','#2563eb','#16a34a','#db2777'];
  const layerName=(i)=>i===0?"Foundation":i===maxLayer&&maxLayer>0?"Advanced":\`Layer \${i}\`;

  const getNodeOpacity=(c)=>{
    if(filterLayer!==null&&layer[c.id]!==filterLayer) return 0.1;
    if(selected){ if(c.id===selected) return 1; const conn=edges.some(e=>(e.source===selected&&e.target===c.id)||(e.target===selected&&e.source===c.id)); return conn?1:0.15; }
    return 1;
  };
  const getEdgeOpacity=(e)=>{
    if(filterLayer!==null) return(layer[e.source]===filterLayer||layer[e.target]===filterLayer)?0.9:0.04;
    if(selected) return(e.source===selected||e.target===selected)?1:0.04;
    return 0.7;
  };
  const getEdgeStroke=(e)=>{
    if(selected&&(e.source===selected||e.target===selected)) return '#ff6f61';
    return layerColors[(layer[e.source]||0)%layerColors.length];
  };

  const selConcept=selected?graph.nodes[selected]:null;

  return (
    <div>
      {/* Layer filter pills */}
      <div className="f ac g8 mb12" style={{flexWrap:"wrap"}}>
        {layers.map((_,i)=>{
          const color=layerColors[i%layerColors.length];
          const isActive=filterLayer===i;
          return(
            <div key={i} onClick={()=>setFilterLayer(filterLayer===i?null:i)}
              className="f ac g6"
              style={{padding:"3px 12px",borderRadius:20,cursor:"pointer",transition:"all 0.15s",
                border:\`1.5px solid \${color}\`,background:isActive?color:"transparent"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:isActive?"#fff":color}}/>
              <span style={{fontSize:11,fontWeight:700,fontFamily:"var(--mono)",color:isActive?"#fff":color}}>
                {layerName(i)}·{layers[i].length}
              </span>
            </div>
          );
        })}
        {(filterLayer!==null||selected)&&
          <button className="btn btn-ghost btn-sm" style={{fontSize:11,padding:"3px 10px"}}
            onClick={()=>{setFilterLayer(null);setSelected(null);}}>✕ Clear</button>}
        <span className="txs t4 tm">click to filter</span>
      </div>

      {/* SVG Canvas */}
      <div style={{overflowX:"auto",borderRadius:12,border:"1px solid var(--b1)",background:"#fafafa"}}>
        <svg width={totalW} height={totalH} style={{display:"block"}}>
          <defs>
            <marker id="arr-0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#e8503f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#db2777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
            <marker id="arr-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 2L8 5L1 8" fill="none" stroke="#ff6f61" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </marker>
          </defs>

          {/* Edges — straight horizontal with vertical offset to reduce crossing */}
          {edges.map((e,i)=>{
            const s=pos[e.source], t=pos[e.target];
            if(!s||!t) return null;
            const opacity=getEdgeOpacity(e);
            const stroke=getEdgeStroke(e);
            const lyrIdx=(layer[e.source]||0)%layerColors.length;
            const markerId=selected&&(e.source===selected||e.target===selected)?"arr-sel":\`arr-\${lyrIdx}\`;
            // ...
            const x1=s.x+NODE_W/2;
            const x2=t.x-NODE_W/2-6;
            const y1=s.y;
            const y2=t.y;
            // ...
            const cp1x=x1+(x2-x1)*0.6;
            const cp1y=y1;
            const cp2x=x1+(x2-x1)*0.6;
            const cp2y=y2;
            return(
              <path key={i}
                d={\`M\${x1},\${y1} C\${cp1x},\${cp1y} \${cp2x},\${cp2y} \${x2},\${y2}\`}
                fill="none" stroke={stroke} strokeWidth={2}
                strokeOpacity={opacity}
                markerEnd={\`url(#\${markerId})\`}
              />
            );
          })}

          {/* Nodes */}
          {concepts.map(c=>{
            const p=pos[c.id]; if(!p) return null;
            const score=mastery[c.id]||0;
            const color=layerColors[(layer[c.id]||0)%layerColors.length];
            const isSel=selected===c.id;
            const opacity=getNodeOpacity(c);
            return(
              <g key={c.id} style={{cursor:"pointer",opacity,transition:"opacity 0.2s"}}
                onClick={()=>{setFilterLayer(null);setSelected(isSel?null:c.id);}}>
                <rect x={p.x-NODE_W/2} y={p.y-NODE_H/2} width={NODE_W} height={NODE_H} rx={NODE_H/2}
                  fill={isSel?color:"#fff"} stroke={color} strokeWidth={isSel?0:2}/>
                {score>0&&<>
                  <rect x={p.x-NODE_W/2+6} y={p.y+NODE_H/2-6} width={NODE_W-12} height={3} rx={1.5} fill="#e2e8f0"/>
                  <rect x={p.x-NODE_W/2+6} y={p.y+NODE_H/2-6} width={(NODE_W-12)*(score/100)} height={3} rx={1.5} fill={color}/>
                </>}
                <text x={p.x} y={p.y+(score>0?-2:0)} textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fontWeight={600} fill={isSel?"#fff":color}
                  style={{fontFamily:"var(--sans)",pointerEvents:"none",userSelect:"none"}}>
                  {c.name.length>18?c.name.slice(0,17)+"…":c.name}
                </text>
                {score>0&&<text x={p.x} y={p.y+NODE_H/2-4} textAnchor="middle" fontSize={9}
                  fill={isSel?"rgba(255,255,255,0.85)":color} style={{fontFamily:"var(--mono)"}}>{score}%</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected concept detail */}
      {selConcept&&(
        <div className="card mt12 fade" style={{borderColor:layerColors[(layer[selConcept.id]||0)%layerColors.length]+"80"}}>
          <div className="f ac g12 mb8">
            <div style={{width:10,height:10,borderRadius:"50%",background:layerColors[(layer[selConcept.id]||0)%layerColors.length],flexShrink:0}}/>
            <div style={{fontSize:15,fontWeight:700}}>{selConcept.name}</div>
            <div className="tag" style={{background:layerColors[(layer[selConcept.id]||0)%layerColors.length]+"20",color:layerColors[(layer[selConcept.id]||0)%layerColors.length],borderColor:layerColors[(layer[selConcept.id]||0)%layerColors.length]+"50",fontSize:9}}>
              {layerName(layer[selConcept.id]||0).toUpperCase()}
            </div>
          </div>
          <div className="ts t2 mb12" style={{lineHeight:1.7}}>{selConcept.definition}</div>
          {edges.filter(e=>e.target===selConcept.id).length>0&&(
            <div className="mb8">
              <div className="txs t3 tm mb4">PREREQUISITES</div>
              <div className="f fw g8">
                {edges.filter(e=>e.target===selConcept.id).map(e=>(
                  <div key={e.source} className="tag tag-coral" style={{cursor:"pointer"}} onClick={()=>setSelected(e.source)}>{graph.nodes[e.source]?.name}</div>
                ))}
              </div>
            </div>
          )}
          {edges.filter(e=>e.source===selConcept.id).length>0&&(
            <div>
              <div className="txs t3 tm mb4">UNLOCKS</div>
              <div className="f fw g8">
                {edges.filter(e=>e.source===selConcept.id).map(e=>(
                  <div key={e.target} className="tag" style={{cursor:"pointer",background:"#f0fdf4",color:"#16a34a",borderColor:"#86efac"}} onClick={()=>setSelected(e.target)}>{graph.nodes[e.target]?.name}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learning path */}
      <div className="card mt12">
        <div className="card-label mb8">LEARNING PATH</div>
        <div className="f ac fw g8">
          {layers.map((lyr,li)=>lyr.map((c,ci)=>(
            <React.Fragment key={c.id}>
              <div className="tag" style={{background:\`\${layerColors[li%layerColors.length]}15\`,color:layerColors[li%layerColors.length],borderColor:\`\${layerColors[li%layerColors.length]}50\`,cursor:"pointer"}}
                onClick={()=>setSelected(c.id)}>{c.name}</div>
              {(ci<lyr.length-1||li<layers.length-1)&&<span style={{color:"var(--t4)",fontSize:12}}>→</span>}
            </React.Fragment>
          )))}
        </div>
      </div>
    </div>
  );
};

const GraphScreen = ({ subject }) => {
  const [activeTab, setActiveTab] = useState("full");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const docs = subject.docs || [];

  return (
    <div className="fade">
      <div className="f jb ac mb16">
        <div>
          <div className="section-title">Knowledge Graph</div>
          <div className="section-sub">{subject.emoji} {subject.name} · {Object.values(subject.graph.nodes).length} concepts</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="f g8 mb20">
        <button className={\`btn \${activeTab==="full"?"btn-primary":"btn-secondary"} btn-sm\`}
          onClick={()=>{ setActiveTab("full"); setSelectedDocId(null); }}>
          🌐 Full Knowledge Graph
        </button>
        <button className={\`btn \${activeTab==="pdf"?"btn-primary":"btn-secondary"} btn-sm\`}
          onClick={()=>setActiveTab("pdf")}>
          📄 PDF-wise Graph
        </button>
      </div>

      {/* Full graph tab */}
      {activeTab==="full"&&(
        <KnowledgeGraph subject={subject} filterDocId={null}/>
      )}

      {/* PDF-wise tab */}
      {activeTab==="pdf"&&(
        <div>
          {docs.length===0?(
            <div className="empty"><div className="empty-icon">📂</div><div className="ts t3">No documents uploaded yet</div></div>
          ):(
            <>
              {/* Doc selector */}
              <div className="card mb16">
                <div className="card-label mb10">SELECT DOCUMENT</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {docs.map((doc,i)=>{
                    const conceptCount=Object.values(subject.graph.nodes).filter(c=>c.sourceDocId===doc.id).length;
                    const isActive=selectedDocId===doc.id;
                    return(
                      <div key={doc.id} onClick={()=>setSelectedDocId(isActive?null:doc.id)}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:10,cursor:"pointer",
                          border:\`1.5px solid \${isActive?"#ff6f61":"var(--b1)"}\`,
                          background:isActive?"#fff5f4":"#fff",transition:"all 0.15s"}}>
                        <span style={{fontSize:20}}>{doc.fileType==="PDF"?"📕":doc.fileType==="DOCX"?"📘":"📄"}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:isActive?"#e8503f":"var(--t1)"}}>{doc.name}</div>
                          <div className="txs t3 tm">{conceptCount} concepts · {doc.topic}</div>
                        </div>
                        <div style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--t4)"}}>{new Date(doc.uploadedAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</div>
                        {isActive&&<div style={{color:"#ff6f61",fontWeight:700,fontSize:13}}>✓</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Graph for selected doc */}
              {selectedDocId?(
                <KnowledgeGraph subject={subject} filterDocId={selectedDocId}/>
              ):(
                <div className="empty" style={{padding:"32px 20px"}}>
                  <div className="empty-icon">☝️</div>
                  <div className="ts t3">Select a document above to see its knowledge graph</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};


// ============================================================
// LEARN SCREEN (per-subject)
// ============================================================
export default GraphScreen;
`, "utf8");
console.log("Written src/GraphScreen.jsx");
fs.writeFileSync("src/KeyGate.jsx", `import React, { useState, useEffect, useRef } from 'react';
const KeyGate = ({ onUnlock, logo }) => {
  const [key,setKey]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const verify = async () => {
    if(!key.trim()){setError("Please enter your Anthropic API key.");return;}
    setLoading(true);setError("");
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key.trim(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:"hi"}]})});
      if(res.status===401){setError("Invalid API key. Please check and try again.");setLoading(false);return;}
      onUnlock(key.trim());
    } catch(e){ onUnlock(key.trim()); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fff9f8 0%,#f5f5f5 50%,#fff3f2 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{position:"fixed",top:"10%",left:"15%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,111,97,0.1),transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"15%",right:"10%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(38,50,56,0.06),transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:460,position:"relative",zIndex:1}}>
        <div className="f ac jc mb24" style={{flexDirection:"column",gap:14}}>
          <div style={{textAlign:"center"}}>
            <img src={logo} alt="Learnova" style={{height:64,width:"auto",marginBottom:8}}/>
            <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"3px",fontFamily:"var(--mono)"}}>AI LEARNING OPERATING SYSTEM</div>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:20,padding:36,boxShadow:"0 20px 60px rgba(0,0,0,0.1)"}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:6,color:"#0f172a"}}>Welcome 👋</div>
          <div style={{fontSize:13,color:"#64748b",fontFamily:"var(--mono)",marginBottom:24,lineHeight:1.7}}>Enter your Anthropic API key to unlock all AI features. Stays in your browser only — never saved, never shared.</div>
          <div style={{marginBottom:16,position:"relative",overflow:"hidden",borderRadius:12}}>
            <input type={show?"text":"password"} placeholder="Enter your Anthropic API key..."
              value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&verify()}
              style={{width:"100%",background:"#f8fafc",border:\`1.5px solid \${error?"#dc2626":"#e2e8f0"}\`,borderRadius:12,padding:"13px 48px 13px 16px",color:"#0f172a",fontFamily:"var(--mono)",fontSize:13,outline:"none",transition:"all 0.2s"}}
              onFocus={e=>{e.target.style.borderColor="#ff6f61";e.target.style.boxShadow="0 0 0 3px rgba(255,111,97,0.12)";}}
              onBlur={e=>{e.target.style.borderColor=error?"#dc2626":"#e2e8f0";e.target.style.boxShadow="none";}}/>
            <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,userSelect:"none"}} onClick={()=>setShow(s=>!s)}>{show?"🙈":"👁️"}</div>
          </div>
          {error&&<div style={{fontSize:12,color:"#dc2626",fontFamily:"var(--mono)",marginBottom:16,padding:"10px 14px",background:"#fef2f2",borderRadius:8,border:"1px solid #fecaca"}}>{error}</div>}
          <button className="btn btn-primary btn-lg" style={{width:"100%",justifyContent:"center"}} onClick={verify} disabled={!key.trim()||loading}>
            {loading?<><div className="spin" style={{borderTopColor:"#fff"}}/>Verifying...</>:<>🚀 Launch Learnova</>}
          </button>
          <div style={{marginTop:20,padding:14,background:"linear-gradient(135deg,#fff9f8,#fff3f2)",borderRadius:12,border:"1px solid #ffcdc9"}}>
            <div style={{fontSize:10,color:"#e8503f",letterSpacing:"1.5px",fontFamily:"var(--mono)",marginBottom:6,fontWeight:700}}>DON'T HAVE A KEY?</div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.7}}>Get a free API key from <strong>console.anthropic.com</strong> → Sign up → API Keys → Create Key</div>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:"#94a3b8",fontFamily:"var(--mono)"}}>🔒 Key stays in browser memory only · Never saved</div>
      </div>
    </div>
  );
};

// ============================================================
// NEW SUBJECT MODAL
// ============================================================
export default KeyGate;
`, "utf8");
console.log("Written src/KeyGate.jsx");
fs.writeFileSync("src/LearnScreen.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME, exJSON, graphEngine } from './utils.js';
const LearnScreen = ({ subject, onUpdate, initialId, apiKey, onGoToEval }) => {
  const {graph,mastery}=subject;
  const [cId,setCId]=useState(initialId||null);
  const [phase,setPhase]=useState(initialId?"loading":"select");
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [quiz,setQuiz]=useState(null);
  const [score,setScore]=useState(null);
  const [scrollPct,setScrollPct]=useState(0);
  const [docCollapsed,setDocCollapsed]=useState(false);
  const [kbCollapsed,setKbCollapsed]=useState(false);
  const [sourceChoice,setSourceChoice]=useState({doc:true,kb:true});
  const [sourcesReady,setSourcesReady]=useState(false);
  const bottomRef=useRef();
  const msgContainerRef=useRef();
  const ready=graphEngine.getReadyConcepts(graph,mastery);
  const all=Object.values(graph.nodes);

  const callClaude=async(sys,usr,mt=1500)=>{
    const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:mt,system:sys,messages:[{role:"user",content:usr}]})});
    const d=await res.json();return d.content?.[0]?.text||"";
  };

  const updateMastery=(id,val)=>{ onUpdate({...subject,mastery:{...subject.mastery,[id]:val}}); };
  const updateGraph=(newGraph)=>{ onUpdate({...subject,graph:newGraph}); };

  useEffect(()=>{if(initialId)startLearning(initialId);},[]);
  // ...

  // ...
  const scrollPctRef = useRef(0);
  const handleScroll=(e)=>{
    const el=e.target;
    const scrolled=el.scrollTop+el.clientHeight;
    const total=el.scrollHeight;
    let pct;
    if(total<=el.clientHeight+2){ pct=100; } // fits on screen = fully read
    else { pct=Math.round((scrolled/total)*100); }
    const newPct=Math.min(100,pct);
    if(newPct > scrollPctRef.current){
      scrollPctRef.current = newPct;
      setScrollPct(newPct);
      if(newPct>=80 && cId){
        onUpdate({...subject,readProgress:{...(subject.readProgress||{}),[cId]:newPct}});
      }
    }
  };

  // ...
  useEffect(()=>{
    if(messages.length>0 && msgContainerRef.current){
      const el=msgContainerRef.current;
      setTimeout(()=>{
        if(!el) return;
        const total=el.scrollHeight;
        if(total<=el.clientHeight+2){
          // ...
          if(scrollPctRef.current<100){
            scrollPctRef.current=100;
            setScrollPct(100);
          }
        }
      },50);
    }
  },[messages, docCollapsed, kbCollapsed]);

  const startLearning=async(id)=>{
    const c=graph.nodes[id];if(!c) return;
    setCId(id);setPhase("explain");setMessages([]);setLoading(false);
    setDocCollapsed(false);setKbCollapsed(false);
    setSourcesReady(false);
    const prevPct=(subject.readProgress||{})[id]||0;
    setScrollPct(prevPct);
    scrollPctRef.current=prevPct;
    // Don't auto-generate — wait for user to select sources
    setLoading(false);
    return;
  };

  const generateExplanation=async()=>{
    const c=graph.nodes[cId];if(!c) return;
    setMessages([]);setLoading(true);setSourcesReady(true);
    try{
      const sourceDoc=(subject.docs||[]).find(d=>d.id===c.sourceDocId);
      const hasDocText=sourceDoc&&sourceDoc.rawText&&sourceDoc.rawText.length>100;
      if(hasDocText&&sourceChoice.doc&&sourceChoice.kb){
        setMessages([{role:"loading-doc",content:""}]);
        const docReply=await callClaude(
          "You are an AI tutor. Answer ONLY based on the provided document text. Do not add outside information.",
          \`Based ONLY on this document text, explain "\${c.name}":

\${sourceDoc.rawText.substring(0,8000)}

Explain what the document says about "\${c.name}".\`,
          1500
        );
        setMessages([{role:"loading-doc",content:""},{role:"loading-kb",content:""}]);
        const kbReply=await callClaude(
          \`You are an expert AI tutor for "\${subject.name}". Explain concepts clearly with examples and analogies.\`,
          \`Explain "\${c.name}" (\${c.definition}) with examples and real-world applications. Subject: \${subject.name}\`,
          1500
        );
        setMessages([
          {role:"doc",content:docReply,docName:sourceDoc.name},
          {role:"kb",content:kbReply}
        ]);
      } else {
        const exp=await callClaude(
          \`You are an expert AI tutor for "\${subject.name}". Explain concepts clearly with examples and analogies. Use line breaks for readability.\`,
          \`Teach me: "\${c.name}"
Definition: \${c.definition}
Subject: \${subject.name}

Give a clear explanation with a practical real-world example.\`,
          2000
        );
        setMessages([{role:"kb",content:exp}]);
      }
    }catch(e){setMessages([{role:"ai",content:"Error: "+e.message}]);}
    setLoading(false);
  };

  const sendMsg=async()=>{
    if(!input.trim()||loading) return;
    const userMsg=input.trim();
    setInput("");
    setMessages(m=>[...m,{role:"user",content:userMsg}]);
    setLoading(true);
    try{
      const c=graph.nodes[cId];
      const reply=await callClaude(
        \`You are an AI tutor for "\${subject.name}". Answer questions about "\${c?.name}" clearly and concisely.\`,
        userMsg,
        1000
      );
      setMessages(m=>[...m,{role:"ai",content:reply}]);
    }catch(e){setMessages(m=>[...m,{role:"ai",content:"Error: "+e.message}]);}
    setLoading(false);
  };

  const startQuiz=async()=>{
    setPhase("quiz");setLoading(true);setQuiz(null);
    const c=graph.nodes[cId];
    const raw=await callClaude(
      \`Generate 3 MCQ questions. Return ONLY JSON:\\n{"questions":[{"q":"Question?","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"Why correct"}]}\`,
      \`Create 3 quiz questions about: \${c?.name} — \${c?.definition} (Subject: \${subject.name})\`
    );
    const parsed=exJSON(raw);setQuiz(parsed?.questions||[]);setLoading(false);
  };

  const QuizComp=()=>{
    const [sel,setSel]=useState({});
    const [done,setDone]=useState(false);
    if(!quiz) return <div className="loading"><div className="spin"/><span>Generating quiz...</span></div>;
    const submit=()=>{
      setDone(true);
      const correct=quiz.filter((q,i)=>sel[i]===q.correct).length;
      const pct=Math.round((correct/quiz.length)*100);
      setScore(pct);
      const old=subject.mastery[cId]||0;
      const nw=old===0?pct:ME.update(old,pct);
      const newMastery={...subject.mastery,[cId]:nw};
      const newGraph={...subject.graph,nodes:{...subject.graph.nodes,[cId]:{...subject.graph.nodes[cId],state:nw>=75?"MASTERED":"LEARNING"}}};
      onUpdate({...subject,mastery:newMastery,graph:newGraph});
      setTimeout(()=>setPhase("result"),900);
    };
    return (
      <div className="fade">
        {quiz.map((q,qi)=>(
          <div key={qi} className="card mb16">
            <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"var(--t1)"}}>Q{qi+1}: {q.q}</div>
            {q.options.map((opt,oi)=>(
              <div key={oi} className={\`qopt \${sel[qi]===oi?"sel":""} \${done?(oi===q.correct?"correct":sel[qi]===oi?"wrong":""):""}\`}
                onClick={()=>!done&&setSel(s=>({...s,[qi]:oi}))}>{opt}</div>
            ))}
            {done&&<div className="txs t3 mt8 tm" style={{padding:"10px 14px",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0"}}>💡 {q.explanation}</div>}
          </div>
        ))}
        {!done&&<button className="btn btn-primary" disabled={Object.keys(sel).length<quiz.length} onClick={submit}>Submit Answers</button>}
      </div>
    );
  };

  if(phase==="select") return (
    <div className="fade">
      <div className="section-title">Study Mode</div>
      <div className="section-sub">{subject.emoji} {subject.name} · select a concept to learn</div>
      {!all.length
        ? <div className="empty"><div className="empty-icon">📚</div><div className="ts t3">Upload a lecture first to generate concepts</div></div>
        : <>
          {ready.length>0&&<>
            <div className="f ac g12 mb8">
              <div className="card-label" style={{margin:0}}>⚡ READY TO LEARN</div>
              <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",padding:"3px 10px",background:"var(--s3)",borderRadius:20}}>prerequisites cleared — start these now</div>
            </div>
            <div className="gauto mb24">
              {ready.map(c=>{
                const {color,label,bg,border}=ME.getLevel(mastery[c.id]||0);
                return(
                  <div key={c.id} className="cc" onClick={()=>startLearning(c.id)}>
                    <div className="f jb ac mb8"><div className="cc-name">{c.name}</div><div className="tag tag-coral">READY</div></div>
                    <div className="cc-def">{c.definition}</div>
                    <div className="mbar"><div className="mfill" style={{width:\`\${mastery[c.id]||0}%\`,background:"#ff6f61"}}/></div>
                  </div>
                );
              })}
            </div>
          </>}
          {/* IN PROGRESS + NOT STARTED */}
          <div className="f ac g12 mb8">
              <div className="card-label" style={{margin:0}}>ALL CONCEPTS</div>
              <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",padding:"3px 10px",background:"var(--s3)",borderRadius:20}}>every concept from your lectures</div>
            </div>
          <div className="gauto mb24">
            {all.filter(c=>(mastery[c.id]||0)<75).map(c=>{
              const {color,label,bg,border}=ME.getLevel(mastery[c.id]||0);
              return(
                <div key={c.id} className="cc" onClick={()=>startLearning(c.id)}>
                  <div className="f jb ac mb8"><div className="cc-name">{c.name}</div><div className="tag" style={{background:bg,color,borderColor:border,fontSize:9}}>{label.toUpperCase()}</div></div>
                  <div className="cc-def">{c.definition}</div>
                  <div className="mbar"><div className="mfill" style={{width:\`\${mastery[c.id]||0}%\`,background:color}}/></div>
                </div>
              );
            })}
          </div>

          {/* COMPLETED SECTION — at bottom */}
          {all.filter(c=>(mastery[c.id]||0)>=75).length>0&&(
            <div className="mb24">
              <div className="f ac g12 mb8">
                <div className="card-label" style={{margin:0,color:"#16a34a"}}>✅ COMPLETED</div>
                <div style={{fontSize:11,color:"#16a34a",fontFamily:"var(--mono)",padding:"3px 10px",background:"#f0fdf4",borderRadius:20,border:"1px solid #86efac"}}>mastery ≥ 75%</div>
              </div>
              <div className="gauto">
                {all.filter(c=>(mastery[c.id]||0)>=75).map(c=>{
                  const {color,bg,border}=ME.getLevel(mastery[c.id]||0);
                  return(
                    <div key={c.id} className="cc" onClick={()=>startLearning(c.id)} style={{borderColor:"#86efac",background:"#f0fdf4"}}>
                      <div className="f jb ac mb8">
                        <div className="cc-name">{c.name}</div>
                        <div className="tag tag-green">MASTERED</div>
                      </div>
                      <div className="cc-def">{c.definition}</div>
                      <div className="mbar"><div className="mfill" style={{width:\`\${mastery[c.id]||0}%\`,background:color}}/></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      }
    </div>
  );

  const concept=graph.nodes[cId];
  const curMastery=subject.mastery[cId]||0;
  return (
    <div className="fade">
      <div className="f ac jb mb24">
        <div>
          <div className="f ac g12 mb8">
            <button className="btn btn-ghost btn-sm" onClick={()=>{setPhase("select");setMessages([]);setCId(null);}}>← Back</button>
            <div className="tag tag-coral">{subject.emoji} {subject.name}</div>
          </div>
          <div className="section-title">{concept?.name}</div>
          <div className="section-sub">{concept?.definition}</div>
        </div>
        <div style={{padding:"6px 14px",borderRadius:20,background:"var(--s3)",border:"1px solid var(--b1)"}}>
          <div className="txs tm" style={{color:ME.getLevel(subject.mastery[cId]||0).color,fontWeight:700}}>{ME.getLevel(subject.mastery[cId]||0).label}</div>
        </div>
      </div>
      {phase==="explain"&&(
        <div style={{maxWidth:"100%"}}>
          {/* Source selector — shown before generating */}
          {!sourcesReady&&(
            <div className="card mb20" style={{background:"linear-gradient(135deg,#fff9f8,#f8fafc)"}}>
              <div className="card-label mb12">CHOOSE YOUR LEARNING SOURCE</div>
              <div className="f g12 mb16">
                <div onClick={()=>setSourceChoice(s=>({...s,doc:!s.doc}))}
                  style={{flex:1,padding:"14px 16px",borderRadius:12,cursor:"pointer",border:\`2px solid \${sourceChoice.doc?"#2563eb":"var(--b1)"}\`,background:sourceChoice.doc?"#eff6ff":"#fff",transition:"all 0.15s"}}>
                  <div className="f ac g10">
                    <div style={{width:20,height:20,borderRadius:4,background:sourceChoice.doc?"#2563eb":"#fff",border:\`2px solid \${sourceChoice.doc?"#2563eb":"#cbd5e1"}\`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sourceChoice.doc&&<span style={{color:"#fff",fontSize:12,fontWeight:800}}>✓</span>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:sourceChoice.doc?"#2563eb":"var(--t2)"}}>📄 From My Document</div>
                      <div className="txs t3 tm">Based on your uploaded lecture</div>
                    </div>
                  </div>
                </div>
                <div onClick={()=>setSourceChoice(s=>({...s,kb:!s.kb}))}
                  style={{flex:1,padding:"14px 16px",borderRadius:12,cursor:"pointer",border:\`2px solid \${sourceChoice.kb?"#ff6f61":"var(--b1)"}\`,background:sourceChoice.kb?"#fff5f4":"#fff",transition:"all 0.15s"}}>
                  <div className="f ac g10">
                    <div style={{width:20,height:20,borderRadius:4,background:sourceChoice.kb?"#ff6f61":"#fff",border:\`2px solid \${sourceChoice.kb?"#ff6f61":"#cbd5e1"}\`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sourceChoice.kb&&<span style={{color:"#fff",fontSize:12,fontWeight:800}}>✓</span>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:sourceChoice.kb?"#e8503f":"var(--t2)"}}>🧠 From Knowledge Base</div>
                      <div className="txs t3 tm">Claude's general AI knowledge</div>
                    </div>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary btn-lg"
                onClick={generateExplanation}
                disabled={!sourceChoice.doc&&!sourceChoice.kb}>
                ⚡ Generate Explanation
              </button>
            </div>
          )}
          <div className="f ac jb mb20">
            <button className="btn btn-primary btn-sm">📖 Explanation</button>
            <div className="f ac g12">
              {scrollPct>=80
                ? <button className="btn btn-primary btn-sm" onClick={()=>onGoToEval(cId)}
                    style={{background:"linear-gradient(135deg,#16a34a,#0d9488)",boxShadow:"0 4px 14px rgba(22,163,74,0.35)"}}>
                    ✅ Take Quiz ({scrollPct}% read)
                  </button>
                : <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 14px",borderRadius:8,background:"var(--s3)",border:"1px solid var(--b1)"}}>
                    <div style={{width:80,height:4,background:"var(--b1)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{width:\`\${scrollPct}%\`,height:"100%",background:"#ff6f61",borderRadius:2,transition:"width 0.3s"}}/>
                    </div>
                    <span className="txs t3 tm">{scrollPct}% read{scrollPct<80?" — scroll to unlock quiz":""}</span>
                  </div>
              }
            </div>
          </div>
          <div ref={msgContainerRef} onScroll={handleScroll} style={{maxHeight:"60vh",overflowY:"auto",paddingRight:4}}>
          {messages.map((m,i)=>{
            // Loading states
            if(m.role==="loading-doc") return (
              <div key={i} className="loading fade"><div className="spin"/><span>Reading your document...</span></div>
            );
            if(m.role==="loading-kb") return (
              <div key={i} className="loading fade"><div className="spin"/><span>Generating knowledge base answer...</span></div>
            );
            // Doc answer — collapsible
            if(m.role==="doc") return (
              <div key={i} className="fade" style={{marginBottom:20}}>
                <div onClick={()=>setDocCollapsed(p=>!p)}
                  style={{display:"flex",alignItems:"center",gap:8,marginBottom:docCollapsed?0:10,cursor:"pointer",userSelect:"none",
                    padding:"10px 14px",borderRadius:docCollapsed?10:"10px 10px 0 0",
                    background:"#eff6ff",border:"1px solid #bfdbfe",
                    borderBottom:docCollapsed?"1px solid #bfdbfe":"none"}}>
                  <div style={{width:3,height:20,borderRadius:2,background:"#2563eb",flexShrink:0}}/>
                  <div style={{fontSize:11,fontWeight:700,fontFamily:"var(--mono)",color:"#2563eb",letterSpacing:"1.5px",flex:1}}>📄 AS PER THE DOCUMENT</div>
                  {m.docName&&<div style={{fontSize:10,color:"#2563eb",fontFamily:"var(--mono)",padding:"2px 8px",background:"#fff",borderRadius:10,border:"1px solid #bfdbfe"}}>{m.docName}</div>}
                  <div style={{fontSize:12,color:"#2563eb",marginLeft:4}}>{docCollapsed?"▶":"▼"}</div>
                </div>
                {!docCollapsed&&(
                  <div style={{padding:"16px 20px",borderRadius:"0 0 10px 10px",background:"#f8fbff",border:"1px solid #bfdbfe",borderTop:"none",fontSize:14,lineHeight:1.85,color:"var(--t1)",whiteSpace:"pre-wrap"}}>
                    {m.content}
                  </div>
                )}
              </div>
            );
            // KB answer — collapsible
            if(m.role==="kb") return (
              <div key={i} className="fade" style={{marginBottom:20}}>
                <div onClick={()=>setKbCollapsed(p=>!p)}
                  style={{display:"flex",alignItems:"center",gap:8,marginBottom:kbCollapsed?0:10,cursor:"pointer",userSelect:"none",
                    padding:"10px 14px",borderRadius:kbCollapsed?10:"10px 10px 0 0",
                    background:"#fff5f4",border:"1px solid #ffcdc9",
                    borderBottom:kbCollapsed?"1px solid #ffcdc9":"none"}}>
                  <div style={{width:3,height:20,borderRadius:2,background:"#ff6f61",flexShrink:0}}/>
                  <div style={{fontSize:11,fontWeight:700,fontFamily:"var(--mono)",color:"#ff6f61",letterSpacing:"1.5px",flex:1}}>🧠 AS PER MY KNOWLEDGE BASE</div>
                  <div style={{fontSize:12,color:"#ff6f61",marginLeft:4}}>{kbCollapsed?"▶":"▼"}</div>
                </div>
                {!kbCollapsed&&(
                  <div style={{padding:"16px 20px",borderRadius:"0 0 10px 10px",background:"#fffaf9",border:"1px solid #ffcdc9",borderTop:"none",fontSize:14,lineHeight:1.85,color:"var(--t1)",whiteSpace:"pre-wrap"}}>
                    {m.content}
                  </div>
                )}
              </div>
            );
            // User chat message
            if(m.role==="user") return (
              <div key={i} className="fade" style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
                <div style={{maxWidth:"72%",padding:"12px 16px",borderRadius:"18px 18px 4px 18px",background:"linear-gradient(135deg,#ff6f61,#e8503f)",color:"#fff",fontSize:14,lineHeight:1.8,boxShadow:"0 4px 14px rgba(255,111,97,0.3)"}}>
                  {m.content}
                </div>
              </div>
            );
            // AI chat reply
            return (
              <div key={i} className="fade" style={{display:"flex",justifyContent:"flex-start",marginBottom:14}}>
                <div style={{maxWidth:"72%",padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:"#fff",border:"1px solid var(--b1)",fontSize:14,lineHeight:1.8,color:"var(--t2)",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                  <div style={{fontSize:9,letterSpacing:"2px",color:"var(--t4)",fontFamily:"var(--mono)",marginBottom:6,fontWeight:700}}>🤖 AI TUTOR</div>
                  <div style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
                </div>
              </div>
            );
          })}
          {loading&&<div className="loading"><div className="spin"/><span>AI is thinking...</span></div>}
          </div>
          {messages.length>0&&(
            <div className="iarea mt16" style={{position:"sticky",bottom:0,background:"#fff"}}>
              <textarea placeholder="Ask a question... (Enter to send)" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}} rows={2}/>
              <div className="f fc g8">
                <button className="btn btn-primary btn-sm" onClick={sendMsg} disabled={loading||!input.trim()}>Send</button>
                <button className="btn btn-secondary btn-sm" onClick={startQuiz}>Quiz →</button>
              </div>
            </div>
          )}
        </div>
      )}
      {phase==="quiz"&&(
        <div>
          <div className="f g8 mb20"><button className="btn btn-ghost btn-sm" onClick={()=>setPhase("explain")}>← Back to Lesson</button></div>
          {loading?<div className="loading"><div className="spin"/><span>Evaluation in progress — generating questions...</span></div>:<QuizComp/>}
        </div>
      )}
      {phase==="result"&&(
        <div className="fade" style={{textAlign:"center",padding:"48px 20px"}}>
          <div className="score-big">{score}%</div>
          <div style={{fontSize:20,fontWeight:800,marginBottom:8,marginTop:12,color:"var(--t1)"}}>{score>=80?"Excellent work! 🎉":score>=60?"Good effort! 📚":"Keep practising! 💪"}</div>
          <div className="ts t3 mb24 tm">Updated mastery: <span style={{color:ME.getLevel(subject.mastery[cId]||0).color,fontWeight:700}}>{subject.mastery[cId]||0}%</span>{" · "}{(subject.mastery[cId]||0)>=75?"Concept Mastered ✓":"Needs more practice"}</div>
          <div className="f g12 jc">
            <button className="btn btn-secondary" onClick={()=>setPhase("explain")}>Review Lesson</button>
            <button className="btn btn-primary" onClick={startQuiz}>Retake Quiz</button>
            <button className="btn btn-ghost" onClick={()=>{setPhase("select");setMessages([]);setCId(null);}}>Next Concept →</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default LearnScreen;
`, "utf8");
console.log("Written src/LearnScreen.jsx");
fs.writeFileSync("src/LibraryScreen.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME } from './utils.js';
const LibraryScreen = ({ subject }) => {
  const docs = subject.docs || [];

  const fmtDate = (ts) => {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2,"0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mon = months[d.getMonth()];
    const yr = String(d.getFullYear()).slice(2);
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return \`\${day}-\${mon}-\${yr} \${hh}:\${mm}\`;
  };

  const extIcon = (type) => {
    if(!type) return "📄";
    const t = type.toUpperCase();
    if(t==="PDF") return "📕";
    if(["DOCX","DOC"].includes(t)) return "📘";
    if(["XLSX","XLS"].includes(t)) return "📗";
    if(["PPTX","PPT"].includes(t)) return "📙";
    if(["JPG","JPEG","PNG","WEBP","GIF"].includes(t)) return "🖼️";
    return "📄";
  };



  return (
    <div className="fade">
      <div className="section-title">Document Library</div>
      <div className="section-sub">{subject.emoji} {subject.name} · {docs.length} document{docs.length!==1?"s":""} uploaded</div>

      {docs.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📂</div>
          <div style={{fontSize:14,color:"var(--t3)",marginBottom:8}}>No documents yet</div>
          <div className="ts t4 tm">Upload a lecture to get started</div>
        </div>
      ) : (
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          {/* Table header */}
          <div style={{display:"grid",gridTemplateColumns:"48px 1fr 90px 150px",
            background:"var(--s3)",borderBottom:"1px solid var(--b1)",
            padding:"10px 16px",gap:12,alignItems:"center"}}>
            {["SR","DOCUMENT NAME","TYPE","UPLOADED ON"].map(h=>(
              <div key={h} style={{fontSize:10,fontWeight:700,color:"var(--t3)",fontFamily:"var(--mono)",letterSpacing:"1.5px"}}>{h}</div>
            ))}
          </div>
          {/* Table rows */}
          {[...docs].reverse().map((doc,i)=>(
            <div key={doc.id}
              style={{display:"grid",gridTemplateColumns:"48px 1fr 90px 150px",
                padding:"14px 16px",gap:12,alignItems:"center",
                borderBottom:i<docs.length-1?"1px solid var(--b1)":"none",
                transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--s3)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {/* Sr No */}
              <div style={{fontSize:12,fontWeight:700,color:"var(--t3)",fontFamily:"var(--mono)"}}>{docs.length-i}</div>
              {/* Document Name */}
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                <div className="txs t3 tm">{doc.topic} · {doc.conceptCount} concepts</div>
              </div>
              {/* Doc Type */}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:16}}>{extIcon(doc.fileType)}</span>
                <span style={{fontSize:11,fontWeight:700,color:"var(--t2)",fontFamily:"var(--mono)"}}>{doc.fileType||"TEXT"}</span>
              </div>
              {/* Uploaded On */}
              <div style={{fontSize:12,color:"var(--t2)",fontFamily:"var(--mono)"}}>{fmtDate(doc.uploadedAt)}</div>

            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {docs.length>0&&(
        <div className="card mt16" style={{background:"linear-gradient(135deg,#fff9f8,#fff3f2)",borderColor:"#ffcdc9"}}>
          <div className="f g20">
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:"#ff6f61"}}>{docs.length}</div>
              <div className="txs t3 tm">Documents</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:"#263238"}}>{docs.reduce((a,d)=>a+d.conceptCount,0)}</div>
              <div className="txs t3 tm">Concepts Total</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:800,color:"#0d9488"}}>{Object.values(subject.mastery).filter(v=>v>=75).length}</div>
              <div className="txs t3 tm">Mastered</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================================
// ...
// ============================================================
export default LibraryScreen;
`, "utf8");
console.log("Written src/LibraryScreen.jsx");
fs.writeFileSync("src/NewSubjectModal.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME } from './utils.js';
const NewSubjectModal = ({ onSave, onClose }) => {
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("📚");
  const emojis=["📚","📊","🔬","💻","🤖","🧬","📐","🌍","🎨","⚙️","🧪","📖"];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">New Subject</div>
        <div className="modal-sub">Create a new subject to organise your lectures</div>
        <div className="card-label">CHOOSE AN ICON</div>
        <div className="f fw g8 mb16">
          {emojis.map(e=>(
            <div key={e} onClick={()=>setEmoji(e)}
              style={{width:40,height:40,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",background:emoji===e?"#fff5f4":"#f1f5f9",border:\`2px solid \${emoji===e?"#ff6f61":"transparent"}\`,transition:"all 0.15s"}}>
              {e}
            </div>
          ))}
        </div>
        <div className="card-label">SUBJECT NAME</div>
        <input className="input-full mb20" placeholder="e.g. Machine Learning, Data Structures..."
          value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(name.trim(),emoji)}
          style={{display:"block"}}/>
        <div className="f g12">
          <button className="btn btn-primary" onClick={()=>name.trim()&&onSave(name.trim(),emoji)} disabled={!name.trim()}>Create Subject</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MASTERY RING
// ============================================================
export default NewSubjectModal;
`, "utf8");
console.log("Written src/NewSubjectModal.jsx");
fs.writeFileSync("src/Ring.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { ME, subjectAvg } from './utils.js';
const Ring = ({ score, size=56, sw=4 }) => {
  const r=(size-sw*2)/2, circ=2*Math.PI*r;
  const {color}=ME.getLevel(score);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={circ-(score/100)*circ} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.6s ease"}}/>
    </svg>
  );
};

// Subject avg mastery

// ============================================================
// ...
// ============================================================
export default Ring;
`, "utf8");
console.log("Written src/Ring.jsx");
fs.writeFileSync("src/SubjectsHome.jsx", `import React, { useState, useEffect, useRef } from 'react';
import Ring from './Ring.jsx';
import { ME, subjectAvg } from './utils.js';
const SubjectsHome = ({ subjects, onSelect, onCreate }) => {
  const subList = Object.values(subjects);
  return (
    <div className="fade">
      <div className="section-title">My Subjects</div>
      <div className="section-sub">Select a subject to study or create a new one</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:20}}>
        {subList.map(sub=>{
          const avg=subjectAvg(sub);
          const total=Object.keys(sub.graph.nodes).length;
          const mastered=Object.values(sub.graph.nodes).filter(c=>(sub.mastery[c.id]||0)>=75).length;
          const {color}=ME.getLevel(avg);
          return (
            <div key={sub.id} className="subject-home-card" onClick={()=>onSelect(sub.id)}
              style={{"--card-color":color}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:\`linear-gradient(90deg,\${color},\${color}88)\`,opacity:1,borderRadius:"20px 20px 0 0"}}/>
              <div className="f ac jb mb16">
                <div style={{fontSize:36}}>{sub.emoji}</div>
                <div style={{position:"relative"}}>
                  <Ring score={avg} size={52} sw={4}/>
                  <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:10,fontWeight:800,fontFamily:"var(--mono)",color}}>{avg}%</div>
                </div>
              </div>
              <div style={{fontSize:17,fontWeight:800,marginBottom:6,color:"var(--t1)"}}>{sub.name}</div>
              <div className="f g16">
                <div className="txs t3 tm">{total} concepts</div>
                <div className="txs t3 tm">{mastered} mastered</div>
              </div>
              <div className="mbar mt12"><div className="mfill" style={{width:\`\${avg}%\`,background:color}}/></div>
            </div>
          );
        })}
        <div className="new-subject-card" onClick={onCreate}>
          <div style={{fontSize:32,opacity:0.4}}>➕</div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--t3)"}}>New Subject</div>
          <div className="txs t4 tm" style={{textAlign:"center"}}>Upload lectures for a new topic</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// DASHBOARD (per-subject)
// ============================================================
export default SubjectsHome;
`, "utf8");
console.log("Written src/SubjectsHome.jsx");
fs.writeFileSync("src/UploadScreen.jsx", `import React, { useState, useEffect, useRef } from 'react';
import { graphEngine, exJSON } from './utils.js';
const UploadScreen = ({ subject, onUpdate, apiKey }) => {
  const [drag,setDrag]=useState(false);
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState("");
  const [result,setResult]=useState(null);
  const [imgPreview,setImgPreview]=useState(null);
  const [currentFileName,setCurrentFileName]=useState("Pasted Text");
  const fileRef=useRef();

  // ── Claude text API ──
  const callClaude=async(sys,usr,mt=1500)=>{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:mt,system:sys,messages:[{role:"user",content:usr}]})
    });
    const d=await res.json(); return d.content?.[0]?.text||"";
  };

  // ── Claude Vision API ──
  const callClaudeVision=async(b64,mime)=>{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:2000,
        messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:mime,data:b64}},
          {type:"text",text:"Extract all readable text from this image. Return only the raw text content, preserving structure as much as possible."}
        ]}]
      })
    });
    const d=await res.json(); return d.content?.[0]?.text||"";
  };

  // ── FILE ROUTER ──
  const handleFile=async(file)=>{
    if(!file) return;
    setCurrentFileName(file.name);

    const ext=file.name.toLowerCase().split(".").pop();

    // ...
    if(["txt","md","html","htm","csv"].includes(ext)){
      const t=await file.text();
      processText(t, file.name, ext.toUpperCase()); return;
    }

    // ...
    if(ext==="pdf"){
      setLoading(true); setStep("Reading PDF...");
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          // Convert PDF to base64
          const bytes=new Uint8Array(e.target.result);
          let binary="";
          for(let i=0;i<bytes.byteLength;i++) binary+=String.fromCharCode(bytes[i]);
          const b64=btoa(binary);
          setStep("Extracting text from PDF with AI...");
          // ...
          const res=await fetch("https://api.anthropic.com/v1/messages",{
            method:"POST",
            headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
            body:JSON.stringify({
              model:"claude-haiku-4-5-20251001",
              max_tokens:3000,
              messages:[{role:"user",content:[
                {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
                {type:"text",text:"Extract all the text content from this PDF document. Return only the raw text, preserving paragraph structure."}
              ]}]
            })
          });
          const d=await res.json();
          const extracted=d.content?.[0]?.text||"";
          if(!extracted||extracted.length<30){
            setStep(""); setLoading(false);
            alert("Could not read this PDF. Please open it, select all (Ctrl+A), copy (Ctrl+C) and paste in the text box below.");
            return;
          }
          await processText(extracted, file.name, 'PDF');
        } catch(err){ setStep("PDF Error: "+err.message); setLoading(false); }
      };
      reader.readAsArrayBuffer(file); return;
    }

    // ...
    if(["docx","doc"].includes(ext)){
      setLoading(true); setStep("Reading Word document...");
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          // ...
          const arr=new Uint8Array(e.target.result);
          const decoder=new TextDecoder("utf-8");
          const raw=decoder.decode(arr);
          // ...
          const matches=raw.match(/<w:t[^>]*>([^<]+)<\\/w:t>/g)||[];
          let text=matches.map(m=>m.replace(/<[^>]+>/g,"")).join(" ");
          if(text.trim().length>50){
            await processText(text);
          } else {
            // ...
            setStep(""); setLoading(false);
            alert("Could not extract text from this Word file. Please copy-paste the content into the text box below.");
          }
        } catch(err){ setStep("Word Error: "+err.message); setLoading(false); }
      };
      reader.readAsArrayBuffer(file); return;
    }

    // ...
    if(["xlsx","xls","pptx","ppt"].includes(ext)){
      setLoading(true); setStep(\`Reading \${ext.toUpperCase()}...\`);
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          const decoder=new TextDecoder("utf-8","{ fatal:false }");
          const raw=decoder.decode(new Uint8Array(e.target.result));
          // ...
          const matches=raw.match(/<(?:t|a:t)[^>]*>([^<]+)<\\/(?:t|a:t)>/g)||[];
          let text=matches.map(m=>m.replace(/<[^>]+>/g,"")).join(" ");
          if(text.trim().length>30){
            await processText(text, file.name, ext.toUpperCase());
          } else {
            setStep(""); setLoading(false);
            alert("Could not extract text from this file. Please copy-paste the content into the text box below.");
          }
        } catch(err){ setStep("File Error: "+err.message); setLoading(false); }
      };
      reader.readAsArrayBuffer(file); return;
    }

    // ...
    if(["jpg","jpeg","png","webp","gif","bmp"].includes(ext)){
      setLoading(true); setStep("Analysing image with AI Vision...");
      const reader=new FileReader();
      reader.onload=async(e)=>{
        try{
          const dataUrl=e.target.result;
          setImgPreview(dataUrl);
          const b64=dataUrl.split(",")[1];
          const mimeMap={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",bmp:"image/png"};
          const extracted=await callClaudeVision(b64, mimeMap[ext]||"image/jpeg");
          await processText(extracted, file.name, ext.toUpperCase());
        } catch(err){ setStep("Image Error: "+err.message); setLoading(false); }
      };
      reader.readAsDataURL(file); return;
    }

    alert(\`Unsupported file type: .\${ext}\`);
  };

  const processText=async(lec, fileName='Pasted Text', fileType='TEXT')=>{
    setLoading(true); setStep("Analysing content...");
    const docId = \`doc_\${Date.now()}\`;
    try{
      const raw=await callClaude(
        \`Extract key concepts from lecture text. Return ONLY valid JSON:\\n{"topic":"Topic Name","concepts":[{"id":"c_unique","name":"Name","definition":"One clear sentence","importance":0.8,"difficulty":0.5}],"relationships":[{"source":"id","target":"id","type":"prerequisite"}]}\\nRules: 5-15 concepts, unique short ids starting with c_, prerequisite only where genuinely required, JSON only.\`,
        \`Extract concepts from:\\n\\n\${lec.substring(0,3000)}\`
      );
      setStep("Building knowledge graph...");
      const parsed=exJSON(raw);
      if(!parsed?.concepts) throw new Error("Could not extract concepts. Try with more detailed content.");
      let ng={...subject.graph};
      const nm={...subject.mastery};
      const topicId=(parsed.topic||"lecture").toLowerCase().replace(/\\s+/g,"_");
      // docId already defined above
      parsed.concepts.forEach(c=>{
        const cid=\`\${subject.id}_\${c.id||"c_"+Date.now()+"_"+Math.random().toString(36).substr(2,5)}\`;
        const concept={...c,id:cid,topicId,state:"NOT_LEARNED",sourceDocId:docId};
        ng=graphEngine.addNode(ng,concept);
        if(nm[cid]===undefined) nm[cid]=0;
      });
      (parsed.relationships||[]).forEach(r=>{
        const sid=\`\${subject.id}_\${r.source}\`, tid=\`\${subject.id}_\${r.target}\`;
        if(ng.nodes[sid]&&ng.nodes[tid]) ng=graphEngine.addEdge(ng,sid,tid,r.type||"prerequisite");
      });
      // ...
      const existingNames = new Set(Object.values(ng).map ? [] : Object.values(subject.graph.nodes).map(n=>n.name.toLowerCase()));
      const newConceptCount = parsed.concepts.filter(c=>!existingNames.has(c.name.toLowerCase())).length;
      const docEntry = {
        id: docId,
        name: fileName,
        topic: parsed.topic,
        conceptCount: newConceptCount,
        uploadedAt: Date.now(),
        fileType: fileType,
        rawText: lec.substring(0, 50000),
      };
      const updatedDocs = [...(subject.docs||[]), docEntry];
      onUpdate({...subject,graph:ng,mastery:nm,docs:updatedDocs});
      setResult({topic:parsed.topic,count:parsed.concepts.length,concepts:parsed.concepts});
      setStep("");
    } catch(e){ setStep(\`Error: \${e.message}\`); }
    setLoading(false);
  };

  if(result) return (
    <div className="fade">
      <div className="section-title">Content Processed ✓</div>
      <div className="section-sub">{result.count} concepts added to {subject.name}</div>
      {imgPreview&&<div className="mb16"><img src={imgPreview} alt="Uploaded" style={{maxHeight:120,borderRadius:8,border:"1px solid var(--b1)"}}/></div>}
      <div className="card mb20" style={{borderColor:"#86efac",background:"#f0fdf4"}}>
        <div className="f ac g12 mb20">
          <div style={{width:48,height:48,borderRadius:14,background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>✅</div>
          <div><div style={{fontSize:16,fontWeight:700}}>Knowledge graph updated!</div><div className="ts t3 tm">{result.count} concepts added with dependency relationships</div></div>
        </div>
        <div className="gauto">
          {result.concepts.map(c=>(<div key={c.id} className="cc"><div className="cc-name">{c.name}</div><div className="cc-def">{c.definition}</div><div className="mbar"><div className="mfill" style={{width:"0%",background:"#ff6f61"}}/></div></div>))}
        </div>
      </div>
      <button className="btn btn-secondary" onClick={()=>{setResult(null);setText("");setImgPreview(null);setCurrentFileName("Pasted Text");}}>+ Add Another File</button>
    </div>
  );

  const FORMATS=[
    {icon:"📄",label:"Text",types:"TXT · MD · HTML · CSV",color:"#16a34a"},
    {icon:"📕",label:"PDF",types:"PDF",color:"#e8503f"},
    {icon:"📘",label:"Word",types:"DOCX · DOC",color:"#2563eb"},
    {icon:"📗",label:"Spreadsheet",types:"XLSX · PPTX",color:"#d97706"},
    {icon:"🖼️",label:"Image",types:"JPG · PNG · WEBP",color:"#7c3aed"},
  ];

  return (
    <div className="fade">
      <div className="section-title">Ingest Content</div>
      <div className="section-sub">Adding to: <strong>{subject.emoji} {subject.name}</strong></div>
      <div className="f fw g8 mb12">
        {FORMATS.map(f=>(
          <div key={f.label} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,background:"#fff",border:"1px solid var(--b1)",fontSize:10,fontWeight:600}}>
            <span style={{fontSize:12}}>{f.icon}</span><span style={{color:f.color}}>{f.types}</span>
          </div>
        ))}
      </div>
      <div className={\`uzone mb20 \${drag?"drag":""}\`}
        onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDrag(true)}}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}>
        <input ref={fileRef} type="file"
          accept=".txt,.md,.html,.htm,.csv,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.webp,.gif,.bmp"
          style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        <div style={{fontSize:32,marginBottom:8}}>📂</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"var(--t1)"}}>Drop any file here</div>
        <div className="ts t3 tm">PDF · Word · Excel · PowerPoint · Images · Text · or click to browse</div>
      </div>
      <div className="card mb20">
        <div className="card-label">OR PASTE TEXT DIRECTLY</div>
        <textarea className="input-full" rows={6}
          placeholder="Paste your lecture notes, textbook excerpt, or any study material here..." rows={4}
          value={text} onChange={e=>setText(e.target.value)}/>
      </div>
      {loading
        ?<div className="loading"><div className="spin"/><span>{step}</span></div>
        :<button className="btn btn-primary btn-lg" onClick={()=>processText(text,'Pasted Text','TEXT')} disabled={!text.trim()}>⚡ Extract Concepts & Build Graph</button>
      }
    </div>
  );
};



// ============================================================
// LIBRARY SCREEN
// ============================================================
export default UploadScreen;
`, "utf8");
console.log("Written src/UploadScreen.jsx");
fs.writeFileSync("src/main.jsx", `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`, "utf8");
console.log("Written src/main.jsx");
fs.writeFileSync("src/utils.js", `// ============================================================
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
  try { const m=text.match(/\`\`\`json\\n?([\\s\\S]*?)\\n?\`\`\`/)||text.match(/(\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\])/); return JSON.parse(m?m[1]:text); } catch { return null; }
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
`, "utf8");
console.log("Written src/utils.js");
fs.writeFileSync("package.json", `{
  "name": "learnova",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "deploy": "vite build && gh-pages -d dist -b master"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "eslint": "^9.13.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.14",
    "gh-pages": "^6.3.0",
    "globals": "^15.11.0",
    "vite": "^6.0.1"
  }
}`, "utf8");
console.log("Written package.json");
fs.writeFileSync("vite.config.js", `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/learnova/',
})
`, "utf8");
console.log("Written vite.config.js");
fs.writeFileSync("index.html", `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/learnova/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Learnova — AI Learning Operating System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`, "utf8");
console.log("Written index.html");