import React, { useState, useEffect, useRef } from 'react';
import { ME, MASTERY_THRESHOLD, answerLogCsv } from './utils.js';
import { faithCsv, faithSummary } from './faithfulness.js';
import { exportSubject, shareFileName } from './subjectShare.js';
import { plainChatCsv, chatSummary } from './plainChat.js';
import { testResultsCsv, testSummary, getTest } from './testSet.js';
const LibraryScreen = ({ subject }) => {
  const docs = subject.docs || [];
  const answerCount = (subject.answerLog || []).length;

  // TA point 9: download every saved answer (Study + Evaluation) as a CSV file
  // TA point 19: download every lecture check (explanations, chat answers, quiz answer keys)
  const fs = faithSummary(subject);
  const downloadFaith = () => {
    const blob = new Blob(["\uFEFF" + faithCsv(subject)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (subject.name || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const d = new Date();
    a.href = url; a.download = `learnova-faithfulness-${slug}-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // TA point 20: share the lectures, concepts and links (never progress) so learners don't upload the PDFs again
  const downloadSubject = () => {
    const blob = new Blob([JSON.stringify(exportSubject(subject))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = shareFileName(subject);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // TA point 22: what the learner asked in Plain AI chat mode
  const cs = chatSummary(subject);
  const downloadChatLog = () => {
    const blob = new Blob(["\uFEFF" + plainChatCsv(subject)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (subject.name || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const d = new Date();
    a.href = url; a.download = `learnova-plain-chat-${slug}-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // TA point 23: pre-test, post-test and normalised gain of the uploaded test
  const ts = testSummary(subject), test = getTest(subject), nAttempts = (subject.testAttempts || []).length;
  const downloadTestResults = () => {
    const blob = new Blob(["\uFEFF" + testResultsCsv(subject)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (subject.name || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const d = new Date();
    a.href = url; a.download = `learnova-test-results-${slug}-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadAnswerLog = () => {
    const csv = "﻿" + answerLogCsv(subject); // BOM so Excel shows symbols correctly
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (subject.name || "subject").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    const d = new Date(); // local date, so the file name matches the user's own day
    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    a.download = `learnova-answers-${slug}-${ymd}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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

      {docs.length>0 && (
        <div className="card mb16 share-card" style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            <div className="card-label">SHARE THIS SUBJECT</div>
            <div className="txs t3" style={{lineHeight:1.7,marginTop:4}}>
              Download the lectures, concepts and prerequisite links as one file. Others open it with <b>⬆ Import subject</b> on the All Subjects page — no need to upload (and pay for) the PDFs again.
              Your progress, answers and chats are <b>not</b> included. The file contains the lecture text, so share it only with your course.
            </div>
          </div>
          <button className="btn btn-primary btn-sm export-subject" onClick={downloadSubject}>⬇ Export subject</button>
        </div>
      )}

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
              <div style={{fontSize:28,fontWeight:800,color:"#0d9488"}}>{Object.values(subject.mastery).filter(v=>v>=MASTERY_THRESHOLD).length}</div>
              <div className="txs t3 tm">Mastered</div>
            </div>
          </div>
        </div>
      )}

      {/* Answer log export */}
      <div className="card mt16">
        <div className="f ac jb" style={{gap:12,flexWrap:"wrap"}}>
          <div>
            <div className="card-label" style={{margin:0}}>ANSWER LOG</div>
            <div className="txs t3 tm" style={{marginTop:4}}>
              {answerCount>0
                ? `${answerCount} answer${answerCount!==1?"s":""} saved from Study and Evaluation`
                : "No answers yet — answers are saved when quizzes and evaluations are submitted"}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={downloadAnswerLog} disabled={answerCount===0}>⬇ Download CSV</button>
        </div>
      </div>

      {/* Lecture checks (TA point 19) */}
      <div className="card mt16 faith-card">
        <div className="f ac jb" style={{gap:12,flexWrap:"wrap"}}>
          <div>
            <div className="card-label" style={{margin:0}}>LECTURE CHECKS (TUTOR FAITHFULNESS)</div>
            <div className="txs t3 tm" style={{marginTop:4}}>
              {fs.answers || fs.quizzes
                ? `${fs.answers} answer${fs.answers!==1?"s":""} checked${fs.avgScore!==null?` · on average ${fs.avgScore}% of statements supported by the lecture`:""} · ${fs.quizzes} quiz${fs.quizzes!==1?"zes":""} with answer keys checked (${fs.corrected} corrected, ${fs.removed} removed)`
                : "No checks yet — explanations, chat answers and lecture quizzes are checked against your lecture automatically"}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm download-faith" onClick={downloadFaith} disabled={!(subject.faithLog||[]).length}>⬇ Faithfulness CSV</button>
        </div>
      </div>
      {(test || nAttempts > 0) && (
        <div className="card mt16 test-results-card">
          <div className="f ac jb" style={{gap:12,flexWrap:"wrap"}}>
            <div>
              <div className="card-label" style={{margin:0}}>📋 UPLOADED TEST RESULTS</div>
              <div className="txs t3 tm" style={{marginTop:4}}>
                {ts.pre === null ? "No attempts yet — take the test in Evaluation (your first attempt is your pre-test)"
                  : ts.post === null ? `Pre-test ${ts.pre}% — post-test not taken yet`
                  : `Pre-test ${ts.pre}% → Post-test ${ts.post}% · normalised gain ${ts.gain === null ? "n/a" : ts.gain.toFixed(2)}${ts.preBeforeStudy === false ? " · ⚠ pre-test taken after studying" : ""}`}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm download-test-results" onClick={downloadTestResults} disabled={!nAttempts}>⬇ Test results CSV</button>
          </div>
        </div>
      )}
      {cs.questions > 0 && (
        <div className="card mt16 plain-chat-card">
          <div className="f ac jb" style={{gap:12,flexWrap:"wrap"}}>
            <div>
              <div className="card-label" style={{margin:0}}>PLAIN AI CHAT LOG</div>
              <div className="txs t3 tm" style={{marginTop:4}}>{cs.chats} chat{cs.chats!==1?"s":""} · {cs.questions} question{cs.questions!==1?"s":""} · about {cs.minutes} minute{cs.minutes!==1?"s":""} — one row per question, with the answer and timings</div>
            </div>
            <button className="btn btn-secondary btn-sm download-plain-chat" onClick={downloadChatLog}>⬇ Chat log (CSV)</button>
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
