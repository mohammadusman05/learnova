import React, { useState, useEffect, useRef } from 'react';
import { ME, exJSON, graphEngine, MASTERY_THRESHOLD, applyAnswers } from './utils.js';
import { conceptDocIds } from './conceptExtraction.js';
import { retrieve, passagesForPrompt, sourcesOf } from './retrieval.js';
import { getMemory, noteStudied, addChatMessages, analyseAnswers, applyAnalysis, checkChatQuestion, applyChatCheck, autoGroup, remapNoted, groupMistakes, applyGrouping } from './learnerMemory.js';
import { MemoryBox, EarlierChat, NotedLine, ChatNoted, StudyModeTag, RecapBox, ForYouBox, TargetedReview } from './MemoryBox.jsx';
import { isStatic } from './studyMode.js';
import { isPersonalised, personalNote, chatContext, CHAT_PERSONAL_RULE, targetBlock, resolveTargets } from './personalise.js';
import { LECTURE_GUARD } from './privacy.js';
import { checkGrounding, checkAnswerKeys, logFaith, groundingEntry, tutorAnswerSystem, filterToLecture } from './faithfulness.js';
import { FaithBadge, KeyCheckNote } from './FaithBadge.jsx';
import { makeCaller } from './claudeApi.js';
import { AiErrorBox } from './AiStatus.jsx';
import { choiceKey, getSaved, saveExplanation } from './savedExplanations.js';
import { scheduleAfterQuiz, dueList, nextRevisionLabel, revisionTargets, getSchedule } from './revision.js';

