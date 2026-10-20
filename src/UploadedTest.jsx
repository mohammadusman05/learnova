import React, { useState } from 'react';
import { getTest, getPostTest, removePostTest, canEditTest, setTest, readTestFile, templateCsv, attemptsFor, nextKind, nextSet, setOf, makePaper, gradeAttempt, testSummary, normalisedGain } from './testSet.js';

// ============================================================
// TA point 23 — the faculty's uploaded test, at the top of Evaluation (all learning modes)
// 1st attempt = pre-test (score only), 2nd = post-test (score, gain and answers), later = retake.
// Set A is used for the pre-test; an optional Set B for the post-test and retakes (else Set A again).
// Upload / replace only in a subject you created yourself; locked in a subject imported from a shared file.
// ============================================================
const KIND = { pre: "Pre-test", post: "Post-test", retake: "Retake" };
const fmtDay = (t) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const gainText = (g) => g === null ? "n/a (the pre-test was already 100%)" : `${g.toFixed(2)} — you closed ${Math.round(g * 100)}% of the gap to 100%`;
const save = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const Review = ({ test, attempt }) => {
  const byId = Object.fromEntries(test.questions.map(q => [q.id, q]));
  const L = "ABCD";
  return (
    <div className="test-review" style={{ marginTop: 14 }}>
      {attempt.answers.map((a, i) => {
        const q = byId[a.qid]; if (!q) return null;
        return (
          <div key={a.qid} className="card mb8" style={{ padding: "10px 14px", borderColor: a.correct ? "#bbf7d0" : "#fecaca", background: a.correct ? "#f7fef9" : "#fffafa" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{a.correct ? "✅" : "❌"} {i + 1}. {q.q}</div>
            <div className="txs t2">Your answer: {a.picked === null ? "—" : `${L[a.picked]}) ${q.options[a.picked]}`}</div>
            {!a.correct && <div className="txs" style={{ color: "#15803d" }}>Correct: {L[q.correct]}) {q.options[q.correct]}</div>}
            {q.explanation && <div className="txs t3" style={{ marginTop: 4 }}>{q.explanation}</div>}
          </div>
        );
      })}
    </div>
  );
};

const UploadedTest = ({ subject, onUpdate, onActive }) => {
  const test = getTest(subject), post = getPostTest(subject);
  const editable = canEditTest(subject);
  const [paper, setPaper] = useState(null);          // taking the test
  const [paperSet, setPaperSet] = useState(null);    // the question set of this paper (A or B)
  const [picks, setPicks] = useState({});
  const [startedAt, setStartedAt] = useState(0);
  const [result, setResult] = useState(null);        // the attempt just finished
  const [msg, setMsg] = useState(null);
  const [replace, setReplace] = useState(null);      // a parsed Set A waiting for "replace?" confirmation
  const [showAnswers, setShowAnswers] = useState(false);
  const fileRef = React.useRef(null), postRef = React.useRef(null);
  const sum = testSummary(subject);
  const attempts = attemptsFor(subject);
  const active = (v) => onActive && onActive(v);

  const upload = (slot) => async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setMsg(null);
    try {
      const r = await readTestFile(f);
      if (slot === "pre" && test && attempts.length) setReplace(r); else apply(r, slot);
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  const apply = (r, slot = "pre") => {
    onUpdate(setTest(subject, r, Date.now(), slot));
    setReplace(null);
    const sk = r.skipped.length ? ` · ${r.skipped.length} row${r.skipped.length !== 1 ? "s" : ""} skipped: ${r.skipped.slice(0, 3).map(x => `row ${x.row} (${x.reason})`).join(", ")}${r.skipped.length > 3 ? "…" : ""}` : "";
    setMsg({ ok: true, text: `${slot === "post" ? "Post-test set (B)" : "Pre-test set (A)"}: uploaded "${r.name}" — ${r.questions.length} question${r.questions.length !== 1 ? "s" : ""}${sk}` });
  };
  const template = async () => {
    try {
      const { default: url } = await import("./learnova-test-template.xlsx?url");
      const a = document.createElement("a"); a.href = url; a.download = "learnova-test-template.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
    } catch { save(new Blob(["﻿" + templateCsv()], { type: "text/csv;charset=utf-8" }), "learnova-test-template.csv"); }
  };
  const start = () => { const set = nextSet(subject); setPaperSet(set); setPaper(makePaper(set)); setPicks({}); setStartedAt(Date.now()); setResult(null); setShowAnswers(false); active(true); };
  const submit = () => {
    const g = gradeAttempt(subject, paper, picks, startedAt, Date.now());
    onUpdate(g.subject);
    setResult(g.attempt); setPaper(null);
  };
  const done = () => { setResult(null); setPaper(null); active(false); };

  // ── taking the test ──
  if (paper) {
    const answered = paper.filter(p => picks[p.qid] !== undefined).length;
    const kind = nextKind(subject);
    return (
      <div className="fade uploaded-test-taking">
        <div className="f ac jb mb16" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="tag tag-coral mb8">📋 {KIND[kind]}</div>
            <div className="section-title" style={{ marginBottom: 2 }}>{paperSet?.name || test.name}{post ? ` (Set ${paperSet?.id === post.id ? "B" : "A"})` : ""}</div>
            <div className="txs t3">The same questions for every learner · no AI · your mastery is not changed</div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 800, color: "#ff6f61" }}>{answered}/{paper.length}</div><div className="txs t3 tm">answered</div></div>
        </div>
        {paper.map((p, i) => (
          <div key={p.qid} className="card mb16 test-q">
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>{i + 1}. {p.q}</div>
            {p.options.map((o, oi) => (
              <div key={oi} className={`qopt ${picks[p.qid] === oi ? "sel" : ""}`} onClick={() => setPicks(x => ({ ...x, [p.qid]: oi }))}>{"ABCD"[oi]}) {o}</div>
            ))}
          </div>
        ))}
        <div className="f g12 ac" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary submit-test" disabled={answered < paper.length} onClick={submit}>Submit test</button>
          <button className="btn btn-ghost" onClick={done}>Cancel</button>
          {answered < paper.length && <span className="txs t3">Answer all {paper.length} questions to submit.</span>}
        </div>
      </div>
    );
  }

  // ── just finished ──
  if (result) {
    const isPre = result.kind === "pre";
    return (
      <div className="fade uploaded-test-result card" style={{ padding: 20 }}>
        <div className="card-label">📋 {KIND[result.kind].toUpperCase()} DONE</div>
        <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0" }}>{result.score}% <span className="txs t3" style={{ fontWeight: 500 }}>({result.correct} of {result.total})</span></div>
        {isPre ? (
          <div className="txs t2" style={{ lineHeight: 1.8 }}>
            Answers are not shown yet. Now study this subject; afterwards, take the test again — that attempt is your <b>post-test</b>.
            {result.preBeforeStudy === false && <div className="pre-warning" style={{ marginTop: 6, color: "#b45309" }}>⚠ You studied this subject before this pre-test, so it won't count in the comparison.</div>}
          </div>
        ) : (
          <>
            {result.kind === "post" && (
              <div className="test-gain" style={{ padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontSize: 14, lineHeight: 1.7 }}>
                Pre-test {sum.pre}% → Post-test {sum.post}% · <b>Normalised gain {gainText(normalisedGain(sum.pre, sum.post))}</b>
              </div>
            )}
            {setOf(subject, result) && <Review test={setOf(subject, result)} attempt={result} />}
          </>
        )}
        <button className="btn btn-secondary btn-sm mt16 test-back" onClick={done}>← Back to Evaluation</button>
      </div>
    );
  }

  // ── the card at the top of Evaluation ──
  const kind = test ? nextKind(subject) : null;
  return (
    <div className="card mb24 uploaded-test" style={{ padding: 18, borderColor: "#c7d2fe", background: "#fafbff" }}>
      <div className="f ac jb" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="card-label" style={{ margin: 0, color: "#4338ca" }}>📋 UPLOADED TEST (SAME FOR EVERYONE)</div>
        {editable && <button className="btn btn-ghost btn-xs test-template" onClick={template}>⬇ Excel template</button>}
        <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: "none" }} onChange={upload("pre")} />
        <input ref={postRef} type="file" accept=".xlsx,.csv,.xls" style={{ display: "none" }} onChange={upload("post")} />
      </div>
      {!test && (
        <div className="txs t2 test-info" style={{ marginTop: 8, lineHeight: 1.8 }}>
          {editable ? "No test yet. Upload the faculty's questions as an Excel (.xlsx) or CSV file — one row per question: Question, Option A–D, Correct." : "No test in this subject yet — your faculty adds it to the shared subject file."}
          {editable && <div style={{ marginTop: 6 }}><button className="btn btn-secondary btn-xs upload-test" onClick={() => fileRef.current?.click()}>⬆ Upload pre-test questions (Set A)</button></div>}
        </div>
      )}
      {test && (
        <div className="test-sets txs t2" style={{ marginTop: 8, lineHeight: 1.9 }}>
          <div className="f ac g8 test-info" style={{ flexWrap: "wrap" }}>
            <span style={{ minWidth: 175 }}><b>Pre-test questions (Set A):</b></span>
            <span><b>{test.name}</b> · {test.questions.length} question{test.questions.length !== 1 ? "s" : ""} · uploaded {fmtDay(test.uploadedAt)}</span>
            {editable && <button className="btn btn-ghost btn-xs upload-test" onClick={() => fileRef.current?.click()}>⬆ Replace</button>}
          </div>
          <div className="f ac g8 test-info-post" style={{ flexWrap: "wrap" }}>
            <span style={{ minWidth: 175 }}><b>Post-test questions (Set B):</b></span>
            {post
              ? <span><b>{post.name}</b> · {post.questions.length} question{post.questions.length !== 1 ? "s" : ""} · uploaded {fmtDay(post.uploadedAt)}</span>
              : <span className="t3">{editable ? "optional — if empty, Set A is used again" : "the same questions as the pre-test"}</span>}
            {editable && <button className="btn btn-ghost btn-xs upload-post" onClick={() => postRef.current?.click()}>⬆ {post ? "Replace" : "Upload"}</button>}
            {editable && post && <button className="btn btn-ghost btn-xs remove-post" onClick={() => { onUpdate(removePostTest(subject)); setMsg({ ok: true, text: "Post-test set removed — the post-test will use Set A again." }); }}>✕ Remove</button>}
          </div>
        </div>
      )}
      {replace && (
        <div className="replace-confirm" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13 }}>
          Replace the pre-test questions (Set A) with "{replace.name}" ({replace.questions.length} questions)? Earlier results stay saved, but the new set starts a new pre-test.
          <div className="f g8" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-xs confirm-replace" onClick={() => apply(replace)}>Yes, replace</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setReplace(null)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <div className="test-msg txs" style={{ marginTop: 8, color: msg.ok ? "#15803d" : "#b91c1c" }}>{msg.ok ? "✅ " : "⚠ "}{msg.text}</div>}
      {test && (
        <div className="f ac g12" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm start-test" onClick={start}>▶ {kind === "pre" ? "Start pre-test" : kind === "post" ? "Start post-test" : "Retake test"}</button>
          <span className="txs t3 test-status" style={{ lineHeight: 1.7 }}>
            {kind === "pre" && "Your first attempt counts as your pre-test — take it before you start studying this subject."}
            {kind === "post" && <>Pre-test: <b>{sum.pre}%</b> ({fmtDay(attempts[0].finishedAt)}). Study the subject, then take the test again — that attempt is your post-test.</>}
            {kind === "retake" && <>Pre {sum.pre}% → Post {sum.post}% · gain <b>{sum.gain === null ? "n/a" : sum.gain.toFixed(2)}</b></>}
          </span>
          {kind === "retake" && <span className="txs show-answers" style={{ cursor: "pointer", textDecoration: "underline", color: "var(--t3)" }} onClick={() => setShowAnswers(v => !v)}>{showAnswers ? "Hide" : "Show"} post-test answers</span>}
        </div>
      )}
      {test && kind === "retake" && showAnswers && setOf(subject, attempts[1]) && <Review test={setOf(subject, attempts[1])} attempt={attempts[1]} />}
    </div>
  );
};
export default UploadedTest;
