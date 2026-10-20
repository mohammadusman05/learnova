import React, { useState } from 'react';
import { getMemory, studyHistory, removeQuestion, removeMistake, clearChat, memorySummary, RECURRING, FIX_AFTER } from './learnerMemory.js';
import { isPersonalised, setPersonalised } from './personalise.js';

// ============================================================
// TA points 14–15 — "What Learnova remembers" box and the earlier conversation, shown on each concept
// ============================================================
const day = (t) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const X = ({ onClick, title }) => (
  <button className="btn btn-ghost btn-xs" title={title} onClick={onClick}
    style={{ padding: "0 6px", minWidth: 0, color: "var(--t4)", fontSize: 12, lineHeight: "18px" }}>✕</button>
);
const Row = ({ label, children }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 8 }}>
    <div style={{ width: 150, flexShrink: 0, fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1px", color: "var(--t3)", paddingTop: 3 }}>{label}</div>
    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{children}</div>
  </div>
);

export const MemoryBox = ({ subject, cId, onChange, onGroup }) => {
  const [open, setOpen] = useState(true);
  const [grouping, setGrouping] = useState("");
  const [allQs, setAllQs] = useState(false);
  const [showUse, setShowUse] = useState(false);
  const m = getMemory(subject, cId);
  const hist = studyHistory(subject, cId);
  const openList = m.mistakes.filter(x => x.status !== "fixed");
  const recurring = openList.filter(x => x.count >= RECURRING).sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);
  const once = openList.filter(x => x.count < RECURRING).sort((a, b) => b.lastSeen - a.lastSeen);
  const fixed = m.mistakes.filter(x => x.status === "fixed").sort((a, b) => (b.fixedAt || 0) - (a.fixedAt || 0));
  const use = memorySummary(subject, cId).text;   // point 15: only what is relevant to this concept
  const progress = (x) => x.corrections > 0 ? <span className="t4" style={{ fontSize: 11 }}> · {x.corrections} of {FIX_AFTER} correct answers towards fixed</span> : null;
  const back = (x) => x.reopenedAt ? <span className="t4" style={{ fontSize: 11 }}> · back again {day(x.reopenedAt)}</span> : null;
  const qs = m.questions.map((q, i) => ({ ...q, i })).reverse();
  const shownQs = allQs ? qs : qs.slice(0, 5);
  const nothing = !m.studied.length && !hist.length && !m.questions.length && !m.mistakes.length;
  const summary = [m.studied.length ? `studied ${m.studied.length}×` : "", hist.length ? `${hist.length} quiz${hist.length !== 1 ? "zes" : ""}` : "",
    m.questions.length ? `${m.questions.length} question${m.questions.length !== 1 ? "s" : ""}` : "", openList.length ? `${openList.length} open mistake${openList.length !== 1 ? "s" : ""}` : "",
    fixed.length ? `${fixed.length} fixed` : ""].filter(Boolean).join(" · ");

  return (
    <div className="card mb20 memory-box" style={{ padding: "14px 18px", borderColor: "#ddd6fe", background: "#faf8ff" }}>
      <div className="f ac jb" style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setOpen(o => !o)}>
        <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "#7c3aed" }}>🧠 WHAT LEARNOVA REMEMBERS</div>
        <div className="txs t3 tm">{!open && summary ? `${summary}  ` : ""}{open ? "▼" : "▶"}</div>
      </div>
      {open && (nothing
        ? <div className="txs t3 tm" style={{ marginTop: 8 }}>Nothing yet — your questions, quiz results and mistakes on this concept will appear here.</div>
        : <>
          <Row label="HISTORY">
            {m.studied.length ? `Studied ${m.studied.length} time${m.studied.length !== 1 ? "s" : ""} (last ${day(m.studied[m.studied.length - 1])})` : "Not opened yet"}
            {hist.slice(-4).map((h, i) => <span key={i}> · {h.screen === "evaluation" ? "Evaluation" : "Quiz"} {h.pct}% ({day(h.at)})</span>)}
            {hist.length > 4 && <span className="t4"> · {hist.length - 4} earlier</span>}
          </Row>
          {qs.length > 0 && (
            <Row label="YOU ASKED">
              {shownQs.map(q => (
                <div key={q.i} className="f ac jb" style={{ gap: 6 }}>
                  <span>“{q.text}” <span className="t4" style={{ fontSize: 11 }}>{day(q.at)}</span></span>
                  {onChange && <X title="Forget this question" onClick={() => onChange(removeQuestion(subject, cId, q.i))} />}
                </div>
              ))}
              {qs.length > 5 && <button className="btn btn-ghost btn-xs" style={{ padding: "2px 0" }} onClick={() => setAllQs(a => !a)}>{allQs ? "Show fewer" : `Show all ${qs.length}`}</button>}
            </Row>
          )}
          {recurring.length > 0 && (
            <Row label="RECURRING MISTAKES">
              {recurring.map(x => (
                <div key={x.id} className="f ac jb" style={{ gap: 6 }}>
                  <span><b style={{ color: "#b91c1c" }}>{x.text}</b> <span className="tag" style={{ fontSize: 9, marginLeft: 4, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>SEEN {x.count}×</span>{progress(x)}{back(x)}</span>
                  {onChange && <X title="This is not right — forget it" onClick={() => onChange(removeMistake(subject, cId, x.id))} />}
                </div>
              ))}
            </Row>
          )}
          {once.length > 0 && (
            <Row label="MISTAKES SEEN ONCE">
              {once.map(x => (
                <div key={x.id} className="f ac jb" style={{ gap: 6 }}>
                  <span>{x.text} <span className="t4" style={{ fontSize: 11 }}>{day(x.lastSeen)}</span>{progress(x)}{back(x)}</span>
                  {onChange && <X title="This is not right — forget it" onClick={() => onChange(removeMistake(subject, cId, x.id))} />}
                </div>
              ))}
            </Row>
          )}
          {onGroup && openList.length >= 3 && (
            <Row label="">
              <button className="btn btn-secondary btn-xs group-mistakes" disabled={grouping === "working"}
                onClick={async () => { setGrouping("working"); try { await onGroup(); setGrouping(""); } catch (e) { setGrouping(`Could not group: ${e.message}`); } }}>
                {grouping === "working" ? "Grouping…" : "🧩 Group similar mistakes"}
              </button>
              {grouping && grouping !== "working" && <span className="txs" style={{ marginLeft: 8, color: "#b45309" }}>{grouping}</span>}
            </Row>
          )}
          {fixed.length > 0 && (
            <Row label="✓ FIXED">
              {fixed.map(x => (
                <div key={x.id} className="f ac jb" style={{ gap: 6 }}>
                  <span style={{ color: "#15803d" }}>✓ {x.text} <span className="t4" style={{ fontSize: 11 }}>fixed {day(x.fixedAt)} · was seen {x.count}×</span></span>
                  {onChange && <X title="Forget this" onClick={() => onChange(removeMistake(subject, cId, x.id))} />}
                </div>
              ))}
            </Row>
          )}
          <Row label="WHAT THE TUTOR WILL USE">
            <button className="btn btn-ghost btn-xs what-tutor-uses" style={{ padding: "2px 0" }} onClick={() => setShowUse(v => !v)}>
              {showUse ? "▼ Hide" : "▶ Show"} {use ? "" : "(nothing yet)"}
            </button>
            {showUse && (
              <div className="tutor-uses" style={{ marginTop: 4, padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px dashed #c4b5fd", fontSize: 12, fontFamily: "var(--mono)", whiteSpace: "pre-wrap", color: "var(--t2)" }}>
                {use || "Nothing yet — open mistakes, recent questions, the last score and weak prerequisites will be used here."}
                <div className="t4" style={{ marginTop: 6, fontFamily: "var(--sans)", fontSize: 11 }}>Only this concept and its weak prerequisites — not other concepts, fixed mistakes or old chat.</div>
              </div>
            )}
          </Row>
        </>
      )}
    </div>
  );
};

// Chat saved before this visit, with a "Clear chat" button
export const EarlierChat = ({ subject, cId, since, onChange }) => {
  const [open, setOpen] = useState(false);
  const chat = getMemory(subject, cId).chat.filter(x => x.at < since);
  if (!chat.length) return null;
  return (
    <div className="card mb16 earlier-chat" style={{ padding: "12px 16px" }}>
      <div className="f ac jb" style={{ gap: 8 }}>
        <div style={{ cursor: "pointer", userSelect: "none", flex: 1 }} onClick={() => setOpen(o => !o)}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "var(--t3)" }}>💬 EARLIER CONVERSATION</span>
          <span className="txs t4 tm"> · {chat.length} message{chat.length !== 1 ? "s" : ""} · last {day(chat[chat.length - 1].at)} {open ? "▼" : "▶"}</span>
        </div>
        {onChange && <button className="btn btn-ghost btn-xs" onClick={() => onChange(clearChat(subject, cId))}>Clear chat</button>}
      </div>
      {open && (
        <div style={{ marginTop: 10, maxHeight: 320, overflowY: "auto" }}>
          {chat.map((x, i) => (
            <div key={i} style={{ display: "flex", justifyContent: x.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                background: x.role === "user" ? "#fff5f4" : "#fff", border: `1px solid ${x.role === "user" ? "#ffcdc9" : "var(--b1)"}`, color: "var(--t2)" }}>
                {x.content}
                {x.sources?.length > 0 && <div className="txs t4" style={{ marginTop: 4 }}>Sources: {x.sources.map(s => `[${s.tag}] ${s.label}`).join(" · ")}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// "📝 Learnova noted: …" under quiz and evaluation scores
export const NotedLine = ({ noted }) => {
  if (!noted) return null;
  const box = (children) => (
    <div className="noted-line" style={{ margin: "16px auto 0", maxWidth: 640, textAlign: "left", padding: "10px 14px", borderRadius: 10, background: "#faf8ff", border: "1px solid #ddd6fe", fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>{children}</div>
  );
  if (noted.status === "working") return box(<span className="t3">📝 Looking at your answers to update what Learnova remembers…</span>);
  if (noted.status === "failed") return box(<span className="t3">📝 Could not analyse your mistakes this time ({noted.error}). Your answers are still saved.</span>);
  const items = noted.items || [], fixed = noted.fixed || [], progress = noted.progress || [];
  if (!items.length && !fixed.length && !progress.length) return noted.hadWrong ? box(<span className="t3">📝 No clear misunderstanding found in your wrong answers — likely slips.</span>) : null;
  return box(<>
    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "#7c3aed", marginBottom: 4 }}>📝 LEARNOVA NOTED</div>
    {items.map((x, i) => (
      <div key={i}>• {x.text}{x.reopened ? <b style={{ color: "#b91c1c" }}> — back again</b> : ""}{x.count >= RECURRING ? <b style={{ color: "#b91c1c" }}> — seen {x.count}× (recurring)</b> : ""}</div>
    ))}
    {fixed.map((t, i) => <div key={`f${i}`} style={{ color: "#15803d" }}>✓ Fixed: {t}</div>)}
    {progress.map((x, i) => <div key={`p${i}`} className="t3">↗ {x.corrections} of {FIX_AFTER} correct answers towards fixing: {x.text}</div>)}
  </>);
};

// point 15: small note under a chat reply when the question showed a misunderstanding
export const ChatNoted = ({ noted }) => !noted ? null : (
  <div className="chat-noted" style={{ marginTop: 8, fontSize: 11, color: "#7c3aed", fontFamily: "var(--mono)" }}>
    📝 Learnova noted: {noted.text}{noted.isNew ? "" : noted.reopened ? " — back again" : ` — seen ${noted.count}×`}
  </div>
);

// ============================================================
// TA point 16 — personalisation pieces
// ============================================================
// On/off switch (per subject). Off = the tutor treats every learner the same (for adaptive vs non-adaptive comparisons).
export const PersonalisationSwitch = ({ subject, onChange }) => {
  const on = isPersonalised(subject);
  return (
    <button className="btn btn-secondary btn-xs personalisation-switch" title={on ? "The tutor uses what it remembers about you. Turn off to compare with a non-personalised tutor." : "The tutor treats every learner the same. Turn on to use what it remembers about you."}
      onClick={() => onChange && onChange(setPersonalised(subject, !on))}
      style={{ borderColor: on ? "#c4b5fd" : "var(--b1)", color: on ? "#7c3aed" : "var(--t3)", background: on ? "#faf8ff" : "var(--s3)" }}>
      🎯 Personalisation: <b>{on ? "ON" : "OFF"}</b>
    </button>
  );
};

const srcLine = (sources) => sources?.length ? <div className="txs t4" style={{ marginTop: 6 }}>Sources: {sources.map(x => `[${x.tag}] ${x.label}`).join(" · ")}</div> : null;

// "Quick recap" of weak prerequisites, shown before the explanation
export const RecapBox = ({ items, sources }) => (
  <div className="recap-box fade" style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}>
    {items.map((r, i) => (
      <div key={i} style={{ marginTop: i ? 10 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "#b45309", marginBottom: 4 }}>📌 QUICK RECAP: {r.name.toUpperCase()} ({r.mastery}%)</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--t1)" }}>{r.text}</div>
      </div>
    ))}
    {srcLine(sources)}
  </div>
);

// "For you" note, shown before the explanation
export const ForYouBox = ({ items, covers, sources }) => (
  <div className="for-you-box fade" style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "#faf8ff", border: "1px solid #ddd6fe" }}>
    <div className="f ac jb" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "#7c3aed" }}>🎯 FOR YOU</div>
      {covers?.length > 0 && <div className="tag" style={{ fontSize: 9, background: "#ede9fe", color: "#6d28d9", borderColor: "#c4b5fd", whiteSpace: "normal" }}>Personalised for you: covers your mix-up about {covers.join("; ")}</div>}
    </div>
    {items.map((t, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "var(--t1)", marginTop: 2 }}>• {t}</div>)}
    {srcLine(sources)}
  </div>
);

// After a quiz: which questions checked an earlier mix-up
export const TargetedReview = ({ items }) => !items?.length ? null : (
  <div className="targeted-review" style={{ margin: "12px auto 0", maxWidth: 640, textAlign: "left", padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #ddd6fe", fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>
    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "#7c3aed", marginBottom: 4 }}>🎯 QUESTIONS THAT CHECKED YOUR EARLIER MIX-UPS</div>
    {items.map((x, i) => <div key={i}>Q{x.n} {x.correct ? "✓" : "✗"} — {x.targetText}</div>)}
  </div>
);
export const TargetTag = ({ text }) => !text ? null : (
  <div className="target-tag txs" style={{ marginTop: 8, color: "#7c3aed", fontFamily: "var(--mono)" }}>🎯 This question checked your earlier mix-up: {text}</div>
);
