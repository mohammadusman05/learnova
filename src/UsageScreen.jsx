import React, { useState } from 'react';
import { usageSummary, usageCsv, getUsage, getBudget, setBudget, FEATURES, GROUPS, PRICES_NOTE, WARN_AT, usd } from './claudeApi.js';
import { useAiState } from './AiStatus.jsx';
import { currentLearnerCode } from './privacy.js';

// ============================================================
// TA point 20 — Usage & cost: token meter, spending cap, usage CSV (for the cost table)
// ============================================================
const fmtTokens = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
const money4 = (n) => n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : usd(n);
const pad = (n) => String(n).padStart(2, "0");

const UsageScreen = () => {
  const { budget } = useAiState();
  const [input, setInput] = useState(String(getBudget()));
  const [msg, setMsg] = useState("");
  const [range, setRange] = useState("month");
  const s = usageSummary();
  const by = range === "month" ? s.monthBy : s.allBy;
  const total = range === "month" ? s.month : s.all;

  const save = () => { try { const n = setBudget(input); setInput(String(n)); setMsg(`Saved — monthly budget is now ${usd(n)}.`); } catch (e) { setMsg(e.message); } };
  const download = () => {
    const blob = new Blob(["﻿" + usageCsv(getUsage())], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url; a.download = `learnova-usage-${currentLearnerCode() || "learner"}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const Tile = ({ label, t }) => (
    <div className="card usage-tile" style={{ flex: 1, minWidth: 150, padding: 16 }}>
      <div className="card-label">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--t1)", margin: "4px 0" }}>{money4(t.cost)}</div>
      <div className="txs t3 tm">{t.calls} AI call{t.calls !== 1 ? "s" : ""} · {fmtTokens(t.input)} in · {fmtTokens(t.output)} out</div>
    </div>
  );
  const barColor = budget.level === "over" ? "#dc2626" : budget.level === "warn" ? "#f59e0b" : "#16a34a";

  return (
    <div className="fade" style={{ maxWidth: 900 }}>
      <div className="section-title mb4">💰 Usage & cost</div>
      <div className="txs t3 mb20" style={{ lineHeight: 1.7 }}>
        What the AI has cost in this browser, counted from the token numbers Claude sends back with every reply. {PRICES_NOTE}
      </div>

      <div className="f g12 mb20" style={{ flexWrap: "wrap" }}>
        <Tile label="TODAY" t={s.today} />
        <Tile label="THIS MONTH" t={s.month} />
        <Tile label="ALL TIME" t={s.all} />
      </div>

      <div className="card mb20 budget-card" style={{ padding: 18 }}>
        <div className="card-label">MONTHLY AI BUDGET (THIS BROWSER)</div>
        <div className="f ac g8 mb8" style={{ flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontWeight: 700 }}>$</span>
          <input className="budget-input" type="number" min="0.5" step="0.5" value={input} onChange={e => setInput(e.target.value)}
            style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--b1)", fontFamily: "var(--mono)" }} />
          <span className="txs t3">per month</span>
          <button className="btn btn-primary btn-sm save-budget" onClick={save}>Save</button>
          {msg && <span className="txs budget-msg" style={{ color: "#15803d" }}>{msg}</span>}
        </div>
        <div style={{ height: 8, background: "var(--b1)", borderRadius: 4, overflow: "hidden", margin: "8px 0" }}>
          <div style={{ height: "100%", width: `${Math.min(100, budget.pct)}%`, background: barColor, transition: "width 0.3s" }} />
        </div>
        <div className="txs budget-line" style={{ color: barColor, fontWeight: 700 }}>
          {usd(budget.spent)} of {usd(budget.limit)} used this month ({budget.pct}%)
          {budget.level === "over" ? " — AI is paused until next month or until you raise the budget." : budget.level === "warn" ? " — getting close." : ""}
        </div>
        <div className="txs t3" style={{ marginTop: 8, lineHeight: 1.7 }}>
          You get a warning at {Math.round(WARN_AT * 100)}%; at 100% Learnova stops making AI calls (everything else keeps working).
          This budget counts only this browser. The real lock is the monthly spending limit you set for your key on Anthropic's website.
        </div>
      </div>

      <div className="card mb20" style={{ padding: 18 }}>
        <div className="f ac jb mb12">
          <div className="card-label">WHERE THE MONEY GOES</div>
          <div className="f g8">
            {["month", "all"].map(r => (
              <button key={r} className={`btn btn-xs ${range === r ? "btn-primary" : "btn-ghost"}`} onClick={() => setRange(r)}>{r === "month" ? "This month" : "All time"}</button>
            ))}
          </div>
        </div>
        {!total.calls ? <div className="txs t3">No AI calls yet{range === "month" ? " this month" : ""}.</div> : (
          <table className="usage-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ textAlign: "left", color: "var(--t3)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "1px" }}>
              <th style={{ padding: "6px 4px" }}>FEATURE</th><th style={{ textAlign: "right" }}>CALLS</th><th style={{ textAlign: "right" }}>TOKENS IN</th>
              <th style={{ textAlign: "right" }}>TOKENS OUT</th><th style={{ textAlign: "right" }}>COST</th><th style={{ textAlign: "right" }}>PER CALL</th><th style={{ textAlign: "right" }}>SHARE</th>
            </tr></thead>
            <tbody>
              {GROUPS.map(g => {
                const feats = Object.entries(by).filter(([k]) => (FEATURES[k]?.group || "Other") === g);
                if (!feats.length) return null;
                const gt = feats.reduce((a, [, f]) => ({ calls: a.calls + f.calls, input: a.input + f.input, output: a.output + f.output, cost: a.cost + f.cost }), { calls: 0, input: 0, output: 0, cost: 0 });
                return (
                  <React.Fragment key={g}>
                    <tr className="usage-group" style={{ borderTop: "1px solid var(--b1)", fontWeight: 700 }}>
                      <td style={{ padding: "8px 4px" }}>{g}</td><td style={{ textAlign: "right" }}>{gt.calls}</td><td style={{ textAlign: "right" }}>{fmtTokens(gt.input)}</td>
                      <td style={{ textAlign: "right" }}>{fmtTokens(gt.output)}</td><td style={{ textAlign: "right" }}>{money4(gt.cost)}</td><td />
                      <td style={{ textAlign: "right" }}>{total.cost ? Math.round(100 * gt.cost / total.cost) : 0}%</td>
                    </tr>
                    {feats.sort((a, b) => b[1].cost - a[1].cost).map(([k, f]) => (
                      <tr key={k} className="usage-feature" style={{ color: "var(--t2)" }}>
                        <td style={{ padding: "4px 4px 4px 18px" }}>{FEATURES[k]?.label || k}</td><td style={{ textAlign: "right" }}>{f.calls}</td>
                        <td style={{ textAlign: "right" }}>{fmtTokens(f.input)}</td><td style={{ textAlign: "right" }}>{fmtTokens(f.output)}</td>
                        <td style={{ textAlign: "right" }}>{money4(f.cost)}</td><td style={{ textAlign: "right" }}>{money4(f.calls ? f.cost / f.calls : 0)}</td><td />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="card-label">FOR THE COST TABLE</div>
        <div className="txs t3 mb12" style={{ lineHeight: 1.7, marginTop: 6 }}>
          One row per day per feature (calls, tokens, cost) with your anonymous learner code — no questions, answers or lecture text.
          At the end of the pilot, download it and send it to your project lead.
        </div>
        <button className="btn btn-primary btn-sm download-usage" onClick={download}>⬇ Download my usage (CSV)</button>
      </div>
    </div>
  );
};
export default UsageScreen;
