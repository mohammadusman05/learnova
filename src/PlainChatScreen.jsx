import React, { useState, useRef, useEffect } from 'react';
import { requestClaude } from './claudeApi.js';
import { buildAttachment, plainChatBody, currentChat, getChats, newChat, addExchange, chosenDocIds, setChosenDocs, addChatFile, setFileOn, attachedItems } from './plainChat.js';
import { extractPdfText, looksScanned } from './pdfText.js';
import { stripRepeatedLines } from './conceptExtraction.js';
import Markdown from './Markdown.jsx';

// ============================================================
// TA point 22 — "💬 AI Chat": a ChatGPT-like page. The learner first picks which of the subject's PDFs to learn
// from (multi-select dropdown) and can attach their own PDFs; answers are shown formatted, like ChatGPT.
// Shown instead of Study / Evaluation / Knowledge Graph when the subject is in Plain AI chat mode.
// ============================================================
const fmt = (t) => new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const Bubble = ({ m }) => m.role === "user" ? (
  <div className="fade plain-user" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
    <div style={{ maxWidth: "72%", padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: "linear-gradient(135deg,#ff6f61,#e8503f)", color: "#fff", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{m.content}</div>
  </div>
) : (
  <div className="fade plain-ai" style={{ display: "flex", marginBottom: 14 }}>
    <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#fff", border: "1px solid var(--b1)" }}><Markdown text={m.content} /></div>
  </div>
);

/** text of a file the learner attaches: PDFs are read in the browser (same clean-up as Ingest Content) */
export const readAttachment = async (file) => {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    const r = await extractPdfText(await file.arrayBuffer());
    if (looksScanned(r.text, r.numPages)) throw new Error(`"${file.name}" has no selectable text (it looks scanned), so it can't be attached.`);
    return stripRepeatedLines(r.pages.join("\n\n"));
  }
  if (["txt", "md"].includes(ext)) return await file.text();
  throw new Error(`"${file.name}": only PDF, TXT or MD files can be attached.`);
};

const PlainChatScreen = ({ subject, onUpdate, apiKey }) => {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);   // the question being answered (not saved until answered)
  const [error, setError] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [reading, setReading] = useState("");
  const [fileError, setFileError] = useState("");
  const subjRef = useRef(subject); subjRef.current = subject;
  const endRef = useRef(null), fileRef = useRef(null);
  const commit = (s) => { subjRef.current = s; onUpdate(s); };

  const chat = currentChat(subject);
  const messages = chat?.messages || [];
  const lectures = subject.docs || [];
  const chosen = chat ? chosenDocIds(subject, chat) : [];
  const files = chat?.files || [];
  const items = chat ? attachedItems(subject, chat) : [];
  const att = buildAttachment(items);
  const nothing = !items.length;
  // ask first: the dropdown opens by itself on a new chat with nothing chosen
  const [open, setOpen] = useState(() => nothing && !messages.length && lectures.length > 0);
  const older = getChats(subject).slice(0, -1).filter(c => c.messages.length);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [messages.length, pending, error]);

  const toggleLecture = (id) => commit(setChosenDocs(subjRef.current, chosen.includes(id) ? chosen.filter(x => x !== id) : [...chosen, id]));
  const label = !chosen.length ? "Choose PDFs to learn from…"
    : chosen.length <= 2 ? lectures.filter(d => chosen.includes(d.id)).map(d => d.name).join(", ") : `${chosen.length} PDFs chosen`;

  const attach = async (e) => {
    const list = [...(e.target.files || [])]; e.target.value = "";
    setFileError("");
    for (const f of list) {
      setReading(f.name);
      try { commit(addChatFile(subjRef.current, f.name, await readAttachment(f), Date.now())); }
      catch (err) { setFileError(err.message || `Could not read "${f.name}".`); }
    }
    setReading("");
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy || nothing) return;
    const askedAt = Date.now();
    const cur = currentChat(subjRef.current);
    const sentWith = buildAttachment(attachedItems(subjRef.current, cur)).attached;
    setInput(""); setError(""); setPending(q); setBusy(true); setOpen(false);
    try {
      const d = await requestClaude(apiKey, plainChatBody(subjRef.current, cur, q), { feature: "plain-chat" });
      const answer = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
      commit(addExchange(subjRef.current, q, answer, askedAt, Date.now(), sentWith));
    } catch (e) { setError(e.message); setInput(q); }   // nothing saved; the question goes back in the box to try again
    setPending(null); setBusy(false);
  };

  return (
    <div className="fade plain-chat" style={{ maxWidth: 900 }}>
      <div className="f ac jb mb8" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}>💬 AI Chat</div>
          <div className="txs t3">{subject.emoji} {subject.name} · ask anything about your PDFs</div>
        </div>
        <button className="btn btn-secondary btn-sm new-chat" disabled={busy || !messages.length} onClick={() => { commit(newChat(subjRef.current)); setOpen(lectures.length > 0); }}>＋ New chat</button>
      </div>

      {/* 1. which PDFs — multi-select dropdown, then 2. attach your own */}
      <div className="card chat-sources" style={{ padding: "12px 14px", margin: "8px 0 16px" }}>
        <div className="f ac g8" style={{ flexWrap: "wrap" }}>
          <span className="txs t3" style={{ fontWeight: 700 }}>Learn from:</span>
          <div style={{ position: "relative" }}>
            <button className={`btn btn-sm pick-lectures ${chosen.length ? "btn-secondary" : "btn-primary"}`} disabled={!lectures.length} onClick={() => setOpen(o => !o)}>📄 {lectures.length ? label : "No PDFs in this subject"} ▾</button>
            {open && lectures.length > 0 && (
              <div className="picker-panel" style={{ position: "absolute", top: "110%", left: 0, zIndex: 30, minWidth: 300, maxHeight: 320, overflowY: "auto", background: "#fff", border: "1px solid var(--b1)", borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.12)", padding: 10 }}>
                <div className="txs t3 mb8">Which PDFs do you want to learn from? (choose one or more)</div>
                {lectures.map(d => (
                  <label key={d.id} className="f ac g8 pick-item" style={{ padding: "6px 6px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={chosen.includes(d.id)} onChange={() => toggleLecture(d.id)} /> 📄 {d.name}
                  </label>
                ))}
                <div className="f g8" style={{ marginTop: 8, borderTop: "1px solid var(--b1)", paddingTop: 8 }}>
                  <button className="btn btn-ghost btn-xs pick-all" onClick={() => commit(setChosenDocs(subjRef.current, lectures.map(d => d.id)))}>Select all</button>
                  <button className="btn btn-ghost btn-xs pick-none" onClick={() => commit(setChosenDocs(subjRef.current, []))}>Clear</button>
                  <button className="btn btn-primary btn-xs pick-done" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
          <button className="btn btn-secondary btn-sm attach-file" disabled={!!reading} onClick={() => fileRef.current?.click()}>📎 Attach PDF</button>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" multiple style={{ display: "none" }} onChange={attach} />
          {reading && <span className="txs t3"><span className="spin" style={{ display: "inline-block", width: 10, height: 10, marginRight: 6, verticalAlign: "middle" }} />Reading {reading}…</span>}
        </div>
        {files.length > 0 && (
          <div className="f g8 attached-files" style={{ flexWrap: "wrap", marginTop: 10 }}>
            {files.map(f => (
              <label key={f.id} className="file-chip f ac g8" style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${f.on !== false ? "#99f6e4" : "var(--b1)"}`, background: f.on !== false ? "#f0fdfa" : "#fff", fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={f.on !== false} onChange={() => commit(setFileOn(subjRef.current, f.id, f.on === false))} /> 📎 {f.name} <span className="t4">(attached by you)</span>
              </label>
            ))}
          </div>
        )}
        {fileError && <div className="file-error txs" style={{ marginTop: 8, color: "#b91c1c" }}>⚠ {fileError}</div>}
        <div className="attached txs" style={{ marginTop: 10, color: nothing ? "#b45309" : "var(--t2)", lineHeight: 1.7 }}>
          {nothing
            ? "Choose at least one PDF above, or attach one, to start chatting."
            : <>📎 Your next message uses: <b>{att.attached.join(", ")}</b>{att.cut ? ` (${att.cut} cut short — too long)` : ""}{att.left.length ? ` · left out (too long): ${att.left.join(", ")}` : ""}{messages.length ? " · changes apply from your next message" : ""}</>}
        </div>
      </div>

      {older.length > 0 && (
        <div className="mb16">
          <span className="txs earlier-chats" style={{ cursor: "pointer", color: "var(--t3)", textDecoration: "underline" }} onClick={() => setShowOld(o => !o)}>
            {showOld ? "▼" : "▶"} Earlier chats ({older.length})
          </span>
          {showOld && older.map(c => (
            <div key={c.id} className="card" style={{ marginTop: 8, padding: 14, background: "#fafafa" }}>
              <div className="txs t4 tm mb8">Chat started {fmt(c.startedAt)}</div>
              {c.messages.map((m, i) => <Bubble key={i} m={m} />)}
            </div>
          ))}
        </div>
      )}

      <div className="plain-messages" style={{ minHeight: 120 }}>
        {!messages.length && !pending && (
          <div className="empty" style={{ padding: "30px 10px" }}>
            <div className="empty-icon">💬</div>
            <div style={{ fontSize: 14, color: "var(--t3)" }}>{nothing ? "First choose the PDFs to learn from." : "Ask anything — explain a topic, quiz me, compare two ideas…"}</div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {pending && <Bubble m={{ role: "user", content: pending }} />}
        {busy && <div className="loading"><div className="spin" /><span>AI is thinking...</span></div>}
        {error && <div className="plain-error" style={{ margin: "8px 0 14px", padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>⚠ {error} — your question is back in the box; press Send to try again.</div>}
        <div ref={endRef} />
      </div>

      <div className="iarea mt16" style={{ position: "sticky", bottom: 0, background: "#fff" }}>
        <textarea placeholder={nothing ? "Choose a PDF above first…" : "Message the AI... (Enter to send)"} value={input} onChange={e => setInput(e.target.value)} rows={2} disabled={nothing}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={busy || nothing || !input.trim()}>Send</button>
      </div>
    </div>
  );
};
export default PlainChatScreen;
