import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  extractText,
  draftSchema,
  fields,
} from "../../packages/domain/purchase";
export function isPdf(bytes: Uint8Array) {
  return Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
}
const output = z.union([
  z.object({ pages: z.array(z.string().max(100000)).min(1).max(10) }).strict(),
  z
    .object({
      error: z.enum([
        "PDF_PAGE_LIMIT",
        "PDF_TEXT_LIMIT",
        "PDF_NO_TEXT",
        "PDF_PASSWORD_REQUIRED",
        "PDF_INVALID",
      ]),
    })
    .strict(),
]);
// Process/heap/time/output bounds are containment, not an OS-level security sandbox.
export async function pdfText(
  bytes: Uint8Array,
  timeoutMs = 15000,
): Promise<string[]> {
  if (!isPdf(bytes) || bytes.length > 20000000)
    throw Error("PDF_INVALID_SIZE_OR_HEADER");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=192",
        fileURLToPath(new URL("./pdf-process.mjs", import.meta.url)),
      ],
      {
        stdio: ["pipe", "pipe", "ignore"],
        env: {
          NODE_ENV: "development",
          ...(process.env.SystemRoot
            ? { SystemRoot: process.env.SystemRoot }
            : {}),
        },
        windowsHide: true,
      },
    );
    let result = "",
      settled = false;
    const finish = (error?: Error, pages?: string[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(pages!);
    };
    const timer = setTimeout(
      () => finish(Error("PDF_PROCESS_TIMEOUT")),
      timeoutMs,
    );
    child.on("error", () => finish(Error("PDF_PROCESS_FAILED")));
    child.stdin.on("error", () => {});
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      result += chunk;
      if (result.length > 650000) finish(Error("PDF_OUTPUT_LIMIT"));
    });
    child.on("close", (code) => {
      if (settled) return;
      try {
        if (code !== 0) throw Error("PDF_PROCESS_FAILED");
        const parsed = output.parse(JSON.parse(result));
        if ("error" in parsed) throw Error(parsed.error);
        finish(undefined, parsed.pages);
      } catch (e) {
        finish(e instanceof Error ? e : Error("PDF_INVALID_OUTPUT"));
      }
    });
    child.stdin.end(bytes);
  });
}
export async function extractPdf(
  bytes: Uint8Array,
  evidenceId: string,
  today: string,
) {
  const pages = await pdfText(bytes);
  const drafts = pages.map((text) =>
    extractText(text, evidenceId, "questionable", today),
  );
  return draftSchema.parse({
    provider: "pdfjs-local-text",
    version: "pdfjs-6+receipt-text-v2",
    observations: fields.map((field) => {
      const observed = drafts.map((d) =>
        d.observations.find((o) => o.field === field)!,
      );
      const candidates = observed.filter((o) => o.value !== null);
      const values = new Set(candidates.map((o) => o.value));
      if (
        values.size === 1 &&
        !observed.some(
          (o) =>
            o.reason === "conflicting_document_fields" ||
            o.reason === "ambiguous_or_invalid_date",
        )
      ) {
        const first = candidates[0];
        return {
          ...first,
          pages: observed.flatMap((o, i) =>
            o.value === first.value ? [i + 1] : [],
          ),
        };
      }
      return {
        ...observed[0],
        value: null,
        confidence: "unknown",
        excerpt: "",
        reason:
          values.size > 1 ||
          observed.some((o) => o.reason === "conflicting_document_fields")
            ? "conflicting_document_fields"
            : (observed.find((o) => o.reason === "ambiguous_or_invalid_date")
                ?.reason ?? "missing"),
      };
    }),
  });
}
