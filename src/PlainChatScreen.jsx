import React, { useState, useRef, useEffect } from 'react';
import { requestClaude } from './claudeApi.js';
import { buildAttachment, plainChatBody, currentChat, getChats, newChat, addExchange } from './plainChat.js';

// ============================================================
// TA point 22 — "💬 AI Chat": a ChatGPT-like page with the subject's lectures attached.
// Shown instead of Study / Evaluation / Knowledge Graph when the subject is in Plain AI chat mode.
// ============================================================
const fmt = (t) => new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const Bubble = ({ m }) => m.role === "user" ? (
  <div className="fade plain-user" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
    <div style={{ maxWidth: "72%", padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: "linear-gradient(135deg,#ff6f61,#e8503f)", color: "#fff", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{m.content}</div>
  </div>
) : (
  <div className="fade plain-ai" style={{ display: "flex", marginBottom: 14 }}>
    <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "#fff", border: "1px solid var(--b1)", fontSize: 14, lineHeight: 1.8, color: "var(--t1)", whiteSpace: "pre-wrap" }}>{m.content}</div>
  </div>
);

const PlainChatScreen = ({ subject, onUpdate, apiKey }) => {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);   // the question being answered (not saved until answered)
  const [error, setError] = useState("");
  const [showOld, setShowOld] = useState(false);
  const subjRef = useRef(subject); subjRef.current = subject;
  const endRef = useRef(null);
  const att = buildAttachment(subject);
  const chat = currentChat(subject);
  const messages = chat?.messages || [];
  const older = getChats(subject).slice(0, -1).filter(c => c.messages.length);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [messages.length, pending, error]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const askedAt = Date.now();
    setInput(""); setError(""); setPending(q); setBusy(true);
    try {
      const d = await requestClaude(apiKey, plainChatBody(subjRef.current, currentChat(subjRef.current)?.messages || [], q), { feature: "plain-chat" });
      const answer = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
      onUpdate(addExchange(subjRef.current, q, answer, askedAt));
    } catch (e) { setError(e.message); setInput(q); }   // nothing saved; the question goes back in the box to try again
    setPending(null); setBusy(false);
  };

  return (
    <div className="fade plain-chat" style={{ maxWidth: 900 }}>
      <div className="f ac jb mb8" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}>💬 AI Chat</div>
          <div className="txs t3">{subject.emoji} {subject.name} · ask anything about your lectures</div>
        </div>
        <button className="btn btn-secondary btn-sm new-chat" disabled={busy || !messages.length} onClick={() => onUpdate(newChat(subjRef.current))}>＋ New chat</button>
      </div>
      <div className="attached txs" style={{ margin: "8px 0 16px", padding: "8px 12px", borderRadius: 10, background: "var(--s3)", border: "1px solid var(--b1)", color: "var(--t2)", lineHeight: 1.7 }}>
        {att.attached.length
          ? <>📎 Attached: <b>{att.attached.join(", ")}</b>{att.cut ? ` (${att.cut} cut short — too long)` : ""}{att.left.length ? ` · not attached (too long): ${att.left.join(", ")}` : ""}</>
          : <>📎 No lectures in this subject yet — the AI will answer from general knowledge.</>}
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
            <div style={{ fontSize: 14, color: "var(--t3)" }}>Ask anything — explain a topic, quiz me, compare two ideas…</div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {pending && <Bubble m={{ role: "user", content: pending }} />}
        {busy && <div className="loading"><div className="spin" /><span>AI is thinking...</span></div>}
        {error && <div className="plain-error" style={{ margin: "8px 0 14px", padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>⚠ {error} — your question is back in the box; press Send to try again.</div>}
        <div ref={endRef} />
      </div>

      <div className="iarea mt16" style={{ position: "sticky", bottom: 0, background: "#fff" }}>
        <textarea placeholder="Message the AI... (Enter to send)" value={input} onChange={e => setInput(e.target.value)} rows={2}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={busy || !input.trim()}>Send</button>
      </div>
    </div>
  );
};
export default PlainChatScreen;
