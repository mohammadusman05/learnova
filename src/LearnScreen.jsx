import React, { useState, useEffect, useRef } from 'react';
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
          `Based ONLY on this document text, explain "${c.name}":

${sourceDoc.rawText.substring(0,8000)}

Explain what the document says about "${c.name}".`,
          1500
        );
        setMessages([{role:"loading-doc",content:""},{role:"loading-kb",content:""}]);
        const kbReply=await callClaude(
          `You are an expert AI tutor for "${subject.name}". Explain concepts clearly with examples and analogies.`,
          `Explain "${c.name}" (${c.definition}) with examples and real-world applications. Subject: ${subject.name}`,
          1500
        );
        setMessages([
          {role:"doc",content:docReply,docName:sourceDoc.name},
          {role:"kb",content:kbReply}
        ]);
      } else {
        const exp=await callClaude(
          `You are an expert AI tutor for "${subject.name}". Explain concepts clearly with examples and analogies. Use line breaks for readability.`,
          `Teach me: "${c.name}"
Definition: ${c.definition}
Subject: ${subject.name}

Give a clear explanation with a practical real-world example.`,
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
        `You are an AI tutor for "${subject.name}". Answer questions about "${c?.name}" clearly and concisely.`,
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
      `Generate 3 MCQ questions. Return ONLY JSON:\n{"questions":[{"q":"Question?","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"Why correct"}]}`,
      `Create 3 quiz questions about: ${c?.name} — ${c?.definition} (Subject: ${subject.name})`
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
              <div key={oi} className={`qopt ${sel[qi]===oi?"sel":""} ${done?(oi===q.correct?"correct":sel[qi]===oi?"wrong":""):""}`}
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
                    <div className="mbar"><div className="mfill" style={{width:`${mastery[c.id]||0}%`,background:"#ff6f61"}}/></div>
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
                  <div className="mbar"><div className="mfill" style={{width:`${mastery[c.id]||0}%`,background:color}}/></div>
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
                      <div className="mbar"><div className="mfill" style={{width:`${mastery[c.id]||0}%`,background:color}}/></div>
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
                  style={{flex:1,padding:"14px 16px",borderRadius:12,cursor:"pointer",border:`2px solid ${sourceChoice.doc?"#2563eb":"var(--b1)"}`,background:sourceChoice.doc?"#eff6ff":"#fff",transition:"all 0.15s"}}>
                  <div className="f ac g10">
                    <div style={{width:20,height:20,borderRadius:4,background:sourceChoice.doc?"#2563eb":"#fff",border:`2px solid ${sourceChoice.doc?"#2563eb":"#cbd5e1"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sourceChoice.doc&&<span style={{color:"#fff",fontSize:12,fontWeight:800}}>✓</span>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:sourceChoice.doc?"#2563eb":"var(--t2)"}}>📄 From My Document</div>
                      <div className="txs t3 tm">Based on your uploaded lecture</div>
                    </div>
                  </div>
                </div>
                <div onClick={()=>setSourceChoice(s=>({...s,kb:!s.kb}))}
                  style={{flex:1,padding:"14px 16px",borderRadius:12,cursor:"pointer",border:`2px solid ${sourceChoice.kb?"#ff6f61":"var(--b1)"}`,background:sourceChoice.kb?"#fff5f4":"#fff",transition:"all 0.15s"}}>
                  <div className="f ac g10">
                    <div style={{width:20,height:20,borderRadius:4,background:sourceChoice.kb?"#ff6f61":"#fff",border:`2px solid ${sourceChoice.kb?"#ff6f61":"#cbd5e1"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
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
                      <div style={{width:`${scrollPct}%`,height:"100%",background:"#ff6f61",borderRadius:2,transition:"width 0.3s"}}/>
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
