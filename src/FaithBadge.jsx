import React, { useState } from 'react';

// ============================================================
// TA point 19 — "lecture check" badge under explanations / chat answers, and the quiz answer-key note
// ============================================================
export const FaithBadge = ({ check }) => {
  const [open, setOpen] = useState(false);
  if (!check) return null;
  const wrap = (children, color = "var(--t3)") => (
    <div className="faith-badge" style={{ marginTop: 10, fontSize: 12, fontFamily: "var(--mono)", color, whiteSpace: "normal" }}>{children}</div>
  );
  if (check.status === "working") return wrap("🔎 Checking against your lecture…");
  if (check.status === "failed" && check.strict) return wrap(`⚠ Could not check against your lecture, so some sentences may not come from it (${check.error})`, "#b45309");
  if (check.status === "failed") return wrap(`🔎 Lecture check unavailable (${check.error})`);
  // "From My Document" explanation: sentences not in the lecture were left out — only the count is shown, never the content
  if (check.filtered) {
    const f = check.filtered;
    return wrap(<>
      <span style={{ color: "#15803d", fontWeight: 700 }}>{f.removed ? "🔎 Lecture check: ✓ only sentences from your lecture are shown" : "🔎 Lecture check: ✓ every sentence is from your lecture"}</span>
      {f.removed > 0 && <span className="faith-left-out"> · {f.removed} sentence{f.removed !== 1 ? "s" : ""} left out (not in your lecture)</span>}
    </>);
  }
  const g = check.result;
  if (!g) return null;
  if (!g.checked) return wrap(`🔎 Lecture check: nothing to check against the lecture${g.beyond ? ` (${g.beyond} statement${g.beyond !== 1 ? "s" : ""} beyond your lecture)` : ""}`);
  const bad = g.statements.filter(s => s.verdict === "not supported");
  return wrap(<>
    <span style={{ color: bad.length ? "#b45309" : "#15803d", fontWeight: 700 }}>
      🔎 Lecture check: {bad.length ? "" : "✓ "}{g.supported} of {g.checked} statement{g.checked !== 1 ? "s" : ""} supported by your lecture
    </span>
    {g.beyond > 0 && <span> · {g.beyond} beyond your lecture</span>}
    {bad.length > 0 && <>
      <span> · </span>
      <span className="faith-toggle" style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setOpen(o => !o)}>
        {open ? "▼" : "▶"} ⚠ {bad.length} not found in the cited pages
      </span>
      {open && <div className="faith-unsupported" style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontFamily: "var(--sans)", color: "var(--t2)" }}>
        {bad.map((s, i) => <div key={i} style={{ marginBottom: 4 }}>• “{s.text}”{s.note ? <span className="t4"> — {s.note}</span> : null}</div>)}
        <div className="t4" style={{ fontSize: 11 }}>Treat these with care: the lecture pages given to the tutor do not say this.</div>
      </div>}
    </>}
  </>, "var(--t3)");
};

export const KeyCheckNote = ({ note }) => {
  if (!note) return null;
  const box = (children, warn) => (
    <div className="key-check-note" style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontFamily: "var(--mono)",
      background: warn ? "#fffbeb" : "#f0fdf4", border: `1px solid ${warn ? "#fde68a" : "#bbf7d0"}`, color: warn ? "#b45309" : "#15803d" }}>{children}</div>
  );
  if (note.failed) return box("🔎 Answer keys could not be checked against your lecture this time.", true);
  if (note.allUnclear) return box("🔎 The lecture does not clearly settle these questions — answer keys are unverified.", true);
  if (!note.corrected && !note.removed) return box(`🔎 Answer keys checked against your lecture: all ${note.checked} correct.`);
  return box(`🔎 Answer keys checked against your lecture: ${[note.corrected ? `${note.corrected} corrected` : "", note.removed ? `${note.removed} unclear question${note.removed !== 1 ? "s" : ""} removed` : ""].filter(Boolean).join(" · ")}.`, true);
};
