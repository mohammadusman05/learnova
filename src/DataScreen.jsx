import React, { useState } from 'react';
import { getLearnerCode, getConsent, myDataBackup, deleteAllMyData, IDLE_LOCK_MINUTES } from './privacy.js';

// ============================================================
// TA point 18 — "🔒 Your data": what is stored, where, what is sent, and the learner's controls
// ============================================================
const Section = ({ title, children }) => (
  <div className="card mb16" style={{ padding: "16px 20px" }}>
    <div className="card-label" style={{ marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 13, lineHeight: 1.75, color: "var(--t2)" }}>{children}</div>
  </div>
);

// The consent screen, shown once before the portal opens
export const ConsentGate = ({ onAccept, logo }) => {
  const [ok, setOk] = useState(false);
  return (
    <div className="consent-gate" style={{ minHeight: "100vh", background: "linear-gradient(135deg,#fff9f8 0%,#f5f5f5 50%,#fff3f2 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 560, width: "100%", padding: 28 }}>
        <div className="f ac g12 mb16">
          {logo && <img src={logo} alt="" style={{ width: 36, height: 36, borderRadius: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 800 }}>Before you start: your data</div>
        </div>
        <ul style={{ fontSize: 13, lineHeight: 1.8, color: "var(--t2)", paddingLeft: 18, margin: "0 0 16px" }}>
          <li>Everything Learnova saves — your subjects, uploaded lecture text, answers, chat, mistakes and progress — stays <b>only in this browser</b>. There is no Learnova server.</li>
          <li>When you use AI features, the needed text (lecture passages, your answers and questions, notes about your mistakes) is <b>sent to Anthropic's Claude API</b> to generate explanations, quizzes and marking.</li>
          <li>Your <b>API key is never saved</b>. It is forgotten when you close or refresh the page, or after {IDLE_LOCK_MINUTES} minutes without activity.</li>
          <li>Anyone using this browser on this computer can see your Learnova data. You can download or delete it any time from <b>🔒 Your data</b>.</li>
          <li>For the pilot, results are shared only by you downloading a CSV, marked with an anonymous code — never your name.</li>
        </ul>
        <label className="f ac g8 mb16" style={{ fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} /> I understand how my data is used
        </label>
        <button className="btn btn-primary" disabled={!ok} onClick={onAccept}>Continue →</button>
      </div>
    </div>
  );
};

const DataScreen = ({ subjects, onDeleted }) => {
  const [confirm, setConfirm] = useState(false);
  const code = getLearnerCode();
  const consent = getConsent();
  const list = Object.values(subjects || {});
  const count = (f) => list.reduce((a, s) => a + f(s), 0);
  const download = () => {
    const blob = new Blob([JSON.stringify(myDataBackup(subjects), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url; a.download = `learnova-my-data-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="fade data-screen">
      <div className="section-title">🔒 Your data</div>
      <div className="section-sub">What Learnova keeps, where it goes, and how to remove it</div>

      <Section title="WHAT IS SAVED — ONLY IN THIS BROWSER">
        {list.length} subject{list.length !== 1 ? "s" : ""} · {count(s => (s.docs || []).length)} uploaded document{count(s => (s.docs || []).length) !== 1 ? "s" : ""} (their text) · {count(s => Object.keys(s.graph?.nodes || {}).length)} concepts and links · {count(s => (s.answerLog || []).length)} saved answers · chat, mistakes and revision dates.
        <br />It is stored in this browser's local storage, as plain text. There is <b>no Learnova server or database</b> — the website only delivers the app's code. Anyone using this browser on this computer can see it.
      </Section>
      <Section title="WHAT IS SENT ELSEWHERE">
        <b>Anthropic (Claude API)</b> — only when you use an AI feature: lecture passages, your answers and questions, and short notes about your mistakes, to write explanations, quizzes, marking and links. It goes straight from your browser to Anthropic with your own API key. See <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">Anthropic's privacy policy</a>.
        <br /><b>Google Fonts</b> and <b>jsDelivr / Hugging Face</b> — only to download fonts and the meaning-search model. No learner data is sent to them.
        <br />Lecture text is treated as material, not instructions — Claude is told to ignore any instructions written inside uploaded documents.
      </Section>
      <Section title="WHAT IS NEVER SAVED">
        Your <b>API key</b>: kept only while this tab is open, and forgotten after {IDLE_LOCK_MINUTES} minutes without activity.
      </Section>
      <Section title="YOUR ANONYMOUS LEARNER CODE">
        <span className="learner-code" style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 18, color: "#e8503f" }}>{code}</span>
        <div className="txs t3 tm" style={{ marginTop: 4 }}>Added to the CSV downloads, so pilot results from different learners can be combined without names.</div>
        {consent && <div className="txs t3 tm" style={{ marginTop: 4 }}>You agreed to the data notice on {new Date(consent.at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.</div>}
      </Section>
      <div className="card mb16" style={{ padding: "16px 20px" }}>
        <div className="card-label" style={{ marginBottom: 10 }}>YOUR CONTROLS</div>
        <div className="f g12 fw">
          <button className="btn btn-secondary btn-sm download-my-data" onClick={download}>⬇ Download my data</button>
          {!confirm
            ? <button className="btn btn-danger btn-sm delete-my-data" onClick={() => setConfirm(true)}>🗑 Delete all my data</button>
            : <div className="f ac g8 fw delete-confirm" style={{ padding: "8px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
                <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>Delete every subject, answer and setting from this browser? This cannot be undone.</span>
                <button className="btn btn-danger btn-sm confirm-delete" onClick={() => { const removed = deleteAllMyData(); onDeleted && onDeleted(removed); }}>Yes, delete everything</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
              </div>}
        </div>
        <div className="txs t3 tm" style={{ marginTop: 8 }}>Tip: download a backup first — clearing your browser's site data also deletes everything.</div>
      </div>
    </div>
  );
};
export default DataScreen;
