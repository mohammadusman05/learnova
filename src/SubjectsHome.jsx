import React, { useState, useEffect, useRef } from 'react';
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
              <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${color},${color}88)`,opacity:1,borderRadius:"20px 20px 0 0"}}/>
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
              <div className="mbar mt12"><div className="mfill" style={{width:`${avg}%`,background:color}}/></div>
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
