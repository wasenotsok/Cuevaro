import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { buildManagedDevelopmentServices } from "../services/api/managed";
import {
  syntheticReceiptSvg,
  syntheticReceiptText,
} from "../packages/test-fixtures/receipt";
import { extractText } from "../packages/domain/purchase";
import type { PostgresPool } from "../packages/providers/postgres";
const household = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherHousehold = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const users = {
  owner: "11111111-1111-4111-8111-111111111111",
  member: "22222222-2222-4222-8222-222222222222",
  viewer: "33333333-3333-4333-8333-333333333333",
  foreign: "44444444-4444-4444-8444-444444444444",
};
const env = {
  CUEVARO_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_synthetic_fixture_only_000000",
  CUEVARO_SUPABASE_SERVICE_ROLE_KEY: "sb_secret_synthetic_fixture_only_000000",
  CUEVARO_POSTGRES_HOST: "db.wqwapaklrfpckhgjsejf.supabase.co",
  CUEVARO_POSTGRES_USER: "postgres",
  CUEVARO_POSTGRES_PASSWORD: "synthetic-no-login",
};
async function harness(realOcr = false) {
  const pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;create function storage.allow_only_operation(expected_operation text) returns boolean language sql stable as $$select coalesce(current_setting('storage.operation',true)=expected_operation,false)$$;`,
  );
  await pg.exec(
    `begin;${readFileSync("supabase/reviewed/phase1-development-baseline.sql", "utf8")}commit;`,
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20261008030442_managed_review_drafts.sql",
      "utf8",
    ),
  );
  await pg.query(
    "insert into households(id,name,region,timezone) values($1,'SYNTHETIC A','SG','Asia/Singapore'),($2,'SYNTHETIC B','SG','Asia/Singapore')",
    [household, otherHousehold],
  );
  for (const [role, uid] of Object.entries(users))
    await pg.query("insert into household_memberships values($1,$2,$3,null)", [
      role === "foreign" ? otherHousehold : household,
      uid,
      role === "foreign" ? "owner" : role,
    ]);
  const objects = new Map<string, Uint8Array>(),
    calls: { path: string; method: string }[] = [],
    releases: boolean[] = [];
  const state = {
    failSql: false,
    commitLost: false,
    uploadAckLost: false,
    downloadFail: false,
    deleted: false,
    corrupt: false,
    afterRead: undefined as undefined | (() => Promise<void>),
    afterExtract: undefined as undefined | (() => Promise<void>),
  };
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      ),
      path = url.pathname,
      method = init?.method ?? "GET";
    calls.push({ path, method });
    const response = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (path === "/auth/v1/user") {
      const token = new Headers(init?.headers)
        .get("authorization")
        ?.replace("Bearer synthetic-", "");
      const uid = users[token as keyof typeof users];
      return uid && !state.deleted
        ? response({
            id: uid,
            aud: "authenticated",
            created_at: "2026-10-08T00:00:00Z",
            app_metadata: {},
            user_metadata: { role: "owner" },
          })
        : response({ message: "Invalid token" }, 401);
    }
    if (path.startsWith("/auth/v1/admin/users/"))
      return state.deleted
        ? response({ message: "No user" }, 404)
        : response({
            id: path.split("/").at(-1),
            aud: "authenticated",
            created_at: "2026-10-08T00:00:00Z",
            app_metadata: {},
            user_metadata: {},
          });
    if (path === "/rest/v1/household_memberships") {
      const result = await pg.query(
        "select * from household_memberships where household_id=$1 and user_id=$2",
        [
          url.searchParams.get("household_id")!.slice(3),
          url.searchParams.get("user_id")!.slice(3),
        ],
      );
      return response(result.rows[0] ?? null);
    }
    if (path === "/rest/v1/evidence_objects") {
      const result = await pg.query(
        "select * from evidence_objects where id=$1 and household_id=$2",
        [
          url.searchParams.get("id")!.slice(3),
          url.searchParams.get("household_id")!.slice(3),
        ],
      );
      return result.rows[0]
        ? response(result.rows[0])
        : response({ message: "Not found" }, 404);
    }
    if (path.startsWith("/storage/v1/object/sign/"))
      return response({
        signedURL: "/object/sign/evidence/synthetic?token=synthetic-test-only",
      });
    const prefix = "/storage/v1/object/evidence/";
    if (path.startsWith(prefix)) {
      const key = decodeURIComponent(path.slice(prefix.length));
      if (method === "POST") {
        expect(new Headers(init?.headers).get("x-upsert")).toBe("false");
        if (objects.has(key))
          return response({ message: "Duplicate", statusCode: "409" }, 409);
        const body = init?.body;
        const bytes =
          body instanceof Uint8Array
            ? new Uint8Array(body)
            : body instanceof Blob
              ? new Uint8Array(await body.arrayBuffer())
              : undefined;
        if (!bytes) throw Error("Unexpected synthetic upload body");
        objects.set(key, bytes);
        if (state.uploadAckLost) {
          state.uploadAckLost = false;
          return response({ message: "Lost ACK" }, 503);
        }
        return response({ Key: `evidence/${key}` });
      }
      if (state.downloadFail) return response({ message: "Unavailable" }, 503);
      const bytes = objects.get(key);
      if (!bytes)
        return response({ message: "Not found", statusCode: "404" }, 404);
      const output = new Uint8Array(bytes);
      if (state.corrupt) output[0] ^= 1;
      if (state.afterRead) await state.afterRead();
      return new Response(output, { headers: { "Content-Type": "image/png" } });
    }
    throw Error("Unexpected synthetic HTTP route");
  };
  const connection = {
    async query<T>(sql: string, params?: unknown[]) {
      if (state.failSql && sql.includes("insert into jobs")) {
        state.failSql = false;
        throw Object.assign(Error("synthetic-sensitive-provider-detail"), {
          code: "40001",
        });
      }
      const result = await pg.query<T>(sql, params);
      if (state.commitLost && sql === "commit") {
        state.commitLost = false;
        throw Object.assign(Error("lost commit"), { code: "08006" });
      }
      return result;
    },
    release(destroy = false) {
      releases.push(destroy);
    },
  };
  const pool: PostgresPool = {
    query: (sql, params) => pg.query(sql, params),
    async connect() {
      return connection;
    },
    end: () => pg.close(),
  };
  const services = await buildManagedDevelopmentServices(
    env,
    transport,
    () => pool,
    realOcr
      ? undefined
      : async (_bytes, evidenceId) => {
          const draft = extractText(
            syntheticReceiptText,
            evidenceId,
            "questionable",
            "2026-10-08",
          );
          await state.afterExtract?.();
          return draft;
        },
  );
  const headers = (role: keyof typeof users = "owner", h = household) => ({
    authorization: `Bearer synthetic-${role}`,
    "x-cuevaro-household": h,
    "x-cuevaro-development": "synthetic-only",
  });
  const capture = async (
    clientId = randomUUID(),
    role: keyof typeof users = "owner",
    variant = "",
  ) =>
    services.api.inject({
      method: "POST",
      url: "/v1/captures",
      headers: headers(role),
      payload: {
        clientId,
        base64: (
          await sharp(
            Buffer.from(
              syntheticReceiptSvg().replace(
                "Not a real purchase",
                `Not a real purchase ${variant}`,
              ),
            ),
          )
            .png()
            .toBuffer()
        ).toString("base64"),
        useAnyway: true,
      },
    });
  return { pg, services, headers, capture, objects, calls, state, releases };
}
it("existing managed command/worker composition runs real local OCR, review, lifecycle, Stop and retrieval without a local byte table", async () => {
  const h = await harness(true);
  try {
    expect(
      (await h.pg.query("select to_regclass('private.evidence_bytes') present"))
        .rows[0],
    ).toEqual({ present: null });
    const response = await h.capture();
    expect(response.statusCode).toBe(200);
    expect(response.json().durable).toBe(true);
    const id = response.json().id;
    expect(await h.services.runOnce()).toBe(true);
    const draft = (
      await h.services.api.inject({
        url: `/v1/captures/${id}`,
        headers: h.headers(),
      })
    ).json();
    expect(draft.state).toBe("review_ready");
    expect(draft.draft.provider).toBe("tesseract-local");
    const values = Object.fromEntries(
      draft.draft.observations.map(
        (o: { field: string; value: string | null }) => [o.field, o.value],
      ),
    );
    const confirmed = await h.services.api.inject({
      method: "POST",
      url: `/v1/captures/${id}/confirm`,
      headers: h.headers(),
      payload: values,
    });
    expect(confirmed.statusCode).toBe(200);
    const record = confirmed.json();
    expect(
      record.events.some((e: { status: string }) => e.status === "active"),
    ).toBe(true);
    const stopped = await h.services.api.inject({
      method: "POST",
      url: `/v1/purchases/${record.id}/attention`,
      headers: h.headers(),
      payload: {
        version: record.version,
        command: { type: "stop", kind: "return" },
      },
    });
    expect(stopped.statusCode).toBe(200);
    const records = (
      await h.services.api.inject({
        url: "/v1/records",
        headers: h.headers("viewer"),
      })
    ).json();
    expect(
      records[0].cues
        .filter((c: { kind: string }) => c.kind === "return")
        .every((c: { state: string }) => c.state === "cancelled"),
    ).toBe(true);
    expect(
      (
        await h.services.api.inject({
          url: "/v1/fixture",
          headers: h.headers(),
        })
      ).statusCode,
    ).toBe(404);
  } finally {
    await h.services.close();
  }
});
it("upload readback and SQL rollback preserve immutable retry identity; uncertain commit is not acknowledged and replay finds one record", async () => {
  const h = await harness();
  try {
    const client = randomUUID();
    h.state.failSql = true;
    const failed = await h.capture(client);
    expect(failed.statusCode).toBe(400);
    expect(failed.body).not.toContain("synthetic-sensitive-provider-detail");
    expect((await h.pg.query("select * from captures")).rows).toHaveLength(0);
    expect(h.objects.size).toBe(1);
    const path = [...h.objects.keys()][0];
    const retry = await h.capture(client);
    expect(retry.statusCode).toBe(200);
    expect(h.objects.size).toBe(1);
    expect([...h.objects.keys()][0]).toBe(path);
    expect((await h.pg.query("select * from jobs")).rows).toHaveLength(1);
    const next = randomUUID();
    h.state.commitLost = true;
    const uncertain = await h.capture(next, "owner", "second");
    expect(uncertain.statusCode).toBe(400);
    expect(h.releases).toContain(true);
    const replay = await h.capture(next, "owner", "second");
    expect(replay.statusCode).toBe(200);
    expect(replay.json().duplicate).toBe(true);
    expect((await h.pg.query("select * from jobs")).rows).toHaveLength(2);
  } finally {
    await h.services.close();
  }
});
it("lost upload ACK is accepted only after exact readback; failed readback rolls SQL back without deleting original", async () => {
  const h = await harness();
  try {
    h.state.uploadAckLost = true;
    expect((await h.capture()).statusCode).toBe(200);
    const client = randomUUID();
    h.state.downloadFail = true;
    expect((await h.capture(client, "owner", "second")).statusCode).toBe(400);
    expect((await h.pg.query("select * from captures")).rows).toHaveLength(1);
    expect(h.objects.size).toBe(2);
    h.state.downloadFail = false;
    expect((await h.capture(client, "owner", "second")).statusCode).toBe(200);
    expect(h.objects.size).toBe(2);
  } finally {
    await h.services.close();
  }
});
it("missing tokens, viewer mutation, foreign household and revoked identities refuse access before upload", async () => {
  const h = await harness();
  try {
    expect(
      (await h.services.api.inject({ url: "/v1/records" })).statusCode,
    ).toBe(401);
    expect((await h.capture(randomUUID(), "viewer")).statusCode).toBe(403);
    expect(
      (
        await h.services.api.inject({
          url: "/v1/records",
          headers: h.headers("foreign"),
        })
      ).statusCode,
    ).toBe(403);
    await h.pg.query(
      "update household_memberships set revoked_at=now() where user_id=$1",
      [users.owner],
    );
    expect((await h.capture()).statusCode).toBe(403);
    expect(h.objects.size).toBe(0);
  } finally {
    await h.services.close();
  }
});
it("worker refuses corrupt bytes, deleted Auth user and revoked membership; no unbound extraction is committed", async () => {
  for (const kind of ["corrupt", "deleted", "revoked"]) {
    const h = await harness();
    try {
      expect((await h.capture()).statusCode).toBe(200);
      if (kind === "corrupt") h.state.corrupt = true;
      if (kind === "deleted") h.state.deleted = true;
      if (kind === "revoked")
        await h.pg.query(
          "update household_memberships set revoked_at=now() where user_id=$1",
          [users.owner],
        );
      await h.services.runOnce();
      expect(
        (await h.pg.query("select * from private.review_drafts")).rows,
      ).toHaveLength(0);
      expect((await h.pg.query("select state from captures")).rows[0]).toEqual({
        state: "failed",
      });
    } finally {
      await h.services.close();
    }
  }
});

it("expired worker leases cannot publish drafts, and private draft storage refuses clients/cross-tenant bindings", async () => {
  const h = await harness();
  try {
    const response = await h.capture();
    expect(response.statusCode).toBe(200);
    h.state.afterRead = async () => {
      await h.pg.query(
        "update jobs set leased_until=now()-interval '1 second' where state='processing'",
      );
    };
    await h.services.runOnce();
    expect(
      (await h.pg.query("select * from private.review_drafts")).rows,
    ).toHaveLength(0);
    expect((await h.pg.query("select state from captures")).rows[0]).toEqual({
      state: "failed",
    });
    const privileges = (
      await h.pg.query(
        "select has_table_privilege('authenticated','private.review_drafts','SELECT') reading,has_table_privilege('authenticated','private.review_drafts','INSERT') inserting,has_table_privilege('authenticated','private.review_drafts','TRUNCATE') truncating",
      )
    ).rows[0];
    expect(privileges).toEqual({
      reading: false,
      inserting: false,
      truncating: false,
    });
    await expect(
      h.pg.query(
        "insert into private.review_drafts(capture_id,household_id,draft) values($1,$2,'{}')",
        [response.json().id, otherHousehold],
      ),
    ).rejects.toThrow();
  } finally {
    await h.services.close();
  }
});

it("Auth deletion during extraction prevents publication even when SQL membership remains", async () => {
  const h = await harness();
  try {
    expect((await h.capture()).statusCode).toBe(200);
    h.state.afterExtract = async () => {
      h.state.deleted = true;
    };
    await h.services.runOnce();
    expect(
      (await h.pg.query("select * from private.review_drafts")).rows,
    ).toHaveLength(0);
    expect((await h.pg.query("select state from captures")).rows[0]).toEqual({
      state: "failed",
    });
  } finally {
    await h.services.close();
  }
});
it("missing evidence metadata cannot silently turn a two-page capture into partial extraction", async () => {
  const h = await harness();
  try {
    const bytes = await sharp(Buffer.from(syntheticReceiptSvg()))
      .png()
      .toBuffer();
    const second = await sharp(
      Buffer.from(
        syntheticReceiptSvg().replace(
          "Not a real purchase",
          "Not a real purchase page two",
        ),
      ),
    )
      .png()
      .toBuffer();
    const response = await h.services.api.inject({
      method: "POST",
      url: "/v1/captures",
      headers: h.headers(),
      payload: {
        clientId: randomUUID(),
        base64: bytes.toString("base64"),
        additionalPages: [second.toString("base64")],
        useAnyway: true,
      },
    });
    expect(response.statusCode).toBe(200);
    await h.pg.query(
      "delete from evidence_objects where capture_id=$1 and page_number=2",
      [response.json().id],
    );
    await h.services.runOnce();
    expect(
      (await h.pg.query("select * from private.review_drafts")).rows,
    ).toHaveLength(0);
    expect((await h.pg.query("select state from captures")).rows[0]).toEqual({
      state: "failed",
    });
  } finally {
    await h.services.close();
  }
});

it("managed construction with missing credentials cannot contact providers or allocate a database pool", async () => {
  let fetches = 0,
    pools = 0;
  await expect(
    buildManagedDevelopmentServices(
      {},
      async () => {
        fetches++;
        throw Error("Unexpected request");
      },
      () => {
        pools++;
        throw Error("Unexpected pool");
      },
    ),
  ).rejects.toThrow("MANAGED_CONFIGURATION_REQUIRED");
  expect(fetches).toBe(0);
  expect(pools).toBe(0);
});
it("private managed development rejects mutation without the synthetic-scope marker and fails readiness when its draft prerequisite is absent", async () => {
  const h = await harness();
  try {
    await h.services.ready();
    const headers = h.headers();
    delete (headers as Partial<typeof headers>)["x-cuevaro-development"];
    const response = await h.services.api.inject({
      method: "POST",
      url: "/v1/captures",
      headers,
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("DEVELOPMENT_ONLY");
    expect(h.objects.size).toBe(0);
    await h.pg.query(
      "alter table private.review_drafts disable row level security",
    );
    await expect(h.services.ready()).rejects.toThrow(
      "MANAGED_RUNTIME_MIGRATION_REQUIRED",
    );
  } finally {
    await h.services.close();
  }
});
