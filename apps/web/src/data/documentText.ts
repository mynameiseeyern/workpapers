/**
 * Pulls the text out of a PDF or a picture, on this device. Nothing is sent anywhere.
 *
 * A PDF downloaded from a bank, registry or myGov carries its own text, which is read exactly.
 * A scan or a photo has no text in it, so it goes through OCR (Tesseract), which can misread a digit:
 * `how` says which way a document was read so the form can warn accordingly.
 *
 * Both libraries are large, so they are only loaded the first time a document is read.
 */
export interface DocumentText { text: string; how: "text" | "ocr" }

const absolute = (path: string) => new URL(path, window.location.href).href;

async function ocr(images: (HTMLCanvasElement | File)[], say: (s: string) => void): Promise<string> {
  const [{ createWorker }, worker, core] = await Promise.all([
    import("tesseract.js"),
    import("tesseract.js/dist/worker.min.js?url"),
    import("tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url"),
  ]);
  say("Getting ready to read the picture…");
  // The engine, its worker and the English data are all served by this app (see vite.config.ts), not a CDN.
  const w = await createWorker("eng", 1, { workerPath: absolute(worker.default), corePath: absolute(core.default), langPath: absolute("/ocr"), gzip: true });
  try {
    const pages: string[] = [];
    for (const [i, image] of images.entries()) {
      say(images.length > 1 ? `Reading page ${i + 1} of ${images.length}…` : "Reading the picture…");
      pages.push((await w.recognize(image)).data.text);
    }
    return pages.join("\n");
  } finally { await w.terminate(); }
}

/** Text items on a PDF page arrive as loose fragments; this puts fragments on the same line back together, left to right. */
function linesOf(items: { str: string; x: number; y: number }[]): string {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) < 3);
    if (row) row.parts.push(it); else rows.push({ y: it.y, parts: [it] });
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ")).join("\n");
}

const MAX_PAGES = 5;        // statements and invoices keep their figures up front
const MAX_OCR_PAGES = 2;    // OCR is slow; two pages is plenty for a receipt or invoice

async function fromPdf(file: File, say: (s: string) => void): Promise<DocumentText> {
  // The "legacy" build carries what older browsers (and iPhones a few versions back) are missing.
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(linesOf(content.items.flatMap((it) => ("str" in it ? [{ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number }] : []))));
    }
    const text = pages.join("\n");
    if (text.replace(/\s/g, "").length >= 20) return { text, how: "text" };

    // No text inside: it's a scan. Draw the first pages and read them as pictures.
    const canvases: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_OCR_PAGES); n++) {
      const page = await doc.getPage(n), viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    return { text: await ocr(canvases, say), how: "ocr" };
  } finally { await task.destroy(); }
}

/** Whether this kind of file can be read at all (HEIC photos can't; convert or screenshot them first). */
export const canRead = (file: File) => file.type === "application/pdf" || /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);

export async function documentText(file: File, say: (status: string) => void = () => {}): Promise<DocumentText> {
  say(`Reading ${file.name}…`);
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return fromPdf(file, say);
  return { text: await ocr([file], say), how: "ocr" };
}
