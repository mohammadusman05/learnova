import React, { useState, useEffect, useRef } from 'react';
import { ME, exJSON, MASTERY_THRESHOLD, applyAnswers } from './utils.js';
import { conceptDocIds } from './conceptExtraction.js';
import { retrieve, passagesForPrompt } from './retrieval.js';
import { getMemory, analyseAnswers, applyAnalysis, autoGroup, remapNoted } from './learnerMemory.js';
import { NotedLine, StudyModeTag, TargetTag } from './MemoryBox.jsx';
import { isAdaptive } from './studyMode.js';
import { isPersonalised, targetBlock, resolveTargets } from './personalise.js';
import { scheduleAfterQuiz } from './revision.js';
import { LECTURE_GUARD } from './privacy.js';
import { checkAnswerKeys, logFaith } from './faithfulness.js';
import { KeyCheckNote } from './FaithBadge.jsx';
import { makeCaller } from './claudeApi.js';
import { AiErrorBox } from './AiStatus.jsx';
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
  const [config, setConfig] = useState({ type:"mcq", difficulty:"medium", mcqCount:10, descCount:3, source:"lecture" });
  const [usedSource, setUsedSource] = useState("general"); // point 11: where this quiz's questions actually came from
  const [usedPersonalised, setUsedPersonalised] = useState(false); // point 16: was this quiz personalised
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [noted, setNoted] = useState(null);
  const [genError, setGenError] = useState(""); // point 20: why the questions could not be made
  const [keyNote, setKeyNote] = useState(null); // point 19: MCQ answer keys checked against the lecture                       // point 14: mistakes noted after an evaluation
  const subjRef = useRef(subject); subjRef.current = subject;     // newest subject, for saves that finish after a Claude call
  const commit = (updated) => { subjRef.current = updated; onUpdate(updated); };

  // ...
  useEffect(()=>{
    if(initialConceptId){ setSelectedConcept(initialConceptId); setPhase("config"); }
  },[initialConceptId]);

  // TA point 20: one shared caller — counts tokens, respects the budget, retries when busy, shows Claude's real error
  const callClaude = makeCaller(apiKey, { defaultMaxTokens: 3000 });

  const concept = selectedConcept ? graph.nodes[selectedConcept] : null;

  // ── GENERATE QUIZ ──
  // TA point 20: if Claude fails, say why (instead of an empty quiz) and offer "Try again"
  const generateQuiz = async () => {
    setGenError("");
    try { await makeEvalQuiz(); }
    catch (e) { setQuestions([]); setGenError(e.message); setLoading(false); }
  };
  const makeEvalQuiz = async () => {
    setLoading(true); setPhase("quiz"); setAnswers({});
    const c = concept;
    const diffMap = {easy:"simple and foundational",medium:"moderately challenging",hard:"advanced and analytical"};
    const diffStr = diffMap[config.difficulty];

    // TA point 11: questions from the lecture (RAG passages) or from general knowledge
    const hasDocs = !!c && (subject.docs||[]).some(d => conceptDocIds(c).includes(d.id));
    let source = config.source==="lecture" && hasDocs ? "lecture" : "general";
    let lectureBlock = "", lecturePassages = [];
    setKeyNote(null);
    if(source==="lecture"){
      const { passages } = await retrieve(subject, c, { k:6, maxChars:6000 });
      lecturePassages = passages;
      if(passages.length) lectureBlock = `\n\nEvery question must be about "${c.name}" and answerable from these lecture passages only. Ignore any passage that is not about "${c.name}".\n\n${passagesForPrompt(passages)}`;
      else source = "general";
    }
    setUsedSource(source);
    // TA point 16: up to 3 questions aim at the learner's open mistakes (when personalisation is on)
    const wantMcq = config.type === "mcq" || config.type === "combo";
    const tb = targetBlock(subjRef.current, c.id, 3, wantMcq ? "mcq" : "desc");
    setUsedPersonalised(isPersonalised(subjRef.current));

    let qs = [];

    // MCQ questions
    if(config.type === "mcq" || config.type === "combo") {
      const n = config.mcqCount;
      const raw = await callClaude(
        `Generate exactly ${n} multiple choice questions. Return ONLY valid JSON:
{"questions":[{"q":"Question?","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"Why A is correct"}]}
${LECTURE_GUARD}`,
        `Generate ${n} ${diffStr} MCQ questions about: "${c.name}" — ${c.definition}
Subject: ${subject.name}
Difficulty: ${config.difficulty}${lectureBlock}${tb.text}`
      , 4000);
      const parsed = exJSON(raw);
      if(parsed?.questions) {
        resolveTargets(parsed.questions.slice(0,n), tb.targets).forEach((q,i) => qs.push({...q, id:`mcq_${i}`, type:"mcq"}));
      }
    }

    // Descriptive questions
    if(config.type === "desc" || config.type === "combo") {
      const n = config.descCount;
      const raw = await callClaude(
        `Generate exactly ${n} descriptive/short-answer questions. Return ONLY valid JSON:
{"questions":[{"q":"Question requiring a written explanation?","sampleAnswer":"A thorough sample answer","keyPoints":["key point 1","key point 2"]}]}
${LECTURE_GUARD}`,
        `Generate ${n} ${diffStr} descriptive questions about: "${c.name}" — ${c.definition}
Subject: ${subject.name}
Difficulty: ${config.difficulty}${lectureBlock}${wantMcq ? "" : tb.text}`
      , 3000);
      const parsed = exJSON(raw);
      if(parsed?.questions) {
        (wantMcq ? parsed.questions.slice(0,n) : resolveTargets(parsed.questions.slice(0,n), tb.targets)).forEach((q,i) => qs.push({...q, id:`desc_${i}`, type:"desc"}));
      }
    }

    // TA point 19: check the MCQ answer keys against the lecture before the quiz is shown
    if (source === "lecture" && qs.some(q => q.type === "mcq")) {
      try {
        const mcqs = qs.filter(q => q.type === "mcq");
        const kc = await checkAnswerKeys(callClaude, mcqs, lecturePassages);
        const keep = new Set(kc.questions.map(q => q.id));
        const fixed = Object.fromEntries(kc.questions.map(q => [q.id, q]));
        qs = qs.filter(q => q.type !== "mcq" || keep.has(q.id)).map(q => q.type === "mcq" ? fixed[q.id] : q);
        setKeyNote(kc);
        if (!kc.failed) commit(logFaith(subjRef.current, { conceptId: c.id, kind: "quiz-keys", questionsChecked: kc.checked, corrected: kc.corrected, removed: kc.removed }));
      } catch { setKeyNote({ failed: true }); }
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

      let raw = "", gradeError = "";
      try { raw = await callClaude(
        `You are grading descriptive answers. For each question, determine if student's answer is correct (1 point) or incorrect (0 points) based on whether it covers the key points. Return ONLY valid JSON:
{"grades":[{"id":"desc_0","isCorrect":true,"points":1,"feedback":"Why correct or incorrect","correctAnswer":"What a good answer looks like"}]}`,
        `Grade these answers:
${JSON.stringify(gradingInput)}`
      , 3000); } catch (e) { gradeError = e.message; }   // point 20: marking failed → answers shown as not marked, with the reason

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
          gradedResults.push({...q, userAnswer: answers[q.id]||"", correctAnswer: q.sampleAnswer, isCorrect:false, points:0, feedback:gradeError?`Could not grade automatically: ${gradeError}`:"Could not grade automatically.", ungraded:true});
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

    // TA point 8: every graded answer updates mastery (BKT), pass or fail — mastery can go down.
    // Answers the grader could not mark are skipped, so a grading failure never counts against the learner.
    const graded = gradedResults.filter(r => !r.ungraded);
    const old = subject.mastery[selectedConcept] || 0;
    const { mastery: nw, steps } = applyAnswers(old, graded.map(r => ({ correct: !!r.isCorrect, type: r.type === "desc" ? "desc" : "mcq" })));
    const at = Date.now();
    const log = steps.map((s, i) => ({ conceptId: selectedConcept, question: graded[i].q, picked: graded[i].userAnswer, correct: s.correct, type: s.type, screen: "evaluation", questionSource: usedSource, personalised: usedPersonalised, studyMode: usedPersonalised ? "adaptive" : "static", targetedMistake: graded[i].targetText || "", at, masteryBefore: s.masteryBefore, masteryAfter: s.masteryAfter }));
    const newMastery = {...subject.mastery, [selectedConcept]: nw};
    const newGraph = {...subject.graph, nodes:{...subject.graph.nodes,[selectedConcept]:{...subject.graph.nodes[selectedConcept],state: nw>=MASTERY_THRESHOLD?"MASTERED":"LEARNING"}}};

    // point 17: an evaluation also moves the revision schedule
    commit(scheduleAfterQuiz({...subject, mastery:newMastery, graph:newGraph, evalHistory:{...existing,[selectedConcept]:newHistory}, answerLog:[...(subject.answerLog||[]), ...log]}, selectedConcept, { at, pct, screen: "evaluation" }));
    setResults({...attempt});
    setPhase("results");
    setLoading(false);

    // TA points 14–15: wrong answers → mistakes to remember; right answers → can fix open mistakes (after the results are shown)
    const asItem = r => ({ question: r.q, answer: r.userAnswer, correct: r.correctAnswer || "", explanation: r.feedback || "", screen: "evaluation", targetId: r.targetId });
    const wrong = graded.filter(r => !r.isCorrect && r.userAnswer && r.userAnswer !== "Not answered").map(asItem);
    const right = graded.filter(r => r.isCorrect).map(asItem);
    const cIdNow = selectedConcept;
    const known = getMemory(subjRef.current, cIdNow).mistakes;
    if (!wrong.length && !(right.length && known.some(k => k.status !== "fixed"))) { setNoted(null); return; }
    setNoted({ status: "working" });
    try {
      const res = await analyseAnswers(callClaude, c, { wrong, right }, known);
      const r = applyAnalysis(subjRef.current, cIdNow, wrong, res, at);
      commit(r.subject);
      let items = r.noted;
      // many open mistakes on one concept → group the ones that share the same underlying idea
      try { const g = await autoGroup(callClaude, subjRef.current, cIdNow, c); if (g) { commit(g.subject); items = remapNoted(g.subject, cIdNow, items, g.map); } } catch { /* keep them ungrouped */ }
      setNoted({ status: "done", items, fixed: r.fixed, progress: r.progress, hadWrong: wrong.length > 0 });
    } catch (e) { setNoted({ status: "failed", error: e.message }); }
  };

  const resetToSelect = () => {
    setPhase("select"); setSelectedConcept(null); setQuestions([]); setAnswers({}); setResults(null); setNoted(null);
    if(onClearConcept) onClearConcept();
  };

  const goRetake = () => {
    setPhase("config"); setQuestions([]); setAnswers({}); setResults(null); setNoted(null);
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
          {(() => {
            const hasDocs = !!concept && (subject.docs||[]).some(d => conceptDocIds(concept).includes(d.id));
            const choice = hasDocs ? config.source : "general";
            return (
              <div className="mb16">
                <div className="f ac jb mb8" style={{gap:8,flexWrap:"wrap"}}>
                  <div className="txs t3 tm">Personalised questions aim at your open mistakes.</div>
                  <StudyModeTag subject={subject}/>
                </div>
                <div className="card-label">QUESTION SOURCE</div>
                <div className="f g8">
                  {[{id:"lecture",label:"📄 From my lecture",color:"#2563eb",disabled:!hasDocs},{id:"general",label:"🧠 From general knowledge",color:"#ff6f61",disabled:false}].map(s => (
                    <div key={s.id} onClick={()=>!s.disabled&&setConfig(c=>({...c,source:s.id}))}
                      style={{flex:1,padding:"12px",borderRadius:10,cursor:s.disabled?"not-allowed":"pointer",textAlign:"center",opacity:s.disabled?0.5:1,
                        border:`1.5px solid ${choice===s.id?s.color:"var(--b1)"}`,
                        background:choice===s.id?`${s.color}10`:"#fff",transition:"all 0.15s"}}>
                      <div style={{fontSize:13,fontWeight:700,color:choice===s.id?s.color:"var(--t2)"}}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {!hasDocs && <div className="txs t3 tm" style={{marginTop:6}}>No uploaded document contains this concept, so questions will use general knowledge.</div>}
              </div>
            );
          })()}
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
          {" · "}{config.source==="lecture"&&concept&&(subject.docs||[]).some(d=>conceptDocIds(concept).includes(d.id))?"from your lecture":"from general knowledge"}
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
        ) : genError ? (
          <AiErrorBox message={genError} what="make the evaluation questions" onRetry={generateQuiz}/>
        ) : (
          <>
            <KeyCheckNote note={keyNote}/>
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
            ? ((subject.mastery[selectedConcept]||0) >= MASTERY_THRESHOLD   // Mastered only when BKT mastery reaches 95% (point 8)
                ? <div style={{fontSize:13,color:"#16a34a",fontFamily:"var(--mono)"}}>Concept Mastered ({subject.mastery[selectedConcept]}%)! Great work 🎉</div>
                : <div style={{fontSize:13,color:"#16a34a",fontFamily:"var(--mono)"}}>Passed — mastery now {subject.mastery[selectedConcept]||0}%. Keep practising to reach {MASTERY_THRESHOLD}% (Mastered).</div>)
            : <div style={{fontSize:13,color:"#dc2626",fontFamily:"var(--mono)"}}>Score 75% or above to pass. Review the topic and retake.</div>
          }
          {isAdaptive(subject)&&<NotedLine noted={noted}/>}
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
            <TargetTag text={r.targetText}/>
          </div>
        ))}
      </div>
    );
  }

  return null;
};


// ── StorageBar component ──
export default EvalScreen;
