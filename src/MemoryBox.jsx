import React, { useState } from 'react';
import { getMemory, studyHistory, removeQuestion, removeMistake, clearChat, RECURRING } from './learnerMemory.js';

// ============================================================
// TA point 14 — "What Learnova remembers" box and the earlier conversation, shown on each concept
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

export const MemoryBox = ({ subject, cId, onChange }) => {
  const [open, setOpen] = useState(true);
  const [allQs, setAllQs] = useState(false);
  const m = getMemory(subject, cId);
  const hist = studyHistory(subject, cId);
  const recurring = m.mistakes.filter(x => x.count >= RECURRING).sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);
  const once = m.mistakes.filter(x => x.count < RECURRING).sort((a, b) => b.lastSeen - a.lastSeen);
  const qs = m.questions.map((q, i) => ({ ...q, i })).reverse();
  const shownQs = allQs ? qs : qs.slice(0, 5);
  const nothing = !m.studied.length && !hist.length && !m.questions.length && !m.mistakes.length;
  const summary = [m.studied.length ? `studied ${m.studied.length}×` : "", hist.length ? `${hist.length} quiz${hist.length !== 1 ? "zes" : ""}` : "",
    m.questions.length ? `${m.questions.length} question${m.questions.length !== 1 ? "s" : ""}` : "", m.mistakes.length ? `${m.mistakes.length} mistake${m.mistakes.length !== 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");

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
                  <span><b style={{ color: "#b91c1c" }}>{x.text}</b> <span className="tag" style={{ fontSize: 9, marginLeft: 4, background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}>SEEN {x.count}×</span></span>
                  {onChange && <X title="This is not right — forget it" onClick={() => onChange(removeMistake(subject, cId, x.id))} />}
                </div>
              ))}
            </Row>
          )}
          {once.length > 0 && (
            <Row label="MISTAKES SEEN ONCE">
              {once.map(x => (
                <div key={x.id} className="f ac jb" style={{ gap: 6 }}>
                  <span>{x.text} <span className="t4" style={{ fontSize: 11 }}>{day(x.lastSeen)}</span></span>
                  {onChange && <X title="This is not right — forget it" onClick={() => onChange(removeMistake(subject, cId, x.id))} />}
                </div>
              ))}
            </Row>
          )}
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
  if (noted.status === "working") return box(<span className="t3">📝 Looking at your wrong answers to note what to work on…</span>);
  if (noted.status === "failed") return box(<span className="t3">📝 Could not analyse your mistakes this time ({noted.error}). Your answers are still saved.</span>);
  if (!noted.items?.length) return box(<span className="t3">📝 No clear misunderstanding found in your wrong answers — likely slips.</span>);
  return box(<>
    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "1.5px", color: "#7c3aed", marginBottom: 4 }}>📝 LEARNOVA NOTED</div>
    {noted.items.map((x, i) => (
      <div key={i}>• {x.text}{x.count >= RECURRING ? <b style={{ color: "#b91c1c" }}> — seen {x.count}× (recurring)</b> : ""}</div>
    ))}
  </>);
};
