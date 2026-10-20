import React, { useState, useEffect } from 'react';
import { onAiChange, getAiStatus, budgetState, usd } from './claudeApi.js';

// ============================================================
// TA point 20 — fallback notices
//   AiBanner   : "AI paused" (no credit / budget used up / no internet / bad key) and the 80% budget warning
//   AiErrorBox : shown where a quiz could not be made, with the reason and "Try again"
// ============================================================

/** re-renders when usage or AI status changes */
export const useAiState = () => {
  const [, setTick] = useState(0);
  useEffect(() => onAiChange(() => setTick(t => t + 1)), []);
  return { status: getAiStatus(), budget: budgetState() };
};

export const AiBanner = ({ onOpenUsage }) => {
  const { status, budget } = useAiState();
  const [hiddenWarn, setHiddenWarn] = useState(false);
  const [hiddenPause, setHiddenPause] = useState(null);
  const box = (bg, border, color) => ({ margin: "12px 24px 0", padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: bg, color, fontSize: 12, lineHeight: 1.6 });
  const link = { marginLeft: 8, textDecoration: "underline", cursor: "pointer", fontWeight: 700 };
  if (status.paused && hiddenPause !== status.at) return (
    <div className="ai-paused" style={box("#fef2f2", "#fca5a5", "#b91c1c")}>
      <b>⏸ AI paused — </b>{status.message}
      <div style={{ color: "#7f1d1d" }}>Saved explanations, the knowledge graph, mastery, the revision list and the Library still work.</div>
      {status.kind === "budget" && onOpenUsage && <span className="open-usage" style={link} onClick={onOpenUsage}>Open Usage & cost</span>}
      <span style={{ ...link, fontWeight: 400 }} onClick={() => setHiddenPause(status.at)}>Hide</span>
    </div>
  );
  if (!status.paused && budget.level === "warn" && !hiddenWarn) return (
    <div className="budget-warn" style={box("#fffbeb", "#fde68a", "#b45309")}>
      💰 You've used {budget.pct}% of this month's AI budget in Learnova ({usd(budget.spent)} of {usd(budget.limit)}).
      {onOpenUsage && <span style={link} onClick={onOpenUsage}>Usage & cost</span>}
      <span style={{ ...link, fontWeight: 400 }} onClick={() => setHiddenWarn(true)}>Hide</span>
    </div>
  );
  return null;
};

export const AiErrorBox = ({ message, what = "do this", onRetry }) => (
  <div className="ai-error card" style={{ padding: 18, border: "1px solid #fca5a5", background: "#fef2f2" }}>
    <div style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 6 }}>⚠ Could not {what}</div>
    <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6, marginBottom: onRetry ? 12 : 0 }}>{message}</div>
    {onRetry && <button className="btn btn-primary btn-sm" onClick={onRetry}>🔄 Try again</button>}
  </div>
);
