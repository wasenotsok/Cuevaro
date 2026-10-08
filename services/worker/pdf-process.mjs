// Trusted child entrypoint. No rendering, JavaScript execution, URLs or file writes.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
globalThis.fetch = async () => {
  throw Error("PDF_NETWORK_DISABLED");
};
const chunks = [];
let size = 0;
for await (const chunk of process.stdin) {
  size += chunk.length;
  if (size > 20000000) process.exit(2);
  chunks.push(chunk);
}
let task;
try {
  task = getDocument({
    data: new Uint8Array(Buffer.concat(chunks)),
    verbosity: 0,
    isEvalSupported: false,
    enableXfa: false,
    useWasm: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
    maxImageSize: 1,
    useWorkerFetch: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
  });
  const pdf = await task.promise;
  if (pdf.numPages < 1 || pdf.numPages > 10) throw Error("PDF_PAGE_LIMIT");
  const pages = [];
  let characters = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
      characters += item.str.length + 1;
      if (characters > 100000) throw Error("PDF_TEXT_LIMIT");
    }
    pages.push(text.trim());
    page.cleanup();
  }
  if (!pages.some((p) => p.trim())) throw Error("PDF_NO_TEXT");
  process.stdout.write(JSON.stringify({ pages }));
} catch (e) {
  const known = ["PDF_PAGE_LIMIT", "PDF_TEXT_LIMIT", "PDF_NO_TEXT"];
  const code =
    e?.name === "PasswordException"
      ? "PDF_PASSWORD_REQUIRED"
      : known.includes(e?.message)
        ? e.message
        : "PDF_INVALID";
  process.stdout.write(JSON.stringify({ error: code }));
} finally {
  await task?.destroy();
}
