import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  planManagedFixture,
  managedFixtureEvidenceSql,
} from "../packages/test-fixtures/managed-development";
const identities = {
  owner: "11111111-1111-4111-8111-111111111111",
  member: "22222222-2222-4222-8222-222222222222",
  viewer: "33333333-3333-4333-8333-333333333333",
  revoked: "44444444-4444-4444-8444-444444444444",
  foreign: "55555555-5555-4555-8555-555555555555",
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64",
);
it("fixture plans require five distinct valid IDs, reject unexpected sensitive fields, and never create Auth/Storage records", () => {
  for (const input of [
    { ...identities, owner: "';drop table households;--" },
    { ...identities, member: identities.owner },
    { ...identities, password: "synthetic-password" },
    { owner: identities.owner },
  ])
    expect(() => planManagedFixture(input, png)).toThrow(
      "FIVE_DISTINCT_APPROVED_IDENTITIES_REQUIRED",
    );
  expect(() => planManagedFixture(identities, new Uint8Array([1]))).toThrow(
    "SYNTHETIC_PNG_REQUIRED",
  );
  const a = planManagedFixture(identities, png),
    b = planManagedFixture(identities, png);
  expect(a.manifest.capture).not.toBe(b.manifest.capture);
  expect(a.setupSql).not.toMatch(
    /insert into (?:auth\.users|storage\.objects)|delete|truncate|drop|on conflict/i,
  );
  expect(a.manifest.status).toBe("local plan only");
});
it("evidence preparation refuses wrong bytes, foreign/traversal paths and changed metadata before SQL generation", () => {
  const { manifest } = planManagedFixture(identities, png);
  expect(() => managedFixtureEvidenceSql(manifest, png.subarray(1))).toThrow(
    "VERIFIED_UPLOAD_RECEIPT_MISMATCH",
  );
  for (const m of [
    { ...manifest, storageKey: "../original" },
    { ...manifest, household: manifest.foreignHousehold },
    { ...manifest, sha256: "a".repeat(64) },
    { ...manifest, byteSize: png.length + 1 },
    { ...manifest, project_ref: "other" },
  ])
    expect(() => managedFixtureEvidenceSql(m, png)).toThrow();
  const sql = managedFixtureEvidenceSql(
    JSON.parse(JSON.stringify(manifest)),
    png,
  );
  expect(sql).toContain("not_evaluated");
  expect(sql).not.toMatch(/storage\.objects|on conflict|delete|truncate/i);
});
it("reviewable setup fails atomically without actual approved Auth IDs, then preserves role isolation and immutable evidence metadata", async () => {
  const db = new PGlite();
  const { manifest, setupSql } = planManagedFixture(identities, png);
  try {
    await db.exec(
      `create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      readFileSync("supabase/migrations/202610050001_foundation.sql", "utf8"),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/202610060004_evidence_pages.sql",
        "utf8",
      ),
    );
    await expect(db.exec(setupSql)).rejects.toThrow(
      "Approved Auth identities missing",
    );
    await db.exec("rollback;");
    expect((await db.query("select * from households")).rows).toHaveLength(0);
    for (const id of Object.values(identities))
      await db.query("insert into auth.users values($1)", [id]);
    await db.exec(setupSql);
    for (const [role, id] of Object.entries(identities)) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      const access = await db.query<{ reading: boolean; writing: boolean }>(
        "select private.can_access($1) reading,private.can_access($1,true) writing",
        [manifest.household],
      );
      expect(access.rows[0]).toEqual({
        reading: ["owner", "member", "viewer"].includes(role),
        writing: ["owner", "member"].includes(role),
      });
    }
    const evidenceSql = managedFixtureEvidenceSql(manifest, png);
    await db.exec(evidenceSql);
    expect(
      (await db.query("select * from evidence_objects")).rows,
    ).toHaveLength(1);
    expect((await db.query("select * from audit_events")).rows).toHaveLength(1);
    await expect(db.exec(evidenceSql)).rejects.toThrow();
    await db.exec("rollback;");
    expect((await db.query("select * from captures")).rows).toHaveLength(1);
    expect(
      (await db.query("select * from evidence_objects")).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
});
