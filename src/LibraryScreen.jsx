import React, { useState, useEffect, useRef } from 'react';
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
    return `${day}-${mon}-${yr} ${hh}:${mm}`;
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
