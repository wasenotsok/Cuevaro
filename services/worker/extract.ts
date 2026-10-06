import { createWorker } from "tesseract.js";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { extractText } from "../../packages/domain/purchase";
import { isPdf, extractPdf } from "./pdf";
const require = createRequire(import.meta.url);
// Local CPU OCR. No evidence is sent to a provider and language data is bundled.
export async function extractOriginal(
  bytes: Uint8Array,
  evidenceId: string,
  quality: "good" | "questionable",
  today: string,
) {
  if (isPdf(bytes)) return extractPdf(bytes, evidenceId, today);
  const data = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
  const worker = await createWorker("eng", 1, {
    langPath: join(data, "4.0.0"),
    cacheMethod: "none",
    gzip: true,
    logger: () => {},
  });
  try {
    const { data: ocr } = await worker.recognize(Buffer.from(bytes));
    const draft = extractText(ocr.text, evidenceId, quality, today);
    return {
      ...draft,
      provider: "tesseract-local",
      version: "tesseract-7+receipt-text-v3",
    };
  } finally {
    await worker.terminate();
  }
}
