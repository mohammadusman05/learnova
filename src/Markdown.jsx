import React from 'react';

// ============================================================
// Shows an AI answer the way ChatGPT does: headings, **bold**, *italic*, `code`, bullet and numbered lists,
// code blocks, quotes, tables and dividers — instead of the raw # and ** symbols (TA point 22, AI Chat).
// Built from React elements only (no HTML injection), so nothing in an answer can run as code.
// ============================================================
const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s\n][^*\n]*\*|_[^_\s\n][^_\n]*_)/g;
export const inline = (text, keyBase = "i") => String(text ?? "").split(INLINE).filter(p => p !== "").map((p, i) => {
  const k = `${keyBase}-${i}`;
  if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={k} style={{ fontFamily: "var(--mono)", fontSize: "0.9em", background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>{p.slice(1, -1)}</code>;
  if ((p.startsWith("**") && p.endsWith("**") || p.startsWith("__") && p.endsWith("__")) && p.length > 4) return <strong key={k}>{inline(p.slice(2, -2), k)}</strong>;
  if ((p.startsWith("*") && p.endsWith("*") || p.startsWith("_") && p.endsWith("_")) && p.length > 2) return <em key={k}>{p.slice(1, -1)}</em>;
  return <React.Fragment key={k}>{p}</React.Fragment>;
});

const H_SIZE = { 1: 19, 2: 17, 3: 15.5, 4: 14.5, 5: 14, 6: 14 };
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

/** text → list of blocks: {type: h|p|ul|ol|code|quote|hr|table, ...} */
export const parseBlocks = (text) => {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: "p", lines: para }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {                                  // code block
      flush(); const code = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: "code", text: code.join("\n") }); continue;
    }
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { flush(); blocks.push({ type: "h", level: h[1].length, text: h[2] }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ type: "hr" }); continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {   // table
      flush(); const head = cells(line), rows = [];
      for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--; blocks.push({ type: "table", head, rows }); continue;
    }
    const ul = line.match(/^(\s*)[-*•+]\s+(.*)$/), ol = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (ul || ol) {
      flush();
      const type = ul ? "ul" : "ol";
      const item = { level: Math.min(3, Math.floor((ul ? ul[1] : ol[1]).replace(/\t/g, "  ").length / 2)), text: ul ? ul[2] : ol[3], n: ol ? ol[2] : null, type };
      const last = blocks[blocks.length - 1];
      if (last && (last.type === "ul" || last.type === "ol") && (last.type === type || item.level > 0)) last.items.push(item);
      else blocks.push({ type, items: [item] });
      continue;
    }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) { flush(); const last = blocks[blocks.length - 1]; if (last?.type === "quote") last.lines.push(q[1]); else blocks.push({ type: "quote", lines: [q[1]] }); continue; }
    if (!line.trim()) { flush(); continue; }
    // a wrapped line right after a list item belongs to that item
    const last = blocks[blocks.length - 1];
    if (!para.length && last && (last.type === "ul" || last.type === "ol") && /^\s{2,}\S/.test(line)) { last.items[last.items.length - 1].text += " " + line.trim(); continue; }
    para.push(line);
  }
  flush();
  return blocks;
};

const Markdown = ({ text }) => (
  <div className="markdown" style={{ fontSize: 14, lineHeight: 1.75, color: "var(--t1)" }}>
    {parseBlocks(text).map((b, i) => {
      const k = `b${i}`;
      if (b.type === "h") return <div key={k} className={`md-h${b.level}`} style={{ fontSize: H_SIZE[b.level], fontWeight: 800, margin: i ? "14px 0 6px" : "0 0 6px", color: "var(--t1)" }}>{inline(b.text, k)}</div>;
      if (b.type === "p") return <p key={k} style={{ margin: "0 0 10px" }}>{b.lines.map((l, j) => <React.Fragment key={j}>{j ? <br /> : null}{inline(l, `${k}-${j}`)}</React.Fragment>)}</p>;
      if (b.type === "ul" || b.type === "ol") return (
        <div key={k} className={`md-${b.type}`} style={{ margin: "0 0 10px" }}>
          {b.items.map((it, j) => (
            <div key={j} style={{ display: "flex", gap: 8, marginLeft: it.level * 20, marginBottom: 3 }}>
              <span style={{ flexShrink: 0, minWidth: it.type === "ol" ? 20 : 10, color: "var(--t3)", fontWeight: 700 }}>{it.type === "ol" ? `${it.n}.` : (it.level ? "◦" : "•")}</span>
              <span style={{ flex: 1 }}>{inline(it.text, `${k}-${j}`)}</span>
            </div>
          ))}
        </div>
      );
      if (b.type === "code") return <pre key={k} style={{ margin: "0 0 10px", padding: "10px 12px", borderRadius: 8, background: "#0f172a", color: "#e2e8f0", fontFamily: "var(--mono)", fontSize: 12.5, overflowX: "auto", whiteSpace: "pre" }}>{b.text}</pre>;
      if (b.type === "quote") return <div key={k} style={{ margin: "0 0 10px", padding: "4px 12px", borderLeft: "3px solid var(--b1)", color: "var(--t2)" }}>{b.lines.map((l, j) => <div key={j}>{inline(l, `${k}-${j}`)}</div>)}</div>;
      if (b.type === "hr") return <hr key={k} style={{ border: "none", borderTop: "1px solid var(--b1)", margin: "12px 0" }} />;
      if (b.type === "table") return (
        <div key={k} style={{ overflowX: "auto", margin: "0 0 10px" }}>
          <table className="md-table" style={{ borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{b.head.map((c, j) => <th key={j} style={{ border: "1px solid var(--b1)", padding: "5px 9px", background: "var(--s3)", textAlign: "left" }}>{inline(c, `${k}-h${j}`)}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} style={{ border: "1px solid var(--b1)", padding: "5px 9px", verticalAlign: "top" }}>{inline(c, `${k}-${ri}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      return null;
    })}
  </div>
);
export default Markdown;
