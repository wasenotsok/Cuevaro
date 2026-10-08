import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
it("reviewed atomic baseline matches its source manifest and rollback-only role checks preserve the empty database", async () => {
  const manifest = JSON.parse(
    readFileSync("supabase/reviewed/manifest.json", "utf8"),
  );
  const normalize = (text: string) => text.replace(/\r\n/g, "\n");
  const hash = (text: string) =>
    createHash("sha256").update(normalize(text)).digest("hex");
  for (const source of manifest.source_migrations)
    expect(hash(readFileSync(source.path, "utf8")), source.path).toBe(
      source.sha256,
    );
  const bundle = readFileSync(manifest.bundle.path, "utf8");
  expect(hash(bundle)).toBe(manifest.bundle.sha256);
  expect(bundle).not.toMatch(/^\s*(begin|commit);\s*$/im);
  const pg = new PGlite();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.allow_only_operation(expected_operation text) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=expected_operation or current_setting('storage.operation',true)='storage.'||expected_operation,false)$$;`);
    await pg.exec(`begin;${bundle}commit;`);
    await pg.exec(
      readFileSync("supabase/tests/managed-role-checks.sql", "utf8"),
    );
    await pg.exec(
      readFileSync(
        "supabase/tests/cuevaro-managed-supplemental-role-checks.sql",
        "utf8",
      ),
    );
    expect(
      (await pg.query("select * from public.households")).rows,
    ).toHaveLength(0);
    expect((await pg.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  } finally {
    await pg.close();
  }
});