// TA point 11: list the lecture passages a reply actually cited, e.g. "[S1] L01.pdf, p.6"
const citedSources = (passages, reply) => sourcesOf(passages).filter(s => (reply || "").includes(`[${s.tag}]`));
const SourcesList = ({ sources, color = "#2563eb", border = "#bfdbfe" }) => (sources && sources.length ? (
  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${border}`, whiteSpace: "normal" }}>
    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color, marginBottom: 6 }}>SOURCES</div>
    {sources.map(s => (
      <div key={s.tag} title={s.snippet} style={{ fontSize: 12, color: "var(--t2)", marginBottom: 3, lineHeight: 1.5 }}>
        <b style={{ color }}>[{s.tag}]</b> {s.label}
      </div>
    ))}
  </div>
) : null);
const LearnScreen = ({ subject, onUpdate, initialId, initialMode, apiKey, onGoToEval }) => {
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
  const [quizSource,setQuizSource]=useState("lecture");      // point 11: where quiz questions come from
  const [quizSetup,setQuizSetup]=useState(false);
  const [quizUsedSource,setQuizUsedSource]=useState("general");
  const [sessionStart,setSessionStart]=useState(Date.now()); // point 14: chat saved before this visit = "earlier conversation"
  const [noted,setNoted]=useState(null);                     // point 14: mistakes noted after a quiz
  const [quizReview,setQuizReview]=useState([]);             // point 16: which quiz questions checked an earlier mix-up
  const [quizPersonalised,setQuizPersonalised]=useState(false);
  const [revisionMode,setRevisionMode]=useState(false);       // point 17: this quiz is a revision
  const [revisionResult,setRevisionResult]=useState("");
  const [keyNote,setKeyNote]=useState(null);
  const [quizError,setQuizError]=useState("");               // point 20: why the quiz could not be made                 // point 19: quiz answer keys checked against the lecture
  const subjRef=useRef(subject); subjRef.current=subject;    // newest subject, for saves that finish after a Claude call
  const commit=(updated)=>{ subjRef.current=updated; onUpdate(updated); };
  const bottomRef=useRef();
  const msgContainerRef=useRef();
  const stat=isStatic(subject);  // TA point 21: Static mode — same for every learner, no suggestions or reminders
  const ready=stat?[]:graphEngine.getReadyConcepts(graph,mastery);
  const due=dueList(subject); // point 17 (always empty in Static mode)
  const all=Object.values(graph.nodes);

  // TA point 20: one shared caller — counts tokens, respects the budget, retries when busy, shows Claude's real error
  const callClaude=makeCaller(apiKey);

  const updateMastery=(id,val)=>{ onUpdate({...subject,mastery:{...subject.mastery,[id]:val}}); };
  const updateGraph=(newGraph)=>{ onUpdate({...subject,graph:newGraph}); };

  useEffect(()=>{if(initialId){ if(initialMode==="revise") startRevision(initialId); else startLearning(initialId); }},[]);
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
    setSessionStart(Date.now());setNoted(null);
    setDocCollapsed(false);setKbCollapsed(false);
    setSourcesReady(false);
    const prevPct=(subject.readProgress||{})[id]||0;
    setScrollPct(prevPct);
    scrollPctRef.current=prevPct;
    // Don't auto-generate — wait for user to select sources
    setLoading(false);
    return;
  };

  // TA point 20: which saved explanation (if any) matches the current source choice
  const savedFor=(id)=>{
    const c=graph.nodes[id]; if(!c) return null;
    const docIds=conceptDocIds(c);
    const hasDocs=(subject.docs||[]).some(d=>docIds.includes(d.id));
    const wantDoc=sourceChoice.doc&&hasDocs, wantKb=sourceChoice.kb||!wantDoc;
    return getSaved(subject,id,choiceKey(wantDoc,wantKb),docIds);
  };
  const generateExplanation=async(opts={})=>{
    const c=graph.nodes[cId];if(!c) return;
    const fresh=opts===true||opts?.fresh===true;
    setMessages([]);setLoading(true);setSourcesReady(true);
    commit(noteStudied(subjRef.current,cId)); // point 14: remember each study visit
    try{
      // TA point 11: each choice works on its own — Document only / Knowledge base only / Both
      const docNames=(subject.docs||[]).filter(d=>conceptDocIds(c).includes(d.id)).map(d=>d.name);
      const hasDocs=docNames.length>0;
      const wantDoc=sourceChoice.doc&&hasDocs;
      const wantKb=sourceChoice.kb||!wantDoc;   // "Document only" but no document → general knowledge, with a note
      const out=[];
      let docMsgId=null, docCheck=null;
      // TA point 16: a personal note ("For you" + quick recap of weak prerequisites) is prepared alongside the explanation
      const notePromise=personalNote(callClaude,subjRef.current,cId,{useLecture:wantDoc}).catch(e=>({error:e.message}));
      const personalOf=(note)=>{
        const personal=[];
        if(note?.recap?.length) personal.push({role:"recap",items:note.recap,sources:note.recapSources});
        if(note?.forYou?.length) personal.push({role:"foryou",items:note.forYou,covers:note.covers,sources:note.forYouSources});
        if(note?.error) personal.push({role:"ai",note:true,content:`(Could not personalise this explanation: ${note.error})`});
        return personal;
      };
      // TA point 20: a saved explanation for this choice → shown at no AI cost (only the "For you" note is made fresh)
      const key=choiceKey(wantDoc,wantKb), docIds=conceptDocIds(c);
      const saved=!fresh&&getSaved(subjRef.current,cId,key,docIds);
      if(saved){
        const items=saved.items.map(m=>({...m}));
        const info={role:"saved-info",at:saved.at};
        setMessages([info,{role:"loading-personal",content:""},...items]);
        const note=await notePromise;
        setMessages([info,...personalOf(note),...items]);
        setLoading(false);
        return;
      }
      if(sourceChoice.doc&&!hasDocs) out.push({role:"ai",note:true,content:"No uploaded document contains this concept, so this explanation uses general knowledge."});
      if(wantDoc){
        setMessages([...out,{role:"loading-doc",content:""}]);
        // RAG: find the best passages for this concept in ALL its documents (not just the first 8,000 characters)
        const {passages}=await retrieve(subject,c,{k:5,maxChars:6000});
        if(passages.length){
          const docReply=await callClaude(
            "You are an AI tutor. Explain using ONLY what the lecture passages say. You may use simpler words, but do not add any fact, example, comparison, number or claim that the passages do not state, and do not make anything sound stronger than the passages do. After each sentence, cite the passage it came from, like [S1]. If the passages do not explain the concept, say so. "+LECTURE_GUARD,
            `Concept: "${c.name}" — ${c.definition}

Lecture passages:
${passagesForPrompt(passages)}

Explain what the lecture says about "${c.name}".`,
            1500
          );
          // TA point 19: every sentence is checked BEFORE the learner sees it; only lecture-supported sentences are shown
          docMsgId=`doc_${Date.now()}`;
          docCheck={passages,raw:docReply,docName:docNames.join(", "),
            promise:filterToLecture(callClaude,docReply,passages).then(f=>({f}),e=>({error:e.message}))};
          out.push({role:"loading-check",id:docMsgId,content:""});
          setMessages([...out]);
        } else {
          out.push({role:"doc",content:`No passage in your lecture matches "${c.name}".`,docName:docNames.join(", "),sources:[]});
        }
      }
      if(wantKb){
        setMessages([...out,{role:"loading-kb",content:""}]);
        const kbReply=await callClaude(
          `You are an expert AI tutor for "${subject.name}". Explain concepts clearly with examples and analogies. Use line breaks for readability.`,
          `Teach me: "${c.name}"
Definition: ${c.definition}
Subject: ${subject.name}

Give a clear explanation with a practical real-world example.`,
          2000
        );
        out.push({role:"kb",content:kbReply});
      }
      if(docCheck){
        setMessages([...out]);
        const r=await docCheck.promise;
        const base={role:"doc",id:docMsgId,docName:docCheck.docName};
        let msg;
        if(r.error) msg={...base,content:docCheck.raw,sources:citedSources(docCheck.passages,docCheck.raw),check:{status:"failed",strict:true,error:r.error}};
        else if(!r.f) msg={...base,content:docCheck.raw,sources:citedSources(docCheck.passages,docCheck.raw)};
        else if(!r.f.kept) msg={...base,content:`Your lecture pages do not say enough about "${c.name}" to explain it. Tick 🧠 From Knowledge Base for a general explanation.`,sources:[],check:{status:"done",filtered:r.f}};
        else msg={...base,content:r.f.text,sources:citedSources(docCheck.passages,r.f.text),check:{status:"done",filtered:r.f}};
        out[out.findIndex(x=>x.id===docMsgId)]=msg;
        if(r.f) commit(logFaith(subjRef.current,groundingEntry(cId,"explanation",r.f))); // left-out sentences go to the Faithfulness CSV only
      }
      commit(saveExplanation(subjRef.current,cId,key,docIds,out)); // point 20: next time this is shown without AI cost
      setMessages([{role:"loading-personal",content:""},...out]);
      const note=await notePromise;
      setMessages([...personalOf(note),...out]);
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
      // TA point 11: answer from the lecture first (RAG), cite pages, label anything beyond the lecture
      const {passages}=c?await retrieve(subject,c,{question:userMsg,k:4,maxChars:4500}):{passages:[]};
      // TA point 16: the conversation so far + (when personalisation is on) what is known about this learner
      const ctx=chatContext(subjRef.current,cId,messages);
      const head=(ctx.known?`What you know about this learner:\n${ctx.known}\n\n`:"")+(ctx.convo?`Conversation so far:\n${ctx.convo}\n\n`:"");
      const reply=await callClaude(
        tutorAnswerSystem(subject.name,c?.name)+CHAT_PERSONAL_RULE+" "+LECTURE_GUARD,
        head+(passages.length
          ? `Lecture passages:\n${passagesForPrompt(passages)}\n\nLearner's question: ${userMsg}`
          : `No lecture passages match this question.\n\nLearner's question: ${userMsg}`),
        1000
      );
      const sources=citedSources(passages,reply);
      const msgId=Date.now();
      setMessages(m=>[...m,{role:"ai",content:reply,sources,id:msgId}]);
      if(passages.length) runCheck(msgId,reply,passages,"chat"); // point 19: is the answer supported by the lecture?
      commit(addChatMessages(subjRef.current,cId,[{role:"user",content:userMsg},{role:"ai",content:reply,sources}])); // point 14: chat is remembered
      checkChat(userMsg,msgId); // point 15: does the question show a misunderstanding?
    }catch(e){
      setMessages(m=>[...m,{role:"ai",content:"Error: "+e.message}]);
      commit(addChatMessages(subjRef.current,cId,[{role:"user",content:userMsg}])); // the question is still remembered
    }
    setLoading(false);
  };

  // TA point 11: the learner chooses where quiz questions come from, then the quiz is generated
  const startQuiz=()=>{ setPhase("quiz"); setQuiz(null); setQuizSetup(true); setNoted(null); setQuizReview([]); setRevisionMode(false); setRevisionResult(""); };
  // TA point 17: a short revision quiz on one concept — 3 questions aimed at its weak spots
  const startRevision=(id)=>{
    const c=graph.nodes[id]; if(!c) return;
    setCId(id); setMessages([]); setSessionStart(Date.now()); setSourcesReady(false);
    setPhase("quiz"); setQuiz(null); setQuizSetup(false); setNoted(null); setQuizReview([]); setRevisionMode(true); setRevisionResult("");
    generateQuiz({id, revision:true});
  };

  // TA points 14–15: after a quiz, name the wrong idea behind wrong answers, and let right answers fix open mistakes
  // (runs after the score is shown)
  const noteAnswers=async(wrong,right,at)=>{
    const known=getMemory(subjRef.current,cId).mistakes;
    if(!wrong.length && !(right.length && known.some(k=>k.status!=="fixed"))){ setNoted(null); return; }
    setNoted({status:"working"});
    try{
      const res=await analyseAnswers(callClaude,graph.nodes[cId],{wrong,right},known);
      const r=applyAnalysis(subjRef.current,cId,wrong,res,at);
      commit(r.subject);
      let items=r.noted;
      // many open mistakes on one concept → group the ones that share the same underlying idea
      try{ const g=await autoGroup(callClaude,subjRef.current,cId,graph.nodes[cId]); if(g){ commit(g.subject); items=remapNoted(g.subject,cId,items,g.map); } }catch{ /* keep them ungrouped */ }
      setNoted({status:"done",items,fixed:r.fixed,progress:r.progress,hadWrong:wrong.length>0});
    }catch(e){ setNoted({status:"failed",error:e.message}); }
  };
  // "🧩 Group similar mistakes" button in the memory box
  const groupNow=async()=>{
    const open=getMemory(subjRef.current,cId).mistakes.filter(x=>x.status!=="fixed");
    const groups=await groupMistakes(callClaude,graph.nodes[cId],open);
    commit(applyGrouping(subjRef.current,cId,groups).subject);
  };
  // TA point 19: the judge checks each statement against the lecture pages it cites
  const runCheck=async(msgId,text,passages,kind)=>{
    const set=(check)=>setMessages(m=>m.map(x=>x.id===msgId?{...x,check}:x));
    set({status:"working"});
    try{
      const g=await checkGrounding(callClaude,text,passages);
      if(!g){ set(null); return; }
      set({status:"done",result:g});
      commit(logFaith(subjRef.current,groundingEntry(cId,kind,g)));
    }catch(e){ set({status:"failed",error:e.message}); }
  };
  // TA point 15: a chat question can show a misunderstanding too — noted under the reply
  const checkChat=async(question,msgId)=>{
    try{
      const res=await checkChatQuestion(callClaude,graph.nodes[cId],question,getMemory(subjRef.current,cId).mistakes);
      const r=applyChatCheck(subjRef.current,cId,question,res);
      if(r.noted){ commit(r.subject); setMessages(m=>m.map(x=>x.id===msgId?{...x,noted:r.noted}:x)); }
    }catch{ /* the chat itself still works; nothing is noted for this question */ }
  };
  // TA point 20: if Claude fails, say why (instead of an empty quiz) and offer "Try again"
  const lastQuizOpts=useRef({});
  const generateQuiz=async(opts={})=>{
    lastQuizOpts.current=opts; setQuizError("");
    try{ await makeQuiz(opts); }
    catch(e){ setQuiz([]); setQuizError(e.message); setLoading(false); }
  };
  const makeQuiz=async(opts={})=>{
    setQuizSetup(false); setLoading(true); setQuiz(null);
    const id=opts.id||cId, revision=!!opts.revision;
    const c=graph.nodes[id];
    const hasDocs=!!c&&(subject.docs||[]).some(d=>conceptDocIds(c).includes(d.id));
    let source=(revision||quizSource==="lecture")&&hasDocs?"lecture":"general";
    let lecture="", quizPassages=[];
    setKeyNote(null);
    if(source==="lecture"){
      const {passages}=await retrieve(subject,c,{k:5,maxChars:5000});
      quizPassages=passages;
      if(passages.length) lecture=passagesForPrompt(passages); else source="general";
    }
    // TA point 16: up to 2 of the 3 questions aim at the learner's open mistakes (when personalisation is on)
    const tb=revision?revisionTargets(subjRef.current,id):targetBlock(subjRef.current,id,2,"mcq"); // point 17: revision aims at weak spots
    const raw=await callClaude(
      `Generate 3 MCQ questions. Return ONLY JSON:\n{"questions":[{"q":"Question?","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"Why correct"}]}\n${LECTURE_GUARD}`,
      (source==="lecture"
        ? `Create 3 ${revision?"revision ":""}quiz questions about: ${c?.name} — ${c?.definition} (Subject: ${subject.name}).\nEvery question must be about "${c?.name}" and answerable from these lecture passages only. Ignore any passage that is not about "${c?.name}".\n\n${lecture}`
        : `Create 3 ${revision?"revision ":""}quiz questions about: ${c?.name} — ${c?.definition} (Subject: ${subject.name})`)+tb.text
    );
    const parsed=exJSON(raw);
    let qs=resolveTargets(parsed?.questions||[],tb.targets);
    // TA point 19: check every answer key against the lecture before the quiz is shown
    if(source==="lecture"&&qs.length){
      try{
        const kc=await checkAnswerKeys(callClaude,qs,quizPassages);
        qs=kc.questions; setKeyNote(kc);
        if(!kc.failed) commit(logFaith(subjRef.current,{conceptId:id,kind:"quiz-keys",questionsChecked:kc.checked,corrected:kc.corrected,removed:kc.removed}));
      }catch{ setKeyNote({failed:true}); }
    }
    setQuiz(qs);setQuizUsedSource(source);setQuizPersonalised(isPersonalised(subjRef.current));setLoading(false);
  };

  const QuizComp=()=>{
    const [sel,setSel]=useState({});
    const [done,setDone]=useState(false);
    if(!quiz) return <div className="loading"><div className="spin"/><span>Generating quiz...</span></div>;
    if(quizError) return <AiErrorBox message={quizError} what="make the quiz" onRetry={()=>generateQuiz(lastQuizOpts.current)}/>;
    const submit=()=>{
      setDone(true);
      const correct=quiz.filter((q,i)=>sel[i]===q.correct).length;
      const pct=Math.round((correct/quiz.length)*100);
      setScore(pct);
      // TA point 8: update mastery after EACH answer (BKT), and save every answer
      const old=subject.mastery[cId]||0;
      const {mastery:nw, steps}=applyAnswers(old, quiz.map((q,i)=>({correct:sel[i]===q.correct, type:"mcq"})));
      const at=Date.now();
      const screen=revisionMode?"revision":"study";
      const log=steps.map((s,i)=>({conceptId:cId, question:quiz[i].q, picked:quiz[i].options?.[sel[i]], correct:s.correct, type:"mcq", screen, questionSource:quizUsedSource, personalised:quizPersonalised, studyMode:quizPersonalised?"adaptive":"static", targetedMistake:quiz[i].targetText||"", at, masteryBefore:s.masteryBefore, masteryAfter:s.masteryAfter}));
      setQuizReview(quiz.map((q,i)=>({n:i+1,targetText:q.targetText,correct:sel[i]===q.correct})).filter(x=>x.targetText));
      const newMastery={...subject.mastery,[cId]:nw};
      const newGraph={...subject.graph,nodes:{...subject.graph.nodes,[cId]:{...subject.graph.nodes[cId],state:nw>=MASTERY_THRESHOLD?"MASTERED":"LEARNING"}}};
      // point 17: every quiz moves the revision schedule (passed → longer gap, failed → back tomorrow)
      const updated=scheduleAfterQuiz({...subjRef.current,mastery:newMastery,graph:newGraph,answerLog:[...(subjRef.current.answerLog||[]),...log]},cId,{at,pct,screen});
      commit(updated);
      const sch=getSchedule(updated,cId);
      setRevisionResult(revisionMode
        ? (sch.lastResult==="passed"?"📅 Revision passed.":"📅 Revision not passed — it will come back tomorrow.")
        : "");
      setTimeout(()=>setPhase("result"),900);
      // points 14–15: wrong answers → mistakes to remember; right answers → can fix open mistakes
      const asItem=({q,i})=>({question:q.q, answer:q.options?.[sel[i]]||"", correct:q.options?.[q.correct]||"", explanation:q.explanation, screen, targetId:q.targetId});
      const all=quiz.map((q,i)=>({q,i}));
      noteAnswers(all.filter(({q,i})=>sel[i]!==q.correct).map(asItem), all.filter(({q,i})=>sel[i]===q.correct).map(asItem), at);
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
          {/* TA point 17: concepts due for revision, most urgent first */}
          {due.length>0&&<>
            <div className="f ac g12 mb8">
              <div className="card-label" style={{margin:0,color:"#0369a1"}}>📅 DUE FOR REVISION</div>
              <div style={{fontSize:11,color:"#0369a1",fontFamily:"var(--mono)",padding:"3px 10px",background:"#f0f9ff",borderRadius:20,border:"1px solid #bae6fd"}}>short review quizzes on your weak spots</div>
            </div>
            <div className="gauto mb24 due-list">
              {due.map(d=>(
                <div key={d.id} className="cc" style={{borderColor:"#bae6fd",background:"#f8fcff"}}>
                  <div className="f jb ac mb8"><div className="cc-name">{d.name}</div><div className="tag" style={{background:"#e0f2fe",color:"#0369a1",borderColor:"#7dd3fc",fontSize:9}}>{d.overdueDays>0?`${d.overdueDays}D OVERDUE`:"DUE"}</div></div>
                  {d.reasons.slice(0,2).map((r,i)=><div key={i} className="cc-def" style={{marginBottom:2}}>• {r}</div>)}
                  <button className="btn btn-primary btn-sm mt8" onClick={()=>startRevision(d.id)}>Revise →</button>
                </div>
              ))}
            </div>
          </>}
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
              <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",padding:"3px 10px",background:"var(--s3)",borderRadius:20}}>{stat?"every concept, in course order — the same for every learner":"every concept from your lectures"}</div>
            </div>
          <div className="gauto mb24">
            {all.filter(c=>stat||(mastery[c.id]||0)<MASTERY_THRESHOLD).map(c=>{
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
          {!stat&&all.filter(c=>(mastery[c.id]||0)>=MASTERY_THRESHOLD).length>0&&(
            <div className="mb24">
              <div className="f ac g12 mb8">
                <div className="card-label" style={{margin:0,color:"#16a34a"}}>✅ COMPLETED</div>
                <div style={{fontSize:11,color:"#16a34a",fontFamily:"var(--mono)",padding:"3px 10px",background:"#f0fdf4",borderRadius:20,border:"1px solid #86efac"}}>mastery ≥ {MASTERY_THRESHOLD}%</div>
              </div>
              <div className="gauto">
                {all.filter(c=>(mastery[c.id]||0)>=MASTERY_THRESHOLD).map(c=>{
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
          {nextRevisionLabel(subject,cId)&&<div className="f ac g8 mt8 concept-revision">
            <span className="txs tm" style={{color:"#0369a1"}}>📅 {nextRevisionLabel(subject,cId)}</span>
            <button className="btn btn-secondary btn-xs" onClick={()=>startRevision(cId)}>Revise now</button>
          </div>}
        </div>
        <div className="f ac g8">
          <StudyModeTag subject={subject}/>
          <div style={{padding:"6px 14px",borderRadius:20,background:"var(--s3)",border:"1px solid var(--b1)"}}>
            <div className="txs tm" style={{color:ME.getLevel(subject.mastery[cId]||0).color,fontWeight:700}}>{ME.getLevel(subject.mastery[cId]||0).label}</div>
          </div>
        </div>
      </div>
      {phase==="explain"&&(
        <div style={{maxWidth:"100%"}}>
          {/* TA point 14: what Learnova remembers about this learner on this concept */}
          {!stat&&<MemoryBox subject={subject} cId={cId} onChange={commit} onGroup={groupNow}/>}
          {!stat&&<EarlierChat subject={subject} cId={cId} since={sessionStart} onChange={commit}/>}
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
                onClick={()=>generateExplanation()}
                disabled={!sourceChoice.doc&&!sourceChoice.kb}>
                {savedFor(cId)?"📌 Show saved explanation":"⚡ Generate Explanation"}
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
            // TA point 20: saved explanation — no AI cost; "Generate new" makes a fresh one
            if(m.role==="saved-info") return (
              <div key={i} className="saved-info fade f ac g8" style={{marginBottom:14,padding:"8px 12px",borderRadius:8,background:"#f8fafc",border:"1px solid var(--b1)",fontSize:12,color:"var(--t3)",fontFamily:"var(--mono)",flexWrap:"wrap"}}>
                <span>📌 Saved explanation from {new Date(m.at).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})} · no AI cost</span>
                <button className="btn btn-ghost btn-xs generate-new" disabled={loading} onClick={()=>generateExplanation({fresh:true})}>🔄 Generate new</button>
              </div>
            );
            if(m.role==="loading-check") return (
              <div key={i} className="loading fade"><div className="spin"/><span>🔎 Checking against your lecture…</span></div>
            );
            if(m.role==="loading-kb") return (
              <div key={i} className="loading fade"><div className="spin"/><span>Generating knowledge base answer...</span></div>
            );
            // TA point 16: personal note
            if(m.role==="loading-personal") return (
              <div key={i} className="loading fade"><div className="spin"/><span>Personalising for you...</span></div>
            );
            if(m.role==="recap") return <RecapBox key={i} items={m.items} sources={m.sources}/>;
            if(m.role==="foryou") return <ForYouBox key={i} items={m.items} covers={m.covers} sources={m.sources}/>;
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
                    <SourcesList sources={m.sources}/>
                    <FaithBadge check={m.check}/>
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
                  <SourcesList sources={m.sources}/>
                  {!stat&&<ChatNoted noted={m.noted}/>}
                  <FaithBadge check={m.check}/>
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
          {quizSetup?(()=>{
            const cNode=graph.nodes[cId];
            const hasDocs=!!cNode&&(subject.docs||[]).some(d=>conceptDocIds(cNode).includes(d.id));
            const choice=hasDocs?quizSource:"general";
            const opt=(id,icon,title,sub,color,bg,disabled)=>(
              <div key={id} onClick={()=>!disabled&&setQuizSource(id)}
                style={{flex:1,padding:"14px 16px",borderRadius:12,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,
                  border:`2px solid ${choice===id?color:"var(--b1)"}`,background:choice===id?bg:"#fff"}}>
                <div style={{fontSize:13,fontWeight:700,color:choice===id?color:"var(--t2)"}}>{icon} {title}</div>
                <div className="txs t3 tm" style={{marginTop:4}}>{sub}</div>
              </div>
            );
            return (
              <div className="card fade">
                <div className="card-label mb12">WHERE SHOULD THE QUESTIONS COME FROM?</div>
                <div className="f g12 mb16">
                  {opt("lecture","📄","From my lecture","Questions based on your uploaded lecture","#2563eb","#eff6ff",!hasDocs)}
                  {opt("general","🧠","From general knowledge","Questions written from the concept itself","#ff6f61","#fff5f4",false)}
                </div>
                {!hasDocs&&<div className="txs t3 tm mb12">No uploaded document contains this concept, so questions will use general knowledge.</div>}
                <button className="btn btn-primary" onClick={generateQuiz}>Start Quiz →</button>
              </div>
            );
          })():loading?<div className="loading"><div className="spin"/><span>Evaluation in progress — generating questions...</span></div>:<><KeyCheckNote note={keyNote}/><QuizComp/></>}
        </div>
      )}
      {phase==="result"&&(
        <div className="fade" style={{textAlign:"center",padding:"48px 20px"}}>
          <div className="score-big">{score}%</div>
          <div style={{fontSize:20,fontWeight:800,marginBottom:8,marginTop:12,color:"var(--t1)"}}>{score>=80?"Excellent work! 🎉":score>=60?"Good effort! 📚":"Keep practising! 💪"}</div>
          <div className="ts t3 mb24 tm">Updated mastery: <span style={{color:ME.getLevel(subject.mastery[cId]||0).color,fontWeight:700}}>{subject.mastery[cId]||0}%</span>{" · "}{(subject.mastery[cId]||0)>=MASTERY_THRESHOLD?"Concept Mastered ✓":"Needs more practice"}</div>
          {revisionResult&&<div className="revision-result ts" style={{color:"#0369a1",fontWeight:700,marginTop:-12,marginBottom:8}}>{revisionResult}</div>}
          <div className="next-revision txs t3 tm">{nextRevisionLabel(subject,cId)}</div>
          {!stat&&<NotedLine noted={noted}/>}
          {!stat&&<TargetedReview items={quizReview}/>}
          <div className="mb24"/>
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
