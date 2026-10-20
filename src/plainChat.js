// ============================================================
// PLAIN AI CHAT (TA point 22 — standard LLM comparison)
// A ChatGPT-like chat: the learner first picks which of the subject's lectures to learn from (multi-select)
// and can also attach their own PDF to the chat. The AI gets one simple instruction ("You are a helpful
// assistant"), the chosen documents in full and the conversation — nothing else from Learnova (no topics,
// retrieval, citations, lecture check, quizzes, mastery or learner memory). Same model as the rest of Learnova.
// The attached documents are marked for Anthropic's prompt caching, so repeating them each message is cheap.
// Every finished question + answer is saved (subject.plainChats) with the files attached, for the chat log CSV.
// ============================================================
import { LECTURE_GUARD, currentLearnerCode } from './privacy.js';

export const PLAIN_SYSTEM = "You are a helpful assistant.";
export const MAX_ATTACH_CHARS = 400000;   // ≈ 100k tokens — well inside the model's 200k-token window
export const MAX_FILE_CHARS = 400000;     // a PDF attached in the chat is kept up to this length
export const MAX_TURNS_SENT = 30;         // messages of the conversation sent back to the AI
export const MAX_SAVED_MESSAGES = 300;    // per subject, oldest dropped first (browser storage)

// ── saved chats: subject.plainChats = [{id, startedAt, docIds:[subject doc ids], files:[{id,name,text,on,addedAt}], messages}] ──
export const getChats = (subject) => subject?.plainChats || [];
export const currentChat = (subject) => getChats(subject).at(-1) || null;
const blankChat = (now) => ({ id: `chat_${now}`, startedAt: now, docIds: [], files: [], messages: [] });
/** a new chat starts with nothing chosen — the learner picks the lectures first */
export const newChat = (subject, now = Date.now()) => {
  const cur = currentChat(subject);
  if (cur && !cur.messages.length && !(cur.docIds || []).length && !(cur.files || []).length) return subject;   // already a fresh chat
  return { ...subject, plainChats: [...getChats(subject), blankChat(now)] };
};
const withCurrent = (subject, fn, now = Date.now()) => {
  const s = currentChat(subject) ? subject : { ...subject, plainChats: [blankChat(now)] };
  const chats = [...getChats(s)];
  chats[chats.length - 1] = fn(chats[chats.length - 1]);
  return { ...s, plainChats: chats };
};

/** which subject lectures are chosen in this chat (chats from before the picker used all of them) */
export const chosenDocIds = (subject, chat) => chat?.docIds ?? (subject?.docs || []).map(d => d.id);
export const setChosenDocs = (subject, docIds, now) => withCurrent(subject, c => ({ ...c, docIds: [...docIds] }), now);
/** a PDF / text file the learner attached in the chat (read in the browser) */
export const addChatFile = (subject, name, text, now = Date.now()) =>
  withCurrent(subject, c => ({ ...c, files: [...(c.files || []), { id: `f_${now}`, name, text: String(text || "").slice(0, MAX_FILE_CHARS), on: true, addedAt: now }] }), now);
export const setFileOn = (subject, fileId, on) => withCurrent(subject, c => ({ ...c, files: (c.files || []).map(f => f.id === fileId ? { ...f, on: !!on } : f) }));

/** the documents that go with the next message: chosen lectures (in course order) + ticked chat files */
export const attachedItems = (subject, chat) => {
  const ids = new Set(chosenDocIds(subject, chat));
  return [
    ...(subject?.docs || []).filter(d => ids.has(d.id)).map(d => ({ name: d.name, text: d.rawText || "" })),
    ...((chat?.files) || []).filter(f => f.on !== false).map(f => ({ name: f.name, text: f.text || "", uploaded: true })),
  ];
};

