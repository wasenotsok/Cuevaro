import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

it("removes broad provider default grants including RLS-bypassing TRUNCATE without removing tenant reads", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated;`);
    await pg.exec(
      readFileSync("supabase/migrations/202610050001_foundation.sql", "utf8"),
    );
    await pg.exec("create table public.unrelated_fixture(id integer);");
    // Reproduce exposure in an empty synthetic fixture; transaction always rolls back.
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select has_table_privilege('authenticated','public.cues','TRUNCATE') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    await pg.exec(
      "begin; set local role authenticated; truncate public.cues; rollback;",
    );
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select has_function_privilege('anon','public.create_household(text,text,text)','EXECUTE') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    await pg.exec(
      readFileSync(
        "supabase/migrations/202610060003_client_privileges.sql",
        "utf8",
      ),
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(
        (
          await pg.query<{ allowed: boolean }>(
            "select has_table_privilege($1,'public.unrelated_fixture','TRUNCATE') allowed",
            [role],
          )
        ).rows[0].allowed,
      ).toBe(true);
    }
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select has_table_privilege('service_role','public.cues','TRUNCATE') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    for (const role of ["anon", "authenticated"]) {
      for (const table of [
        "households",
        "household_memberships",
        "captures",
        "evidence_objects",
        "extraction_runs",
        "observations",
        "purchases",
        "items",
        "fact_assertions",
        "lifecycle_events",
        "cues",
        "jobs",
        "audit_events",
      ]) {
        for (const privilege of [
          "INSERT",
          "UPDATE",
          "DELETE",
          "TRUNCATE",
          "REFERENCES",
          "TRIGGER",
        ]) {
          const result = await pg.query<{ allowed: boolean }>(
            "select has_table_privilege($1,$2,$3) allowed",
            [role, `public.${table}`, privilege],
          );
          expect(result.rows[0].allowed, `${role}.${table}.${privilege}`).toBe(
            false,
          );
        }
      }
    }
    await pg.exec(
      "set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';",
    );
    await pg.exec(
      "select public.create_household('Synthetic household','PH','Asia/Manila');",
    );
    expect(
      (await pg.query("select * from public.households")).rows,
    ).toHaveLength(1);
    await expect(pg.exec("truncate public.cues")).rejects.toThrow(
      /permission denied/,
    );
    await pg.exec(
      "set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';",
    );
    expect(
      (await pg.query("select * from public.households")).rows,
    ).toHaveLength(0);
    await pg.exec("reset role; set role anon;");
    await expect(
      pg.exec("select public.create_household('Forbidden','PH','Asia/Manila')"),
    ).rejects.toThrow(/permission denied/);
    await expect(pg.exec("select * from public.households")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await pg.close();
  }
});
