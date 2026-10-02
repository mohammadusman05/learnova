import React, { useState, useEffect, useRef } from 'react';
import { ME, exJSON } from './utils.js';
const AttemptHistory = ({ attempts }) => {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="card mb20" style={{background:"#f8fafc"}}>
      <div className="card-label">ATTEMPT HISTORY · click to review answers</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[...attempts].reverse().map((a,ri) => {
          const i = attempts.length - 1 - ri;
          const isOpen = expanded === a.id;
          return (
            <div key={a.id}>
              <div onClick={()=>setExpanded(isOpen?null:a.id)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",borderRadius:10,cursor:"pointer",
                  background:a.passed?"#f0fdf4":"#fef2f2",
                  border:`1px solid ${a.passed?"#86efac":"#fecaca"}`,
                  transition:"all 0.15s"}}>
                <div>
                  <div className="ts fw7" style={{color:a.passed?"#16a34a":"#dc2626"}}>
                    Attempt {i+1}: {a.score}% {a.passed?"✅ PASS":"❌ FAIL"}
                  </div>
                  <div className="txs t3 tm">{new Date(a.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"})} · {a.totalQs} questions · {a.config?.difficulty||""} {a.config?.type||""}</div>
                </div>
                <div style={{fontSize:14,color:a.passed?"#16a34a":"#dc2626",fontWeight:700}}>{isOpen?"▲":"▼"}</div>
              </div>
              {isOpen && (
                <div style={{marginTop:4,padding:"12px",background:"#fff",borderRadius:10,border:"1px solid var(--b1)"}}>
                  {a.results?.map((r,qi)=>(
                    <div key={qi} style={{marginBottom:12,paddingBottom:12,borderBottom:qi<a.results.length-1?"1px solid var(--b1)":"none"}}>
                      <div className="f ac jb mb8">
                        <div className="ts fw7 t2">Q{qi+1}: {r.q}</div>
                        <div className="tag" style={{background:r.isCorrect?"#f0fdf4":"#fef2f2",color:r.isCorrect?"#16a34a":"#dc2626",borderColor:r.isCorrect?"#86efac":"#fecaca",flexShrink:0,marginLeft:8}}>
                          {r.isCorrect?"✓ Correct":"✗ Wrong"}
                        </div>
                      </div>
                      <div className="f g8 mb4">
                        <div style={{flex:1,padding:"6px 10px",borderRadius:6,background:"#f0f9ff",border:"1px solid #bae6fd"}}>
                          <div style={{fontSize:9,color:"#0369a1",fontFamily:"var(--mono)",fontWeight:700,marginBottom:2}}>YOUR ANSWER</div>
                          <div className="txs t2">{r.userAnswer||"Not answered"}</div>
                        </div>
                        {!r.isCorrect&&(
                          <div style={{flex:1,padding:"6px 10px",borderRadius:6,background:"#f0fdf4",border:"1px solid #86efac"}}>
                            <div style={{fontSize:9,color:"#16a34a",fontFamily:"var(--mono)",fontWeight:700,marginBottom:2}}>CORRECT ANSWER</div>
                            <div className="txs t2">{r.correctAnswer}</div>
                          </div>
                        )}
                      </div>
                      {r.feedback&&<div className="txs t3 tm" style={{padding:"4px 8px",background:"#fffbeb",borderRadius:6,border:"1px solid #fde68a"}}>💡 {r.feedback}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ============================================================
// ...
// ============================================================
const EvalScreen = ({ subject, onUpdate, apiKey, initialConceptId, onClearConcept }) => {
  const {graph, mastery} = subject;
  const allConcepts = Object.values(graph.nodes);
  // ...
  const readProgress = subject.readProgress || {};
  const concepts = allConcepts.filter(c => (readProgress[c.id]||0) >= 80);
  // phase: select | config | quiz | results
  const [phase, setPhase] = useState(initialConceptId ? "config" : "select");
  const [selectedConcept, setSelectedConcept] = useState(initialConceptId || null);
  const [config, setConfig] = useState({ type:"mcq", difficulty:"medium", mcqCount:10, descCount:3 });
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // ...
  useEffect(()=>{
    if(initialConceptId){ setSelectedConcept(initialConceptId); setPhase("config"); }
  },[initialConceptId]);

  const callClaude = async (sys, usr, mt=3000) => {
    const res = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:mt,system:sys,messages:[{role:"user",content:usr}]})
    });
    const d = await res.json(); return d.content?.[0]?.text || "";
  };

  const concept = selectedConcept ? graph.nodes[selectedConcept] : null;

  // ── GENERATE QUIZ ──
  const generateQuiz = async () => {
    setLoading(true); setPhase("quiz"); setAnswers({});
    const c = concept;
    const diffMap = {easy:"simple and foundational",medium:"moderately challenging",hard:"advanced and analytical"};
    const diffStr = diffMap[config.difficulty];

    let qs = [];

    // MCQ questions
    if(config.type === "mcq" || config.type === "combo") {
      const n = config.mcqCount;
      const raw = await callClaude(
        `Generate exactly ${n} multiple choice questions. Return ONLY valid JSON:
{"questions":[{"q":"Question?","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"Why A is correct"}]}`,
        `Generate ${n} ${diffStr} MCQ questions about: "${c.name}" — ${c.definition}
Subject: ${subject.name}
Difficulty: ${config.difficulty}`
      , 4000);
      const parsed = exJSON(raw);
      if(parsed?.questions) {
        parsed.questions.slice(0,n).forEach((q,i) => qs.push({...q, id:`mcq_${i}`, type:"mcq"}));
      }
    }

    // Descriptive questions
    if(config.type === "desc" || config.type === "combo") {
      const n = config.descCount;
      const raw = await callClaude(
        `Generate exactly ${n} descriptive/short-answer questions. Return ONLY valid JSON:
{"questions":[{"q":"Question requiring a written explanation?","sampleAnswer":"A thorough sample answer","keyPoints":["key point 1","key point 2"]}]}`,
        `Generate ${n} ${diffStr} descriptive questions about: "${c.name}" — ${c.definition}
Subject: ${subject.name}
Difficulty: ${config.difficulty}`
      , 3000);
      const parsed = exJSON(raw);
      if(parsed?.questions) {
        parsed.questions.slice(0,n).forEach((q,i) => qs.push({...q, id:`desc_${i}`, type:"desc"}));
      }
    }

    setQuestions(qs);
    setLoading(false);
  };

  // ── SUBMIT & GRADE ──
  const submitQuiz = async () => {
    setLoading(true);
    const c = concept;
    let gradedResults = [];

    // Grade MCQ instantly
    const mcqQs = questions.filter(q => q.type === "mcq");
    mcqQs.forEach(q => {
      const userAns = answers[q.id];
      const correct = userAns === q.correct;
      gradedResults.push({
        ...q,
        userAnswer: userAns !== undefined ? q.options[userAns] : "Not answered",
        correctAnswer: q.options[q.correct],
        isCorrect: correct,
        points: correct ? 1 : 0,
        feedback: q.explanation,
      });
    });

    // ...
    const descQs = questions.filter(q => q.type === "desc");
    if(descQs.length > 0) {
      const gradingInput = descQs.map((q,i) => ({
        id: q.id,
        question: q.q,
        sampleAnswer: q.sampleAnswer,
        keyPoints: q.keyPoints,
        studentAnswer: answers[q.id] || ""
      }));

      const raw = await callClaude(
        `You are grading descriptive answers. For each question, determine if student's answer is correct (1 point) or incorrect (0 points) based on whether it covers the key points. Return ONLY valid JSON:
{"grades":[{"id":"desc_0","isCorrect":true,"points":1,"feedback":"Why correct or incorrect","correctAnswer":"What a good answer looks like"}]}`,
        `Grade these answers:
${JSON.stringify(gradingInput)}`
      , 3000);

      const parsed = exJSON(raw);
      if(parsed?.grades) {
        parsed.grades.forEach(grade => {
          const q = descQs.find(dq => dq.id === grade.id);
          if(q) gradedResults.push({
            ...q,
            userAnswer: answers[q.id] || "Not answered",
            correctAnswer: grade.correctAnswer || q.sampleAnswer,
            isCorrect: grade.isCorrect,
            points: grade.points || 0,
            feedback: grade.feedback,
          });
        });
      } else {
        // Fallback if parsing fails
        descQs.forEach(q => {
          gradedResults.push({...q, userAnswer: answers[q.id]||"", correctAnswer: q.sampleAnswer, isCorrect:false, points:0, feedback:"Could not grade automatically."});
        });
      }
    }

    // Calculate score
    const totalPoints = gradedResults.reduce((a,r) => a+r.points, 0);
    const totalQs = gradedResults.length;
    const pct = totalQs > 0 ? Math.round((totalPoints/totalQs)*100) : 0;
    const passed = pct >= 75;

    // Build attempt record
    const attempt = {
      id: `attempt_${Date.now()}`,
      date: Date.now(),
      score: pct,
      passed,
      totalPoints,
      totalQs,
      config: {...config},
      results: gradedResults,
    };

    // ...
    const existing = subject.evalHistory || {};
    const conceptHistory = existing[selectedConcept] || [];
    const newHistory = [...conceptHistory, attempt];

    let newMastery = {...subject.mastery};
    let newGraph = {...subject.graph};
    if(passed) {
      newMastery[selectedConcept] = Math.max(newMastery[selectedConcept]||0, pct);
      newGraph = {...newGraph, nodes:{...newGraph.nodes,[selectedConcept]:{...newGraph.nodes[selectedConcept],state:"MASTERED"}}};
    }

    onUpdate({...subject, mastery:newMastery, graph:newGraph, evalHistory:{...existing,[selectedConcept]:newHistory}});
    setResults({...attempt});
    setPhase("results");
    setLoading(false);
  };

  const resetToSelect = () => {
    setPhase("select"); setSelectedConcept(null); setQuestions([]); setAnswers({}); setResults(null);
    if(onClearConcept) onClearConcept();
  };

  const goRetake = () => {
    setPhase("config"); setQuestions([]); setAnswers({}); setResults(null);
  };

  // ────────────────────────────────────────────
  // PHASE: SELECT CONCEPT
  // ────────────────────────────────────────────
  if(phase === "select") return (
    <div className="fade">
      <div className="section-title">Evaluation</div>
      <div className="section-sub">Select a concept to be evaluated on</div>
      {concepts.length === 0
        ? <div className="empty">
            <div className="empty-icon">📖</div>
            <div style={{fontSize:14,color:"var(--t3)",marginBottom:8}}>No concepts ready for evaluation yet</div>
            <div className="ts t4 tm">Go to Study → read a concept to 80% → Take Quiz to unlock evaluation</div>
          </div>
        : <div className="gauto">
          {concepts.map(c => {
            const score = mastery[c.id]||0;
            const {color,label,bg,border} = ME.getLevel(score);
            const history = (subject.evalHistory||{})[c.id]||[];
            const lastAttempt = history[history.length-1];
            const aTag = lastAttempt
              ? lastAttempt.passed
                ? {txt:"PASSED",bg:"#f0fdf4",color:"#16a34a",border:"#86efac"}
                : {txt:"ATTEMPTED",bg:"#fff5f4",color:"#e8503f",border:"#ffb3ad"}
              : {txt:"NOT STARTED",bg,color,border};
            return (
              <div key={c.id} className="cc" onClick={()=>{setSelectedConcept(c.id);setPhase("config");}}>
                <div className="f jb ac mb8">
                  <div className="cc-name">{c.name}</div>
                  <div className="tag" style={{background:aTag.bg,color:aTag.color,borderColor:aTag.border,fontSize:9}}>{aTag.txt}</div>
                </div>
                <div className="cc-def mb8">{c.definition}</div>
                {lastAttempt && (
                  <div className="f ac g8" style={{marginTop:8,padding:"6px 10px",borderRadius:8,background:lastAttempt.passed?"#f0fdf4":"#fef2f2",border:`1px solid ${lastAttempt.passed?"#86efac":"#fecaca"}`}}>
                    <span style={{fontSize:12}}>{lastAttempt.passed?"✅":"❌"}</span>
                    <span className="txs tm" style={{color:lastAttempt.passed?"#16a34a":"#dc2626"}}>
                      Last: {lastAttempt.score}% · {history.length} attempt{history.length!==1?"s":""}
                    </span>
                  </div>
                )}
                <div className="mbar mt8"><div className="mfill" style={{width:`${score}%`,background:color}}/></div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );

  // ────────────────────────────────────────────
  // PHASE: CONFIG
  // ────────────────────────────────────────────
  if(phase === "config") return (
    <div className="fade">
      <div className="f ac g12 mb8">
        <button className="btn btn-ghost btn-sm" onClick={resetToSelect}>← Back</button>
        <div className="tag tag-coral">{subject.emoji} {subject.name}</div>
      </div>
      <div className="section-title">Configure Quiz</div>
      <div className="section-sub">{concept?.name} · {concept?.definition}</div>

      {/* Previous attempts — expandable */}
      {((subject.evalHistory||{})[selectedConcept]||[]).length > 0 && (
        <AttemptHistory attempts={(subject.evalHistory||{})[selectedConcept]||[]} />
      )}

      <div className="g2">
        <div className="card">
          <div className="card-label">QUESTION TYPE</div>
          {[{id:"mcq",label:"MCQ",desc:"Multiple choice questions",icon:"☑️"},
            {id:"desc",label:"Descriptive",desc:"Written answer questions",icon:"✍️"},
            {id:"combo",label:"Combination",desc:"MCQ + Descriptive",icon:"🔀"}
          ].map(t => (
            <div key={t.id} onClick={()=>setConfig(c=>({...c,type:t.id}))}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:8,
                border:`1.5px solid ${config.type===t.id?"#ff6f61":"var(--b1)"}`,
                background:config.type===t.id?"#fff5f4":"#fff",transition:"all 0.15s"}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:config.type===t.id?"#e8503f":"var(--t1)"}}>{t.label}</div>
                <div className="txs t3">{t.desc}</div>
              </div>
              {config.type===t.id && <div style={{marginLeft:"auto",color:"#ff6f61",fontWeight:700}}>✓</div>}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-label">DIFFICULTY</div>
          <div className="f g8 mb20">
            {[{id:"easy",label:"Easy",color:"#16a34a"},{id:"medium",label:"Medium",color:"#d97706"},{id:"hard",label:"Hard",color:"#dc2626"}].map(d => (
              <div key={d.id} onClick={()=>setConfig(c=>({...c,difficulty:d.id}))}
                style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",textAlign:"center",
                  border:`1.5px solid ${config.difficulty===d.id?d.color:"var(--b1)"}`,
                  background:config.difficulty===d.id?`${d.color}10`:"#fff",transition:"all 0.15s"}}>
                <div style={{fontSize:13,fontWeight:700,color:config.difficulty===d.id?d.color:"var(--t2)"}}>{d.label}</div>
              </div>
            ))}
          </div>

          {/* MCQ count */}
          {(config.type==="mcq"||config.type==="combo") && (
            <div className="mb16">
              <div className="card-label">NUMBER OF MCQ QUESTIONS</div>
              <div className="f g8">
                {[5,10,15,20].map(n => (
                  <div key={n} onClick={()=>setConfig(c=>({...c,mcqCount:n}))}
                    style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,
                      border:`1.5px solid ${config.mcqCount===n?"#ff6f61":"var(--b1)"}`,
                      background:config.mcqCount===n?"#fff5f4":"#fff",color:config.mcqCount===n?"#e8503f":"var(--t2)",transition:"all 0.15s"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descriptive count */}
          {(config.type==="desc"||config.type==="combo") && (
            <div className="mb16">
              <div className="card-label">NUMBER OF DESCRIPTIVE QUESTIONS</div>
              <div className="f g8">
                {[1,2,3,4,5].map(n => (
                  <div key={n} onClick={()=>setConfig(c=>({...c,descCount:n}))}
                    style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,
                      border:`1.5px solid ${config.descCount===n?"#ff6f61":"var(--b1)"}`,
                      background:config.descCount===n?"#fff5f4":"#fff",color:config.descCount===n?"#e8503f":"var(--t2)",transition:"all 0.15s"}}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt16">
        <button className="btn btn-primary btn-lg" onClick={generateQuiz}>
          🚀 Start Quiz
        </button>
        <span className="txs t3 tm" style={{marginLeft:16}}>
          {config.type==="mcq"?`${config.mcqCount} MCQ`:config.type==="desc"?`${config.descCount} Descriptive`:`${config.mcqCount} MCQ + ${config.descCount} Descriptive`}
          {" · "}{config.difficulty} difficulty
        </span>
      </div>
    </div>
  );

  // ────────────────────────────────────────────
  // PHASE: QUIZ
  // ────────────────────────────────────────────
  if(phase === "quiz") {
    const mcqQs = questions.filter(q=>q.type==="mcq");
    const descQs = questions.filter(q=>q.type==="desc");
    const totalAnswered = Object.keys(answers).length;
    const totalQs = questions.length;

    return (
      <div className="fade">
        <div className="f ac jb mb20">
          <div>
            <div className="f ac g12 mb4">
              <div className="tag tag-coral">{concept?.name}</div>
              <div className="tag" style={{background:"var(--s3)",color:"var(--t3)",borderColor:"var(--b1)"}}>{config.difficulty.toUpperCase()}</div>
            </div>
            <div className="section-title">Quiz</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#ff6f61"}}>{totalAnswered}/{totalQs}</div>
            <div className="txs t3 tm">answered</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{height:4,background:"var(--b1)",borderRadius:2,overflow:"hidden",marginBottom:24}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#ff6f61,#16a34a)",borderRadius:2,transition:"width 0.3s",width:`${totalQs>0?(totalAnswered/totalQs)*100:0}%`}}/>
        </div>

        {loading ? (
          <div className="loading"><div className="spin"/><span>Evaluation in progress — generating questions...</span></div>
        ) : (
          <>
            {/* MCQ Section */}
            {mcqQs.length>0 && (
              <>
                <div className="card-label mb12">☑️ MULTIPLE CHOICE QUESTIONS</div>
                {mcqQs.map((q,qi)=>(
                  <div key={q.id} className="card mb16">
                    <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"var(--t1)"}}>
                      Q{qi+1}: {q.q}
                    </div>
                    {q.options.map((opt,oi)=>(
                      <div key={oi} className={`qopt ${answers[q.id]===oi?"sel":""}`}
                        onClick={()=>setAnswers(a=>({...a,[q.id]:oi}))}>
                        {opt}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}

            {/* Descriptive Section */}
            {descQs.length>0 && (
              <>
                <div className="card-label mb12" style={{marginTop:mcqQs.length?24:0}}>✍️ DESCRIPTIVE QUESTIONS</div>
                {descQs.map((q,qi)=>(
                  <div key={q.id} className="card mb16">
                    <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:"var(--t1)"}}>
                      Q{mcqQs.length+qi+1}: {q.q}
                    </div>
                    <textarea className="input-full" rows={4}
                      placeholder="Write your answer here..."
                      value={answers[q.id]||""}
                      onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}/>
                    {q.keyPoints&&(
                      <div className="txs t3 mt8 tm">💡 Hint: cover — {q.keyPoints.join(" · ")}</div>
                    )}
                  </div>
                ))}
              </>
            )}

            <button className="btn btn-primary btn-lg" onClick={submitQuiz}
              disabled={totalAnswered<totalQs||loading}>
              {loading?"Evaluation in progress — grading your answers...":"Submit & Get Results →"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────
  // PHASE: RESULTS
  // ────────────────────────────────────────────
  if(phase === "results" && results) {
    const passed = results.passed;
    return (
      <div className="fade">
        {/* Score banner */}
        <div style={{textAlign:"center",padding:"32px 20px",marginBottom:24,borderRadius:16,
          background:passed?"linear-gradient(135deg,#f0fdf4,#dcfce7)":"linear-gradient(135deg,#fef2f2,#fee2e2)",
          border:`1px solid ${passed?"#86efac":"#fecaca"}`}}>
          <div style={{fontSize:64,fontWeight:900,letterSpacing:"-3px",color:passed?"#16a34a":"#dc2626"}}>{results.score}%</div>
          <div style={{fontSize:22,fontWeight:800,marginBottom:8,color:passed?"#16a34a":"#dc2626"}}>
            {passed?"✅ PASSED":"❌ FAILED"}
          </div>
          <div className="ts t3 mb16">{results.totalPoints} / {results.totalQs} correct · {concept?.name}</div>
          {passed
            ? <div style={{fontSize:13,color:"#16a34a",fontFamily:"var(--mono)"}}>Concept marked as Mastered! Great work 🎉</div>
            : <div style={{fontSize:13,color:"#dc2626",fontFamily:"var(--mono)"}}>Score 75% or above to pass. Review the topic and retake.</div>
          }
        </div>

        {/* Action buttons */}
        <div className="f g12 mb24">
          {!passed&&<button className="btn btn-primary" onClick={goRetake}>🔄 Retake Quiz</button>}
          <button className="btn btn-secondary" onClick={resetToSelect}>← All Concepts</button>
        </div>

        {/* Per-question breakdown */}
        <div className="card-label mb12">📋 QUESTION BREAKDOWN</div>
        {results.results.map((r,i)=>(
          <div key={i} className="card mb12" style={{borderLeft:`4px solid ${r.isCorrect?"#16a34a":"#dc2626"}`}}>
            <div className="f ac jb mb12">
              <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--t3)",fontWeight:700}}>
                {r.type==="mcq"?"MCQ":"DESCRIPTIVE"} · Q{i+1}
              </div>
              <div className="tag" style={{background:r.isCorrect?"#f0fdf4":"#fef2f2",color:r.isCorrect?"#16a34a":"#dc2626",borderColor:r.isCorrect?"#86efac":"#fecaca"}}>
                {r.isCorrect?"✓ Correct":"✗ Wrong"} · {r.points} pt
              </div>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:12,color:"var(--t1)"}}>{r.q}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{padding:"10px 14px",borderRadius:8,background:"#f0f9ff",border:"1px solid #bae6fd"}}>
                <div style={{fontSize:9,letterSpacing:"1.5px",color:"#0369a1",fontFamily:"var(--mono)",fontWeight:700,marginBottom:4}}>YOUR ANSWER</div>
                <div style={{fontSize:13,color:"var(--t2)"}}>{r.userAnswer||"Not answered"}</div>
              </div>
              <div style={{padding:"10px 14px",borderRadius:8,background:"#f0fdf4",border:"1px solid #86efac"}}>
                <div style={{fontSize:9,letterSpacing:"1.5px",color:"#16a34a",fontFamily:"var(--mono)",fontWeight:700,marginBottom:4}}>CORRECT ANSWER</div>
                <div style={{fontSize:13,color:"var(--t2)"}}>{r.correctAnswer}</div>
              </div>
            </div>
            <div style={{padding:"10px 14px",borderRadius:8,background:"#fffbeb",border:"1px solid #fde68a"}}>
              <div style={{fontSize:9,letterSpacing:"1.5px",color:"#d97706",fontFamily:"var(--mono)",fontWeight:700,marginBottom:4}}>💡 EXPLANATION</div>
              <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.6}}>{r.feedback}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};


// ── StorageBar component ──
export default EvalScreen;