/** the documents as attached files: {text, attached:[names], left:[names not attached], cut:name|null} */
export const buildAttachment = (items, max = MAX_ATTACH_CHARS) => {
  let text = "", cut = null;
  const attached = [], left = [];
  for (const d of items || []) {
    const body = String(d.text || "");
    const block = `<document name="${d.name}">\n${body}\n</document>\n`;
    if (cut) left.push(d.name);   // the space ran out at an earlier document
    else if (text.length + block.length <= max) { text += block; attached.push(d.name); }
    else if (max - text.length > 2000) {
      const room = max - text.length - 200;
      text += `<document name="${d.name}" note="cut short — too long to attach in full">\n${body.slice(0, room)}\n</document>\n`;
      attached.push(d.name); cut = d.name;
    } else left.push(d.name);
  }
  return { text, attached, left, cut };
};

/** the request body for one message: system = instruction + chosen documents (cached), messages = the chat */
export const plainChatBody = (subject, chat, question, maxTokens = 1500) => {
  const att = buildAttachment(attachedItems(subject, chat));
  const system = [{ type: "text", text: `${PLAIN_SYSTEM} ${LECTURE_GUARD}` }];
  if (att.text) system.push({ type: "text", text: `The user has attached these documents:\n${att.text}`, cache_control: { type: "ephemeral" } });
  const turns = (chat?.messages || []).filter(m => (m.role === "user" || m.role === "assistant") && m.content).slice(-MAX_TURNS_SENT);
  while (turns.length && turns[0].role !== "user") turns.shift();   // the API needs the chat to start with the user
  return { max_tokens: maxTokens, system, messages: [...turns.map(m => ({ role: m.role, content: m.content })), { role: "user", content: question }] };
};

/** one finished question + answer, saved together (a failed question is not saved, so the chat stays valid) */
export const addExchange = (subject, question, answer, askedAt, answeredAt = Date.now(), attached = []) => {
  const s = withCurrent(subject, c => ({ ...c, messages: [...c.messages, { role: "user", content: question, at: askedAt, attached: [...attached] }, { role: "assistant", content: answer, at: answeredAt }] }), askedAt);
  // keep storage small: drop the oldest messages (whole chats first)
  const chats = [...getChats(s)];
  let total = chats.reduce((a, c) => a + c.messages.length, 0);
  while (total > MAX_SAVED_MESSAGES && chats.length > 1) { total -= chats[0].messages.length; chats.shift(); }
  if (total > MAX_SAVED_MESSAGES) chats[0] = { ...chats[0], messages: chats[0].messages.slice(total - MAX_SAVED_MESSAGES) };
  return { ...s, plainChats: chats };
};

/** chats, questions and time spent (first to last message of each chat) */
export const chatSummary = (subject) => {
  const chats = getChats(subject).filter(c => c.messages.length);
  const questions = chats.reduce((a, c) => a + c.messages.filter(m => m.role === "user").length, 0);
  const ms = chats.reduce((a, c) => a + ((c.messages.at(-1)?.at || 0) - (c.messages[0]?.at || 0)), 0);
  return { chats: chats.length, questions, minutes: Math.round(ms / 60000) };
};

// ── chat log CSV (point 25: what the Plain AI chat group did) ──
const COLUMNS = ["subject", "learner_code", "study_mode", "chat_no", "chat_started", "question_no", "asked_at", "seconds_to_answer", "attached", "question", "answer"];
const cell = (v) => { const s = v === undefined || v === null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const plainChatCsv = (subject, learnerCode = currentLearnerCode()) => {
  const rows = [];
  getChats(subject).forEach((c, ci) => {
    let qn = 0;
    for (let i = 0; i < c.messages.length; i++) {
      const m = c.messages[i], a = c.messages[i + 1];
      if (m.role !== "user") continue;
      qn++;
      rows.push([subject.name, learnerCode, "plain", ci + 1, c.startedAt ? new Date(c.startedAt).toISOString() : "", qn,
        m.at ? new Date(m.at).toISOString() : "", a?.at && m.at ? Math.round((a.at - m.at) / 1000) : "", (m.attached || []).join(" | "),
        m.content, a?.role === "assistant" ? a.content : ""]);
    }
  });
  return [COLUMNS, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
};
