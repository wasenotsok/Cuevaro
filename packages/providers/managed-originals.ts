import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  OriginalStore,
  EvidenceOriginal,
} from "../../services/api/originals";
import { assertActor } from "../../services/api/development";
import {
  managedDevelopmentUrl,
  managedDevelopmentRuntime,
} from "./managed-development";
import type { SqlQuery } from "./database";
import type { Actor } from "../domain/authority";
const metadata = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  captureId: z.uuid(),
  storageKey: z.string(),
  mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
  size: z.number().int().positive().max(20000000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  page: z.number().int().min(1).max(10),
});
export function managedOriginalStore(
  backend: ReturnType<typeof managedDevelopmentRuntime>,
  env: Readonly<Record<string, string | undefined>> = process.env,
  transport: typeof fetch = fetch,
): OriginalStore {
  // Revalidate configuration locally; never retrieve/create a credential.
  managedDevelopmentRuntime(env, transport);
  const client = createClient(
    managedDevelopmentUrl,
    env.CUEVARO_SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: transport },
    },
  );
  function validate(actor: Actor, e: EvidenceOriginal) {
    if (
      !metadata.safeParse(e).success ||
      actor.householdId !== e.householdId ||
      ![
        `${e.householdId}/${e.captureId}/original-page-${e.page}`,
        ...(e.page === 1 ? [`${e.householdId}/${e.captureId}/original`] : []),
      ].includes(e.storageKey)
    )
      throw Error("INVALID_STORAGE_IDENTITY");
  }
  async function workerIdentity(db: SqlQuery, actor: Actor, write = false) {
    const result = await client.auth.admin.getUserById(actor.userId);
    const user = result.data.user as typeof result.data.user & {
      banned_until?: string;
    };
    if (
      result.error ||
      !user ||
      user.id !== actor.userId ||
      (user.banned_until &&
        (!Number.isFinite(Date.parse(user.banned_until)) ||
          Date.parse(user.banned_until) > Date.now()))
    )
      throw Error("UNAUTHENTICATED");
    await assertActor(db, actor, write);
  }
  async function download(e: EvidenceOriginal) {
    const result = await client.storage.from("evidence").download(e.storageKey);
    if (result.error || !result.data) throw Error("STORAGE_FAILED");
    if (result.data.size !== e.size) throw Error("EVIDENCE_INTEGRITY");
    const bytes = new Uint8Array(await result.data.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== e.sha256)
      throw Error("EVIDENCE_INTEGRITY");
    return bytes;
  }
  return {
    verify: workerIdentity,
    async put(db, actor, e, bytes) {
      validate(actor, e);
      if (
        bytes.length !== e.size ||
        createHash("sha256").update(bytes).digest("hex") !== e.sha256
      )
        throw Error("EVIDENCE_INTEGRITY");
      await backend.verifyActor(actor, true);
      await assertActor(db, actor, true);
      // No-upsert means a retry can only reuse identical bytes after real readback.
      const uploaded = await client.storage
        .from("evidence")
        .upload(e.storageKey, bytes, { contentType: e.mime, upsert: false });
      // Includes lost upload acknowledgements: no durable SQL ACK until actual readback.
      // An existing mismatched object is never overwritten or deleted.
      const actual = await download(e);
      await backend.verifyActor(actor, true);
      if (actual.length !== bytes.length) throw Error("EVIDENCE_INTEGRITY");
      // A verified matching object is sufficient even if its upload ACK was lost.
      void uploaded;
    },
    async read(db, actor, e, write = false) {
      validate(actor, e);
      await workerIdentity(db, actor, write);
      const bytes = await download(e);
      await workerIdentity(db, actor, write);
      return bytes;
    },
  };
}
