import React, { useState, useEffect, useRef } from 'react';
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
    {label:"AVG MASTERY",value:`${avg}%`,sub:"across all concepts",color:"#263238"},
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
                <div style={{flex:1}}><div className="mbar"><div className="mfill" style={{width:`${score}%`,background:color}}/></div></div>
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
