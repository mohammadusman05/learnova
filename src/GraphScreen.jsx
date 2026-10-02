import React, { useState, useEffect, useRef } from 'react';
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
  const layerName=(i)=>i===0?"Foundation":i===maxLayer&&maxLayer>0?"Advanced":`Layer ${i}`;

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
                border:`1.5px solid ${color}`,background:isActive?color:"transparent"}}>
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
            const markerId=selected&&(e.source===selected||e.target===selected)?"arr-sel":`arr-${lyrIdx}`;
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
                d={`M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`}
                fill="none" stroke={stroke} strokeWidth={2}
                strokeOpacity={opacity}
                markerEnd={`url(#${markerId})`}
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
              <div className="tag" style={{background:`${layerColors[li%layerColors.length]}15`,color:layerColors[li%layerColors.length],borderColor:`${layerColors[li%layerColors.length]}50`,cursor:"pointer"}}
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
        <button className={`btn ${activeTab==="full"?"btn-primary":"btn-secondary"} btn-sm`}
          onClick={()=>{ setActiveTab("full"); setSelectedDocId(null); }}>
          🌐 Full Knowledge Graph
        </button>
        <button className={`btn ${activeTab==="pdf"?"btn-primary":"btn-secondary"} btn-sm`}
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
                          border:`1.5px solid ${isActive?"#ff6f61":"var(--b1)"}`,
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
