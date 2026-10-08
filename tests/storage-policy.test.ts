import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("actual PostgreSQL policy fixture reproduces client signing and repairs it without authorizing writes or foreign/revoked reads", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
    );
    await pg.exec(
      readFileSync("supabase/migrations/202610050001_foundation.sql", "utf8"),
    );
    await pg.exec(
      readFileSync(
        "supabase/migrations/202610060003_client_privileges.sql",
        "utf8",
      ),
    );
    // Disposable provider-schema fixture only. These rows are not real managed uploads.
    await pg.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
 create function storage.allow_only_operation(expected_operation text) returns boolean language sql stable as $$ select coalesce(regexp_replace(current_setting('storage.operation',true),'^storage\.','')=regexp_replace(expected_operation,'^storage\.',''),false) $$;grant execute on function storage.allow_only_operation(text) to authenticated;`);
    await pg.exec(
      readFileSync(
        "supabase/migrations/202610050002_private_storage.sql",
        "utf8",
      ),
    );
    const u = "11111111-1111-4111-8111-111111111111",
      h = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      capture = "22222222-2222-4222-8222-222222222222";
    await pg.exec(
      `insert into households values('${h}','Synthetic','PH','Asia/Manila',now());insert into household_memberships values('${h}','${u}','viewer',null);insert into captures(id,household_id,initiated_by_user_id,client_capture_id,state,content_hash,quality,captured_at) values('${capture}','${h}','${u}','${capture}','stored',repeat('a',64),'{}',now());insert into evidence_objects(household_id,capture_id,storage_key,mime_type,byte_size,sha256) values('${h}','${capture}','${h}/${capture}/original','image/png',1,repeat('a',64));insert into storage.objects(bucket_id,name) values('evidence','${h}/${capture}/original'),('evidence','unlinked'),('unrelated','${h}/${capture}/original');set role authenticated;set request.jwt.claim.sub='${u}';set storage.operation='storage.object.sign';`,
    );
    expect((await pg.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await pg.exec("reset role");
    await pg.exec(
      readFileSync(
        "supabase/migrations/20261008020853_storage_download_only.sql",
        "utf8",
      ),
    );
    for (const name of [
      "202610060004_evidence_pages.sql",
      "202610060005_item_facts.sql",
      "202610060006_correction_receipts.sql",
    ])
      await pg.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    const before = (
      await pg.query("select id from public.households order by id")
    ).rows;
    await pg.exec(
      readFileSync("supabase/tests/managed-role-checks.sql", "utf8"),
    );
    expect(
      (await pg.query("select id from public.households order by id")).rows,
    ).toEqual(before);
    await pg.exec("set role authenticated");
    for (const operation of [
      "object.sign",
      "storage.object.sign",
      "object.sign_many",
      "object.list",
      "object.get_authenticated_info",
      "object.upload",
      "object.upload_update",
      "storage.s3.object.get",
      "",
      "object.get_authenticated.extra",
    ]) {
      await pg.query("select set_config('storage.operation',$1,false)", [
        operation,
      ]);
      expect(
        (await pg.query("select * from storage.objects")).rows,
        operation,
      ).toHaveLength(0);
    }
    for (const operation of [
      "object.get_authenticated",
      "storage.object.get_authenticated",
    ]) {
      await pg.query("select set_config('storage.operation',$1,false)", [
        operation,
      ]);
      expect(
        (await pg.query("select * from storage.objects")).rows,
      ).toHaveLength(1);
    }
    await expect(
      pg.exec(
        "insert into storage.objects(bucket_id,name) values('evidence','forged')",
      ),
    ).rejects.toThrow(/permission denied/);
    await pg.exec(
      "set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333'",
    );
    expect((await pg.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await pg.exec(
      `reset role;update household_memberships set revoked_at=now() where household_id='${h}' and user_id='${u}';set role authenticated;set request.jwt.claim.sub='${u}'`,
    );
    expect((await pg.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  } finally {
    await pg.close();
  }
});
