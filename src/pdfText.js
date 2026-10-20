// ============================================================
// PDF TEXT  (TA point 6 follow-up)
// Reads the text of a PDF directly in the browser with pdf.js,
// instead of asking Claude to retype it. Same text every time,
// the whole PDF, no API cost. pdf.js is loaded only when a PDF
// is uploaded, so the app's first load stays small.
// ============================================================

// Turn pdf.js text items into readable lines
export const itemsToText = (items = []) => {
  let out = "";
  for (const it of items) {
    if (typeof it?.str !== "string") continue;
    out += it.str;
    if (it.hasEOL) out += "\n";
    else if (it.str && !/\s$/.test(it.str)) out += " ";
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
};

// A PDF made of page photos (scanned) has almost no selectable text
export const looksScanned = (text = "", numPages = 1) =>
  text.replace(/\s/g, "").length < 40 * Math.max(1, numPages);

// Read every page's text. Keeps the original buffer usable (a copy is sent to pdf.js).
export const extractPdfText = async (arrayBuffer) => {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
  const pdf = await task.promise;
  const numPages = pdf.numPages;
  const pages = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(itemsToText(content.items));
    page.cleanup();
  }
  // free memory; never let clean-up throw away the text we just read
  try { await (typeof task.destroy === "function" ? task.destroy() : pdf.cleanup?.()); } catch { /* ignore */ }
  return { text: pages.join("\n\n"), numPages, pages }; // pages: text of each page, for page citations (point 11)
};
