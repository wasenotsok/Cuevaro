import { zipSync, strToU8 } from "fflate";
import type { RecordCache, Capture } from "./storage";
import { capturePages } from "./pages";
import { pageManifest } from "../../packages/domain/capture-pages";
export async function recordArchive(
  record: RecordCache,
  captures: Capture[],
  hash: (bytes: Uint8Array) => Promise<string>,
) {
  if (record.pendingCorrection) throw Error("PENDING_CORRECTION");
  const root = captures.find((c) => c.id === record.captureId);
  if (!root) throw Error("MISSING_ORIGINAL");
  const current = capturePages(root, captures);
  const originals = [
    ...current,
    ...(root.retiredPageIds ?? []).map((id) => {
      const c = captures.find((c) => c.id === id);
      if (!c) throw Error("MISSING_ORIGINAL");
      return c;
    }),
  ];
  if (
    new Set(originals.map((c) => c.id)).size !== originals.length ||
    originals.length > 20 ||
    originals.reduce((n, c) => n + c.bytes.length, 0) > 40000000
  )
    throw Error("EXPORT_LIMIT");
  const entries: Record<string, Uint8Array> = {};
  const manifest = [];
  for (const [i, c] of originals.entries()) {
    if (
      !/^[a-f0-9-]{36}$/.test(c.id) ||
      !["image/png", "image/jpeg", "application/pdf"].includes(c.mime)
    )
      throw Error("INVALID_ORIGINAL");
    const digest = await hash(c.bytes);
    if (digest !== (c.originalHash ?? c.hash))
      throw Error("EVIDENCE_INTEGRITY");
    const file = `originals/${c.id}${c.mime === "application/pdf" ? ".pdf" : c.mime === "image/jpeg" ? ".jpg" : ".png"}`;
    entries[file] = c.bytes;
    manifest.push({
      localCaptureId: c.id,
      file,
      mime: c.mime,
      size: c.bytes.length,
      sha256: digest,
      page: i < current.length ? i + 1 : null,
      role: i < current.length ? "current" : "retained_replacement",
    });
  }
  const joined = pageManifest(
    manifest.slice(0, current.length).map((m) => m.sha256),
    current.map((c) => c.bytes.length),
  );
  const expected = joined ? await hash(strToU8(joined)) : manifest[0].sha256;
  if (expected !== root.hash) throw Error("EVIDENCE_INTEGRITY");
  entries["record.json"] = strToU8(
    JSON.stringify(
      {
        format: "cuevaro-device-record-export-v1",
        createdAt: new Date().toISOString(),
        scope: "this-device-single-record",
        encrypted: false,
        record,
        originals: manifest,
      },
      null,
      2,
    ),
  );
  entries["README.txt"] = strToU8(
    "Cuevaro device export: record.json contains saved facts, original observations, history and cues. originals/ holds exact local evidence, including retained replacements. Local capture IDs are device IDs; source evidence IDs are preserved as recorded and are not asserted to be the same IDs. This ZIP is unencrypted. It is not a cloud backup or import/restore format. Queued corrections must be resolved before export.",
  );
  return zipSync(entries, { level: 0 });
}
