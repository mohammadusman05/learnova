import React, { useState, useEffect, useRef } from 'react';
import { ME, graphEngine, MASTERY_THRESHOLD } from './utils.js';
import Ring from './Ring.jsx';
import { dueList } from './revision.js';
import { isStatic } from './studyMode.js';
import { StudyModeCard } from './MemoryBox.jsx';
const Dashboard = ({ subject, onNavigate, onUpdate }) => {
  const {graph,mastery}=subject;
  const concepts=Object.values(graph.nodes);
  const total=concepts.length;
  const mastered=concepts.filter(c=>(mastery[c.id]||0)>=MASTERY_THRESHOLD).length;
  const avg=total?Math.round(concepts.reduce((s,c)=>s+(mastery[c.id]||0),0)/total):0;
  const stat=isStatic(subject); // TA point 21: no suggestions or reminders in Static mode
  const ready=stat?[]:graphEngine.getReadyConcepts(graph,mastery);
  const weak=stat?[]:concepts.filter(c=>(mastery[c.id]||0)>0&&(mastery[c.id]||0)<MASTERY_THRESHOLD).sort((a,b)=>mastery[a.id]-mastery[b.id]);
  const order=graphEngine.getTopoOrder(graph);
  const due=dueList(subject); // TA point 17
  const stats=[
    {label:"TOTAL CONCEPTS",value:total,sub:"in knowledge graph",color:"#ff6f61"},
    {label:"MASTERED",value:mastered,sub:`≥ ${MASTERY_THRESHOLD}% mastery`,color:"#16a34a"},
    {label:"AVG MASTERY",value:`${avg}%`,sub:"across all concepts",color:"#263238"},
    stat?{label:"STUDY MODE",value:"Static",sub:"the same for every learner",color:"#475569"}
        :{label:"READY TO LEARN",value:ready.length,sub:"prerequisites cleared",color:"#e8503f"},
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
                <div style={{flex:1}}><div className="mbar"><div className="mfill" style={{width:`${score}%`,background:color}}/></div></div>
                <div style={{width:36,fontSize:12,fontFamily:"var(--mono)",color,fontWeight:700,textAlign:"right"}}>{score}%</div>
                <div className="tag" style={{background:bg,color,borderColor:border,fontSize:9,minWidth:72,justifyContent:"center"}}>{label.toUpperCase()}</div>
              </div>
            );
          })}
        </div>
        <div className="f fc g16">
          {/* TA point 21: Adaptive / Static switch */}
          <StudyModeCard subject={subject} onChange={onUpdate}/>
          {/* TA point 17: concepts due for revision */}
          {!stat&&<div className="card due-card">
            <div className="card-label" style={{color:"#0369a1"}}>📅 DUE FOR REVISION{due.length?` · ${due.length}`:""}</div>
            {due.length===0
              ? <div className="ts t3 tm">Nothing due — concepts come back here after 1, 3, 7, 14 and 30 days, or sooner if you make a mistake.</div>
              : due.slice(0,5).map(d=>(
                <div key={d.id} className="f ac jb mb8" style={{padding:"10px 14px",borderRadius:12,background:"#f0f9ff",border:"1px solid #bae6fd",cursor:"pointer",gap:10}}
                  onClick={()=>onNavigate("learn",d.id,"revise")}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{d.name}</div>
                    <div className="txs t3 tm" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.reasons[0]}</div>
                  </div>
                  <div className="tag" style={{background:"#e0f2fe",color:"#0369a1",borderColor:"#7dd3fc",fontSize:9,flexShrink:0}}>REVISE →</div>
                </div>
              ))}
          </div>}
          {!stat&&<div className="card" style={{flex:1}}>
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
          </div>}
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
