// ============================================================
// API COST CONTINGENCIES (TA point 20)
// Every Claude call in Learnova goes through requestClaude():
//   • counts the tokens Claude reports back (token meter → Usage & cost screen, usage CSV for the cost table)
//   • stops AI calls when this browser's monthly budget is used up (spending cap; default $5)
//   • retries when Claude is busy, and turns Claude's errors into clear messages (fallback)
//   • tells the app when AI is paused (no credit, budget used up, no internet) so the rest keeps working
// Counts and budget stay in this browser only (localStorage), like everything else in Learnova.
// ============================================================
import { currentLearnerCode } from './privacy.js';

export const MODEL = "claude-haiku-4-5-20251001";
export const API_URL = "https://api.anthropic.com/v1/messages";
// US$ per million tokens — Anthropic pricing page (Claude Haiku 4.5), checked October 2026
export const PRICES = { [MODEL]: { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 } };
export const PRICES_NOTE = "Claude Haiku 4.5: $1 per million input tokens, $5 per million output tokens (Anthropic price list, October 2026).";
export const USAGE_KEY = "learnova_usage";
export const BUDGET_KEY = "learnova_budget";
export const DEFAULT_BUDGET = 5;    // US$ per calendar month, per browser
export const WARN_AT = 0.8;         // warn at 80% of the budget
export const RETRY_WAITS = [2000, 6000];   // busy / rate-limited / network → wait and try again (2 retries)

// ── what each call was for (shown on the Usage & cost screen and in the usage CSV) ──
export const FEATURES = {
  "explain-lecture":       { group: "Explanations", label: "Explanation from the lecture" },
  "explain-general":       { group: "Explanations", label: "Explanation from general knowledge" },
  "personal-note":         { group: "Explanations", label: "\"For you\" note and recap" },
  "chat-answer":           { group: "Chat", label: "Chat answer" },
  "quiz-study":            { group: "Quizzes & evaluation", label: "Study / revision quiz questions" },
  "quiz-eval":             { group: "Quizzes & evaluation", label: "Evaluation questions" },
  "eval-marking":          { group: "Quizzes & evaluation", label: "Marking written answers" },
  "check-explanation":     { group: "Lecture checks", label: "Checking explanations against the lecture" },
  "check-chat":            { group: "Lecture checks", label: "Checking chat answers against the lecture" },
  "check-keys":            { group: "Lecture checks", label: "Checking quiz answer keys" },
  "mistake-analysis":      { group: "Learner memory", label: "Naming mistakes after a quiz" },
  "chat-misunderstanding": { group: "Learner memory", label: "Spotting misunderstandings in chat" },
  "mistake-grouping":      { group: "Learner memory", label: "Grouping similar mistakes" },
  "upload-read":           { group: "Uploads & graph", label: "Reading scanned PDFs and images" },
  "upload-concepts":       { group: "Uploads & graph", label: "Finding concepts in an upload" },
  "upload-merge":          { group: "Uploads & graph", label: "Merging duplicate concepts" },
  "links-within":          { group: "Uploads & graph", label: "Prerequisite links inside a PDF" },
  "links-across":          { group: "Uploads & graph", label: "Prerequisite links across PDFs" },
  "links-check":           { group: "Uploads & graph", label: "Checking prerequisite links" },
  "key-test":              { group: "Other", label: "Checking the API key at login" },
  "other":                 { group: "Other", label: "Other" },
};
export const GROUPS = ["Explanations", "Chat", "Quizzes & evaluation", "Lecture checks", "Learner memory", "Uploads & graph", "Other"];
// The first words of each system prompt tell what the call is for (prompts are shared with the offline tools)
const PROMPT_STARTS = [
  ["You are an AI tutor. Explain using ONLY", "explain-lecture"],
  ["You are an expert AI tutor for", "explain-general"],
  ["You are a tutor writing a short personal note", "personal-note"],
  ["You are an AI tutor for", "chat-answer"],
  ["Generate 3 MCQ", "quiz-study"],
  ["Generate exactly", "quiz-eval"],
  ["You are grading descriptive answers", "eval-marking"],
  ["You check an AI tutor's explanation", "check-explanation"],
  ["You are a strict fact-checker", "check-chat"],
  ["You check the answer keys", "check-keys"],
  ["You help a tutor keep track", "mistake-analysis"],
  ["You check one question a learner asked", "chat-misunderstanding"],
  ["You tidy one learner's list", "mistake-grouping"],
  ["You extract the concepts TAUGHT", "upload-concepts"],
  ["You decide which concepts are the SAME", "upload-merge"],
  ["You are given the concepts from one lecture document", "links-within"],
  ["You are given concepts from a NEW lecture", "links-across"],
  ["You are a strict reviewer of prerequisite links", "links-check"],
];
export const classifyPrompt = (system) => {
  const s = String(system || "").trimStart();
  const hit = PROMPT_STARTS.find(([start]) => s.startsWith(start));
  return hit ? hit[1] : "other";
};

