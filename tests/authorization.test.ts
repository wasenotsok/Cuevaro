import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { authorize } from "../packages/domain/authority";
import { managedBackend } from "../packages/providers/supabase";
it("managed service-role adapter refuses client-declared actor objects before any transport", async () => {
  const backend = managedBackend(
    "https://synthetic.example",
    "synthetic-publishable",
    "synthetic-service",
  );
  const actor = {
    userId: "11111111-1111-4111-8111-111111111111",
    householdId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
  await expect(
    backend.storeOriginal(
      actor,
      "22222222-2222-4222-8222-222222222222",
      new Uint8Array([1]),
      "image/jpeg",
    ),
  ).rejects.toThrow("UNVERIFIED_ACTOR");
  await expect(
    backend.evidenceUrl(actor, "22222222-2222-4222-8222-222222222222"),
  ).rejects.toThrow("UNVERIFIED_ACTOR");
});
it("denies missing, revoked, foreign and viewer write membership", () => {
  const actor = { userId: "a", householdId: "h" };
  for (const m of [
    undefined,
    { userId: "a", householdId: "h", role: "owner" as const, revoked: true },
    { userId: "b", householdId: "h", role: "owner" as const, revoked: false },
    {
      userId: "a",
      householdId: "other",
      role: "owner" as const,
      revoked: false,
    },
    { userId: "a", householdId: "h", role: "viewer" as const, revoked: false },
  ])
    expect(() => authorize(actor, m, true)).toThrow("ACCESS_DENIED");
});
it("actual Postgres RLS isolates tenants, denies escalation and applies revocation immediately", async () => {
  const pg = new PGlite();
  await pg.exec(
    `create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await pg.exec(
    readFileSync("supabase/migrations/202610050001_foundation.sql", "utf8"),
  );
  const uid = "11111111-1111-4111-8111-111111111111";
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${uid}';`);
  const { rows } = await pg.query<{ h: string }>(
    `select public.create_household('Synthetic home','PH','Asia/Manila') h`,
  );
  const h = rows[0].h;
  expect((await pg.query("select * from public.households")).rows).toHaveLength(
    1,
  );
  await expect(
    pg.exec(
      `insert into household_memberships values('${h}','22222222-2222-4222-8222-222222222222','owner',null)`,
    ),
  ).rejects.toThrow();
  await expect(
    pg.exec(`insert into captures default values`),
  ).rejects.toThrow();
  await pg.exec(
    `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'`,
  );
  expect((await pg.query("select * from public.households")).rows).toHaveLength(
    0,
  );
  await pg.exec(
    `reset role; update household_memberships set revoked_at=now(); set role authenticated; set request.jwt.claim.sub='${uid}'`,
  );
  expect((await pg.query("select * from public.households")).rows).toHaveLength(
    0,
  );
  await pg.close();
});
