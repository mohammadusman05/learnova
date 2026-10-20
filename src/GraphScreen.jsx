import React, { useState, useEffect, useRef } from 'react';
import { ME, graphEngine } from './utils.js';
import { conceptDocIds } from './conceptExtraction.js';
import { confirmLink, removeLink, flipLink, addLink, recheckAllLinks, linksCsv, evidenceLabel } from './prereqLinks.js';

// TA point 12: how sure we are about a link
const LinkBadge = ({ e }) => {
  if (e.checkedBy === "person") return <span className="tag tag-green" style={{fontSize:9}}>✓ CHECKED BY PERSON</span>;
  if (e.confidence === "high") return <span className="tag tag-teal" style={{fontSize:9}}>HIGH CONFIDENCE</span>;
  if (e.confidence === "medium") return <span className="tag tag-yellow" style={{fontSize:9}}>MEDIUM CONFIDENCE</span>;
  if (e.confidence === "low") return <span className="tag tag-coral" style={{fontSize:9}}>LOW CONFIDENCE</span>;
  return <span className="tag" style={{fontSize:9,background:"var(--s3)",color:"var(--t3)",borderColor:"var(--b1)"}}>NOT CHECKED</span>;
};

const KnowledgeGraph = ({ subject, filterDocId, onGraphChange }) => {
  const { graph, mastery } = subject;
  // ...
  const allConcepts = Object.values(graph.nodes);
  const concepts = filterDocId
    ? allConcepts.filter(c => conceptDocIds(c).includes(filterDocId))
    : allConcepts;

  const [selected, setSelected] = useState(null);
  const [filterLayer, setFilterLayer] = useState(null);
  const [addId, setAddId] = useState("");
  const [linkMsg, setLinkMsg] = useState("");

  // Reset on doc change
  useEffect(()=>{ setSelected(null); setFilterLayer(null); },[filterDocId]);
  useEffect(()=>{ setAddId(""); setLinkMsg(""); },[selected]);

  // person's decisions on links (point 12)
  const change = (r) => { if (r.error) { setLinkMsg(r.error); return; } setLinkMsg(""); onGraphChange && onGraphChange(r.graph); };
  const docs = subject.docs || [];

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
          {/* Prerequisites with reason, lecture evidence and confidence; Confirm / Flip / Remove (point 12) */}
          {(()=>{
            const pre=(graph.edges||[]).filter(e=>e.target===selConcept.id&&graph.nodes[e.source]);
            const existing=new Set(pre.map(e=>e.source));
            const options=allConcepts.filter(c=>c.id!==selConcept.id&&!existing.has(c.id)&&!graphEngine.wouldCreateCycle(graph,c.id,selConcept.id))
              .sort((a,b)=>a.name.localeCompare(b.name));
            return (
              <div className="mb8">
                <div className="txs t3 tm mb4">PREREQUISITES{pre.length===0?" — none":""}</div>
                {pre.map(e=>{
                  const pName=graph.nodes[e.source]?.name;
                  return (
                    <div key={e.source} className="link-row" style={{border:"1px solid var(--b1)",borderRadius:10,padding:"8px 10px",marginBottom:6}}>
                      <div className="f ac jb fw" style={{gap:8}}>
                        <div className="f ac fw g8">
                          <div className="tag tag-coral" style={{cursor:"pointer"}} onClick={()=>setSelected(e.source)}>{pName}</div>
                          <LinkBadge e={e}/>
                          {e.origin==="across-pdfs"&&<span className="tag" style={{fontSize:9,background:"#eff6ff",color:"#2563eb",borderColor:"#bfdbfe"}}>ACROSS PDFs</span>}
                        </div>
                        {onGraphChange&&<div className="f g8">
                          {e.checkedBy!=="person"&&<button className="btn btn-secondary btn-xs" title="This link is right" onClick={()=>change({graph:confirmLink(graph,e.source,e.target)})}>✓ Confirm</button>}
                          <button className="btn btn-secondary btn-xs" title="The direction is wrong" onClick={()=>change(flipLink(graph,docs,e.source,e.target))}>⇄ Flip</button>
                          <button className="btn btn-danger btn-xs" title="This link is wrong" onClick={()=>change({graph:removeLink(graph,e.source,e.target)})}>✕ Remove</button>
                        </div>}
                      </div>
                      {e.reason&&<div className="txs t2" style={{marginTop:6,lineHeight:1.5}}>Why: {e.reason}</div>}
                      <div className="txs t3 tm" style={{marginTop:4,lineHeight:1.5}}>
                        {e.evidence?`📄 “${pName}” is mentioned on ${evidenceLabel(e.evidence)}`:"📄 not mentioned in the lecture text"}
                        {e.checkNote?` · Checker: ${e.checkNote}`:""}
                      </div>
                    </div>
                  );
                })}
                {onGraphChange&&(
                  <div className="f ac fw g8 mt8">
                    <select className="input-full" style={{width:"auto",maxWidth:320,padding:"6px 10px",fontSize:12}} value={addId} onChange={ev=>setAddId(ev.target.value)}>
                      <option value="">+ Add a prerequisite…</option>
                      {options.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button className="btn btn-secondary btn-xs" disabled={!addId} onClick={()=>{ change(addLink(graph,docs,addId,selConcept.id)); setAddId(""); }}>Add</button>
                  </div>
                )}
                {linkMsg&&<div className="txs mt8" style={{color:"#b45309"}}>⚠ {linkMsg}</div>}
              </div>
            );
          })()}
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

const GraphScreen = ({ subject, onUpdate, apiKey }) => {
  const [activeTab, setActiveTab] = useState("full");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [recheckMsg, setRecheckMsg] = useState(null);
  const latest = useRef(subject); latest.current = subject;   // newest subject, so a long re-check doesn't overwrite later changes
  const docs = subject.docs || [];
  const links = (subject.graph.edges || []).filter(e => e.type === "prerequisite");
  const byPerson = links.filter(e => e.checkedBy === "person").length;
  const onGraphChange = onUpdate ? (g) => onUpdate({ ...latest.current, graph: g }) : null;

  // ── Claude text API (same as the Upload screen) ──
  const callClaude = async (sys, usr, mt = 1500, temperature) => {
    const body = { model: "claude-haiku-4-5-20251001", max_tokens: mt, system: sys, messages: [{ role: "user", content: usr }] };
    if (temperature !== undefined) body.temperature = temperature;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error.message || "API error");
    return d.content?.[0]?.text || "";
  };

  // TA point 12: find links again across all PDFs and check every AI link a second time
  const recheck = async () => {
    setBusy(true); setRecheckMsg(null); setStep("Starting...");
    try {
      const r = await recheckAllLinks(callClaude, latest.current.graph, latest.current.docs || [], setStep);
      onUpdate({ ...latest.current, graph: { ...latest.current.graph, edges: r.graph.edges, removedLinks: r.graph.removedLinks } });
      const s = r.stats;
      setRecheckMsg({ ok: s.problems.length === 0,
        text: `Re-check done: ${s.kept} AI link${s.kept !== 1 ? "s" : ""} kept (${s.added} new) · ${s.dropped} dropped · ${s.reversed} direction${s.reversed !== 1 ? "s" : ""} corrected · ${s.personKept} link${s.personKept !== 1 ? "s" : ""} checked by a person left as they are.`
          + (s.unchecked ? ` ${s.unchecked} could not be checked (marked “not checked”).` : ""),
        problems: s.problems });
    } catch (e) { setRecheckMsg({ ok: false, text: `Re-check failed: ${e.message}`, problems: [] }); }
    setBusy(false); setStep("");
  };

  // links CSV (for measuring link accuracy later — TA point 13)
  const downloadLinks = () => {
    const csv = "﻿" + linksCsv(subject);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (subject.name || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    a.href = url; a.download = `learnova-links-${slug}-${ymd}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fade">
      <div className="f jb ac mb16 fw" style={{gap:12}}>
        <div>
          <div className="section-title">Knowledge Graph</div>
          <div className="section-sub">{subject.emoji} {subject.name} · {Object.values(subject.graph.nodes).length} concepts · {links.length} prerequisite link{links.length!==1?"s":""}{byPerson?` (${byPerson} checked by a person)`:""}</div>
        </div>
        <div className="f g8">
          {onUpdate&&<button className="btn btn-secondary btn-sm" onClick={recheck} disabled={busy||Object.keys(subject.graph.nodes).length<2}>{busy?"⏳ Re-checking…":"🔄 Re-check links"}</button>}
          <button className="btn btn-secondary btn-sm" onClick={downloadLinks} disabled={links.length===0&&!(subject.graph.removedLinks||[]).length}>⬇ Links CSV</button>
        </div>
      </div>
      {(busy||recheckMsg)&&(
        <div className="card mb16" style={{fontSize:12,padding:"12px 16px",...(recheckMsg&&!recheckMsg.ok?{borderColor:"#fcd34d",background:"#fffbeb"}:{})}}>
          {busy?<div>⏳ {step}</div>:<>
            <div>{recheckMsg.ok?"✅":"⚠"} {recheckMsg.text}</div>
            {recheckMsg.problems?.length>0&&<div style={{marginTop:4}}>Problems: {recheckMsg.problems.join(" · ")}</div>}
          </>}
        </div>
      )}

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
        <KnowledgeGraph subject={subject} filterDocId={null} onGraphChange={onGraphChange}/>
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
                    const conceptCount=Object.values(subject.graph.nodes).filter(c=>conceptDocIds(c).includes(doc.id)).length;
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
                <KnowledgeGraph subject={subject} filterDocId={selectedDocId} onGraphChange={onGraphChange}/>
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
