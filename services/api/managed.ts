import { boundedManagedFetch } from "../../packages/providers/managed-fetch";
// Composition only: importing/building never listens, applies migrations, or creates users.
import { buildApi } from "./server";
import { runOneJob } from "./development";
import { extractOriginal } from "../worker/extract";
import { managedDevelopmentRuntime } from "../../packages/providers/managed-development";
import { managedOriginalStore } from "../../packages/providers/managed-originals";
import {
  managedPostgresDatabase,
  managedPostgresConfiguration,
} from "../../packages/providers/managed-postgres";
import type { PostgresPool } from "../../packages/providers/postgres";
export async function buildManagedDevelopmentServices(
  env: Readonly<Record<string, string | undefined>> = process.env,
  transport: typeof fetch = fetch,
  makePool?: (
    config: ReturnType<typeof managedPostgresConfiguration>,
  ) => PostgresPool,
  extract = extractOriginal,
) {
  const bounded = boundedManagedFetch(transport);
  const backend = managedDevelopmentRuntime(env, bounded);
  const store = managedOriginalStore(backend, env, bounded);
  const db = managedPostgresDatabase(env, makePool);
  try {
    const api = await buildApi(db, {
      originals: store,
      evidenceUrl: backend.evidenceUrl,
      async resolveActor(request, write) {
        const auth = request.headers.authorization;
        const household = request.headers["x-cuevaro-household"];
        if (
          typeof auth !== "string" ||
          auth.length > 8192 ||
          !/^Bearer [^\s]+$/.test(auth) ||
          typeof household !== "string"
        )
          throw Error("UNAUTHENTICATED");
        return backend.actor(auth.slice(7), household, write);
      },
    });
    return {
      api,
      async ready() {
        const check = await db.query<{ ready: boolean }>(
          "select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='review_drafts' and c.relrowsecurity) and exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname='review_drafts' and a.attname='household_id' and a.attnotnull) ready",
        );
        if (!check.rows[0]?.ready)
          throw Error("MANAGED_RUNTIME_MIGRATION_REQUIRED");
      },
      runOnce: () => runOneJob(db, extract, store),
      async close() {
        try {
          await api.close();
        } finally {
          await db.close();
        }
      },
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}
