import React, { useState, useEffect, useRef } from 'react';
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
          width:`${Math.min(100,s.pct)}%`}}/>
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
    const id = `sub_${name.toLowerCase().replace(/\s+/g,"_")}_${Date.now()}`;
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
            <div className={`subject-item ${screen==="home"?"active":""}`} onClick={()=>{setActiveSubjectId(null);setScreen("home");}}>
              <span className="subject-emoji">🏠</span>
              <span className="subject-name">All Subjects</span>
            </div>
            {Object.values(subjects).map(sub=>{
              const avg=subjectAvg(sub);
              return(
                <div key={sub.id} className={`subject-item ${activeSubjectId===sub.id&&screen!=="home"?"active":""}`}
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
                <div key={item.id} className={`nav-item ${screen===item.id?"active":""}`}
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
                <div className="pbar"><div className="pbar-fill" style={{width:total?`${(mastered/total)*100}%`:"0%"}}/></div>
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
