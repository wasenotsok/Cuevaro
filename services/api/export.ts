import { pageManifest } from "../../packages/domain/capture-pages";
import { createHash, randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { Actor } from "../../packages/domain/authority";
import { assertActor } from "./development";
import { getRecords } from "./records";
// Development-only snapshot: original files remain separate, not analytics or public URLs.
export async function exportRecord(
  db: PGlite,
  actor: Actor,
  purchaseId: string,
) {
  return db.transaction(async (tx) => {
    await assertActor(tx, actor);
    const record = (await getRecords(tx, actor, purchaseId))[0];
    if (!record) throw Error("NOT_FOUND");
    const rows = (
      await tx.query<{
        id: string;
        mime: string;
        size: number;
        hash: string;
        page: number;
        original: Uint8Array | null;
        captureHash: string;
      }>(
        `select c.content_hash as "captureHash",e.id,e.mime_type as mime,e.byte_size as size,e.sha256 as hash,e.page_number as page,b.original from purchases p join captures c on c.id=p.capture_id and c.household_id=p.household_id join evidence_objects e on e.capture_id=p.capture_id and e.household_id=p.household_id left join private.evidence_bytes b on b.evidence_id=e.id where p.id=$1 and p.household_id=$2 order by e.page_number`,
        [purchaseId, actor.householdId],
      )
    ).rows;
    if (
      !rows.length ||
      rows.length > 10 ||
      rows.reduce((n, r) => n + r.size, 0) > 20000000
    )
      throw Error("EXPORT_LIMIT");
    const originals = rows.map((r) => {
      if (
        !r.original ||
        r.original.length !== r.size ||
        createHash("sha256").update(r.original).digest("hex") !== r.hash
      )
        throw Error("EVIDENCE_INTEGRITY");
      return {
        id: r.id,
        page: r.page,
        mime: r.mime,
        size: r.size,
        sha256: r.hash,
        file: `originals/${r.id}${r.mime === "application/pdf" ? ".pdf" : r.mime === "image/jpeg" ? ".jpg" : ".png"}`,
        bytes: r.original,
      };
    });
    const hashManifest = pageManifest(
      rows.map((r) => r.hash),
      rows.map((r) => r.size),
    );
    const expected = hashManifest
      ? createHash("sha256").update(hashManifest).digest("hex")
      : rows[0].hash;
    if (
      expected !== rows[0].captureHash ||
      rows.some((r, i) => r.page !== i + 1)
    )
      throw Error("EVIDENCE_INTEGRITY");
    const manifest = {
      format: "cuevaro-record-export-v1",
      createdAt: new Date().toISOString(),
      environment: "synthetic-development-only",
      record,
      originals: originals.map(({ bytes, ...m }) => m),
    };
    await tx.query(
      `insert into audit_events(household_id,actor_id,event_type,entity_id,correlation_id) values($1,$2,'export_requested',$3,$4)`,
      [actor.householdId, actor.userId, purchaseId, randomUUID()],
    );
    return { manifest, originals };
  });
}
