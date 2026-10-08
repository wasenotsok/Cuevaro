import { createClient } from "@supabase/supabase-js";
import { authorize, type Actor, type Membership } from "../domain/authority";
import { z } from "zod";
// Server-only. Never imported from the mobile bundle. No credentials are created here.
export function managedBackend(
  url: string,
  publishableKey: string,
  serviceKey: string,
  transport: typeof fetch = fetch,
) {
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw Error("TLS_REQUIRED");
  const identity = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: transport },
  });
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: transport },
  });
  const verified = new WeakMap<Actor, string>();
  async function membership(actor: Actor, write: boolean) {
    const { data: m, error: me } = await db
      .from("household_memberships")
      .select("user_id,household_id,role,revoked_at")
      .eq("household_id", actor.householdId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (me) throw Error("AUTHORIZATION_UNAVAILABLE");
    if (
      m &&
      !z
        .object({
          user_id: z.uuid(),
          household_id: z.uuid(),
          role: z.enum(["owner", "member", "viewer"]),
          revoked_at: z.string().nullable(),
        })
        .safeParse(m).success
    )
      throw Error("AUTHORIZATION_UNAVAILABLE");
    authorize(
      actor,
      m
        ? ({
            userId: m.user_id,
            householdId: m.household_id,
            role: m.role,
            revoked: !!m.revoked_at,
          } as Membership)
        : undefined,
      write,
    );
  }
  async function revalidate(actor: Actor, write: boolean) {
    const token = verified.get(actor);
    if (!token) throw Error("UNVERIFIED_ACTOR");
    const { data, error } = await identity.auth.getUser(token);
    if (error || data.user?.id !== actor.userId) throw Error("UNAUTHENTICATED");
    await membership(actor, write);
  }
  return {
    async actor(
      token: string,
      householdId: string,
      write = false,
    ): Promise<Actor> {
      z.uuid().parse(householdId);
      const { data, error } = await identity.auth.getUser(token);
      if (error || !data.user) throw Error("UNAUTHENTICATED");
      const actor = Object.freeze({
        userId: z.uuid().parse(data.user.id),
        householdId,
      });
      await membership(actor, write);
      verified.set(actor, token);
      return actor;
    },
    async storeOriginal(
      actor: Actor,
      id: string,
      bytes: Uint8Array,
      mime: string,
    ) {
      await revalidate(actor, true);
      z.uuid().parse(id);
      if (
        bytes.length < 1 ||
        bytes.length > 20000000 ||
        !["image/jpeg", "image/png", "application/pdf"].includes(mime)
      )
        throw Error("INVALID_FILE");
      const path = `${actor.householdId}/${id}/original`;
      const { error } = await db.storage
        .from("evidence")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw Error("STORAGE_FAILED");
      return path;
    },
    async evidenceUrl(actor: Actor, evidenceId: string) {
      await revalidate(actor, false);
      z.uuid().parse(evidenceId);
      const { data, error } = await db
        .from("evidence_objects")
        .select("storage_key,capture_id,page_number")
        .eq("id", evidenceId)
        .eq("household_id", actor.householdId)
        .single();
      if (error || !data) throw Error("NOT_FOUND");
      const captureId = z.uuid().safeParse(data.capture_id);
      const page = z.number().int().min(1).max(10).safeParse(data.page_number);
      if (
        !captureId.success ||
        !page.success ||
        ![
          `${actor.householdId}/${captureId.data}/original-page-${page.data}`,
          ...(page.data === 1
            ? [`${actor.householdId}/${captureId.data}/original`]
            : []),
        ].includes(data.storage_key)
      )
        throw Error("INVALID_STORAGE_IDENTITY");
      // Recheck after the metadata read before issuing a bearer URL.
      await revalidate(actor, false);
      const result = await db.storage
        .from("evidence")
        .createSignedUrl(data.storage_key, 60);
      if (result.error) throw Error("STORAGE_FAILED");
      return result.data.signedUrl;
    },
  };
}