// ── storage helpers ──
const read = (k, fallback) => { try { const v = typeof localStorage !== "undefined" ? localStorage.getItem(k) : null; return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { if (typeof localStorage !== "undefined") localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: the counter is best-effort */ } };
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (t = Date.now()) => dayKey(t).slice(0, 7);
const money = (n) => Math.round(n * 1e6) / 1e6;

// ── listeners: the app redraws the banner / sidebar figure when usage or AI status changes ──
const listeners = new Set();
export const onAiChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

// ── 1. token meter ──
export const costOf = (model, u = {}) => {
  const p = PRICES[model] || PRICES[MODEL];
  return money(((u.input_tokens || 0) * p.input + (u.output_tokens || 0) * p.output
    + (u.cache_creation_input_tokens || 0) * p.cacheWrite + (u.cache_read_input_tokens || 0) * p.cacheRead) / 1e6);
};
export const getUsage = () => { const u = read(USAGE_KEY, null); return u && u.days ? u : { v: 1, days: {} }; };
export const recordUsage = (feature, model, usage = {}, now = Date.now()) => {
  const u = getUsage();
  const day = (u.days[dayKey(now)] ||= {});
  const f = (day[feature] ||= { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 });
  f.calls += 1;
  f.input += usage.input_tokens || 0; f.output += usage.output_tokens || 0;
  f.cacheWrite += usage.cache_creation_input_tokens || 0; f.cacheRead += usage.cache_read_input_tokens || 0;
  f.cost = money(f.cost + costOf(model, usage));
  write(USAGE_KEY, u); notify();
  return u;
};
const blank = () => ({ calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 });
const add = (a, f) => { a.calls += f.calls; a.input += f.input; a.output += f.output; a.cacheWrite += f.cacheWrite || 0; a.cacheRead += f.cacheRead || 0; a.cost = money(a.cost + f.cost); return a; };
/** {today, month, all} totals + byFeature (this month and all time) */
export const usageSummary = (now = Date.now(), usage = getUsage()) => {
  const today = blank(), month = blank(), all = blank(), monthBy = {}, allBy = {};
  for (const [d, feats] of Object.entries(usage.days || {})) {
    for (const [k, f] of Object.entries(feats)) {
      add(all, f); add((allBy[k] ||= blank()), f);
      if (d.slice(0, 7) === monthKey(now)) { add(month, f); add((monthBy[k] ||= blank()), f); }
      if (d === dayKey(now)) add(today, f);
    }
  }
  return { today, month, all, monthBy, allBy };
};
const USAGE_COLUMNS = ["learner_code", "date", "group", "feature", "calls", "input_tokens", "output_tokens", "cache_write_tokens", "cache_read_tokens", "cost_usd"];
const cell = (v) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** One row per day per feature — every learner sends this file for the cost table */
export const usageCsv = (usage = getUsage(), learnerCode = currentLearnerCode()) => {
  const rows = [];
  for (const d of Object.keys(usage.days || {}).sort()) for (const [k, f] of Object.entries(usage.days[d])) {
    rows.push([learnerCode, d, FEATURES[k]?.group || "Other", k, f.calls, f.input, f.output, f.cacheWrite || 0, f.cacheRead || 0, f.cost.toFixed(6)]);
  }
  return [USAGE_COLUMNS, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
};

// ── 2. spending cap (this browser) ──
export const getBudget = () => { const b = read(BUDGET_KEY, null); const n = Number(b?.monthlyUsd); return Number.isFinite(n) && n > 0 ? n : DEFAULT_BUDGET; };
export const setBudget = (usd) => {
  const n = Math.round(Number(usd) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter an amount above $0.");
  write(BUDGET_KEY, { monthlyUsd: n, setAt: Date.now() });
  if (aiStatus.paused && aiStatus.kind === "budget" && budgetState().level !== "over") setPaused(null); else notify();
  return n;
};
/** {spent, limit, pct, level: ok | warn | over} for the current month */
export const budgetState = (now = Date.now()) => {
  const spent = usageSummary(now).month.cost, limit = getBudget();
  const pct = limit ? Math.round(100 * spent / limit) : 0;
  return { spent, limit, pct, level: spent >= limit ? "over" : spent >= limit * WARN_AT ? "warn" : "ok" };
};

// ── 3. clear errors + AI paused state ──
export class AiError extends Error {
  constructor(message, kind = "other", status = 0) { super(message); this.name = "AiError"; this.kind = kind; this.status = status; }
}
const PAUSE_KINDS = new Set(["budget", "credit", "spend-limit", "invalid-key", "offline"]);
const RETRY_KINDS = new Set(["rate", "busy", "server", "offline"]);
export const usd = (n) => `$${(n || 0).toFixed(2)}`;
export const describeError = (status, body, networkError) => {
  if (networkError) return new AiError("Can't reach Claude — check your internet connection.", "offline");
  const msg = String(body?.error?.message || "");
  const type = String(body?.error?.type || "");
  const said = msg ? ` (Claude said: "${msg.slice(0, 200)}")` : "";   // Claude's own words, for whoever has to fix it
  if (status === 401 || type === "authentication_error") return new AiError(`Your API key was not accepted (it may be wrong or deleted). Log out and enter a valid key.${said}`, "invalid-key", status);
  if (/credit balance/i.test(msg)) return new AiError(`Your API key has no credit left. Top up on Anthropic's website (console.anthropic.com → Billing) to continue.${said}`, "credit", status);
  if (/usage limit|spend limit|spending limit/i.test(msg)) return new AiError(`This key has reached the monthly spending limit set on Anthropic's website. Raise the limit there, or wait until next month.${said}`, "spend-limit", status);
  if (status === 429 || type === "rate_limit_error") return new AiError(`Claude is getting too many requests from this key right now. Wait a minute and try again.${said}`, "rate", status);
  if (status === 529 || type === "overloaded_error" || /^overloaded$/i.test(msg)) return new AiError(`Claude is very busy right now. Try again in a minute.${said}`, "busy", status);
  if (status >= 500) return new AiError(`Claude had a temporary problem (error ${status}). Try again.${said}`, "server", status);
  if (status === 403 || type === "permission_error") return new AiError(`This API key is not allowed to do that${msg ? `: ${msg}` : "."}`, "other", status);
  if (status === 413) return new AiError("This request is too large for Claude.", "other", status);
  return new AiError(`Claude could not answer${msg ? `: ${msg}` : ` (error ${status || "unknown"})`}`, "other", status);
};
let aiStatus = { paused: false };
export const getAiStatus = () => aiStatus;
export const setPaused = (err) => {
  const next = err ? { paused: true, kind: err.kind, message: err.message, at: Date.now() } : { paused: false };
  if (next.paused !== aiStatus.paused || next.kind !== aiStatus.kind || next.message !== aiStatus.message) { aiStatus = next; notify(); }
};

// for tests: replace the waiting between retries
let wait = (ms) => new Promise(r => setTimeout(r, ms));
export const setWaitForTests = (fn) => { wait = fn || ((ms) => new Promise(r => setTimeout(r, ms))); };

/**
 * One request to Claude. body = Messages API body (model defaults to Learnova's model).
 * Returns Claude's full reply (content, usage, stop_reason). Throws AiError with a clear message.
 * opts.feature — what the call is for (else worked out from the system prompt); opts.skipBudget — the login key check
 */
export const requestClaude = async (apiKey, body, { feature, skipBudget = false } = {}) => {
  const b = { model: MODEL, ...body };
  const what = feature || classifyPrompt(b.system);
  if (!skipBudget) {
    const bs = budgetState();
    if (bs.level === "over") {
      const err = new AiError(`This month's AI budget in Learnova (${usd(bs.limit)}) is used up. Raise it on the Usage & cost page to continue.`, "budget");
      setPaused(err); throw err;
    }
  }
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_WAITS.length; attempt++) {
    if (attempt) await wait(RETRY_WAITS[attempt - 1]);
    let res, data = null;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify(b),
      });
    } catch { lastErr = describeError(0, null, true); continue; }
    try { data = await res.json(); } catch { data = null; }
    const status = res.status ?? (data?.error ? 0 : 200);
    const ok = (res.ok ?? (status >= 200 && status < 300)) && data && !data.error;
    if (ok) {
      recordUsage(what, b.model, data.usage || {});
      if (aiStatus.paused) setPaused(null);
      return data;
    }
    lastErr = data ? describeError(status, data, false) : describeError(status >= 400 ? status : 502, null, false);
    if (!RETRY_KINDS.has(lastErr.kind)) break;
  }
  if (PAUSE_KINDS.has(lastErr.kind)) setPaused(lastErr);
  throw lastErr;
};

/** The usual text call used by every screen: callClaude(system, user, maxTokens, temperature) → reply text */
export const makeCaller = (apiKey, { defaultMaxTokens = 1500 } = {}) =>
  async (sys, usr, mt = defaultMaxTokens, temperature) => {
    const d = await requestClaude(apiKey, { max_tokens: mt, system: sys, messages: [{ role: "user", content: usr }], ...(temperature !== undefined ? { temperature } : {}) });
    return (d.content || []).filter(c => c.type === "text" || c.text).map(c => c.text || "").join("");
  };

/** Login check: {ok:true} or {ok:false, error}. A key with no credit is let in (AI paused, the rest works). */
export const testKey = async (apiKey) => {
  try { await requestClaude(apiKey, { max_tokens: 10, messages: [{ role: "user", content: "hi" }] }, { feature: "key-test", skipBudget: true }); return { ok: true }; }
  catch (e) {
    if (e.kind === "invalid-key") { setPaused(null); return { ok: false, error: "Invalid API key. Please check and try again." }; }
    return { ok: true, warning: e.message };
  }
};
