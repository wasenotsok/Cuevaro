import { createHash } from "node:crypto";
import { pageManifest } from "../../packages/domain/capture-pages";
import type { SqlQuery } from "../../packages/providers/database";
import type { Actor } from "../../packages/domain/authority";
export interface EvidenceOriginal {
  id: string;
  householdId: string;
  captureId: string;
  storageKey: string;
  mime: string;
  size: number;
  sha256: string;
  page: number;
}
export function assertOriginalManifest(
  rows: { sha256: string; size: number; page: number }[],
  captureHash: string,
) {
  if (!rows.length || rows.length > 10 || rows.some((r, i) => r.page !== i + 1))
    throw Error("EVIDENCE_INTEGRITY");
  const manifest = pageManifest(
    rows.map((r) => r.sha256),
    rows.map((r) => r.size),
  );
  const actual = manifest
    ? createHash("sha256").update(manifest).digest("hex")
    : rows[0].sha256;
  if (actual !== captureHash) throw Error("EVIDENCE_INTEGRITY");
}
export interface OriginalStore {
  verify?(db: SqlQuery, actor: Actor, write?: boolean): Promise<void>;
  put(
    db: SqlQuery,
    actor: Actor,
    evidence: EvidenceOriginal,
    bytes: Uint8Array,
  ): Promise<void>;
  read(
    db: SqlQuery,
    actor: Actor,
    evidence: EvidenceOriginal,
    write?: boolean,
  ): Promise<Uint8Array>;
}
export const localOriginals: OriginalStore = {
  async put(db, _actor, evidence, bytes) {
    await db.query("insert into private.evidence_bytes values($1,$2)", [
      evidence.id,
      bytes,
    ]);
  },
  async read(db, _actor, evidence) {
    const { rows } = await db.query<{ original: Uint8Array }>(
      "select original from private.evidence_bytes where evidence_id=$1",
      [evidence.id],
    );
    if (!rows[0]) throw Error("EVIDENCE_INTEGRITY");
    return rows[0].original;
  },
};
