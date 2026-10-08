import { it, expect } from "vitest";
import {
  postgresDatabase,
  type PostgresPool,
} from "../packages/providers/postgres";
import type { SqlQuery } from "../packages/providers/database";
import {
  managedPostgresConfiguration,
  managedPostgresDatabase,
} from "../packages/providers/managed-postgres";
const env = {
  CUEVARO_POSTGRES_HOST: "db.wqwapaklrfpckhgjsejf.supabase.co",
  CUEVARO_POSTGRES_USER: "postgres",
  CUEVARO_POSTGRES_PASSWORD: "synthetic-no-login",
};
function harness(fail?: string) {
  const calls: string[] = [],
    releases: boolean[] = [];
  const connection = {
    async query<T>(sql: string) {
      calls.push(sql);
      if (sql === fail)
        throw {
          code: "08006",
          message: "synthetic-password sql-sensitive-value",
        };
      return { rows: [{ value: 1 }] as T[] };
    },
    release(destroy = false) {
      releases.push(destroy);
    },
  };
  const pool: PostgresPool = {
    async query<T>(sql: string) {
      calls.push(`pool:${sql}`);
      return { rows: [] as T[] };
    },
    async connect() {
      calls.push("connect");
      return connection;
    },
    async end() {
      calls.push("end");
    },
  };
  return { db: postgresDatabase(pool), calls, releases };
}
it("every transaction uses one checked-out connection and escaped transactions close", async () => {
  const { db, calls, releases } = harness();
  let retained: SqlQuery | undefined;
  expect(
    await db.transaction(async (tx) => {
      retained = tx;
      await tx.query("select one");
      return 42;
    }),
  ).toBe(42);
  expect(calls).toEqual(["connect", "begin", "select one", "commit"]);
  expect(releases).toEqual([false]);
  await expect(retained!.query("escaped")).rejects.toThrow(
    "TRANSACTION_CLOSED",
  );
});
it("domain failure rolls back, while failed commit is uncertain and destroys the connection", async () => {
  const ordinary = harness();
  await expect(
    ordinary.db.transaction(async () => {
      throw Error("ACCESS_DENIED");
    }),
  ).rejects.toThrow("ACCESS_DENIED");
  expect(ordinary.calls).toEqual(["connect", "begin", "rollback"]);
  expect(ordinary.releases).toEqual([false]);
  const commit = harness("commit");
  await expect(
    commit.db.transaction(async () => "not-acknowledged"),
  ).rejects.toThrow("DATABASE_COMMIT_UNCERTAIN");
  expect(commit.releases).toEqual([true]);
  const rollback = harness("rollback");
  await expect(
    rollback.db.transaction(async () => {
      throw Error("QUALITY_REVIEW_REQUIRED");
    }),
  ).rejects.toThrow("QUALITY_REVIEW_REQUIRED");
  expect(rollback.releases).toEqual([true]);
});
it("provider failures are sanitized and begin/connect failures release safely", async () => {
  const h = harness("begin");
  await expect(h.db.transaction(async () => 0)).rejects.toThrow(
    "DATABASE_OPERATION_FAILED",
  );
  expect(h.releases).toEqual([true]);
  const db = postgresDatabase({
    query: async () => {
      throw Error("secret connection value");
    },
    connect: async () => {
      throw Error("secret connection value");
    },
    end: async () => {},
  });
  for (const call of [
    () => db.query("select sensitive"),
    () => db.transaction(async () => 0),
  ]) {
    try {
      await call();
      throw Error("unexpected success");
    } catch (e) {
      expect(String(e)).toBe("Error: DATABASE_OPERATION_FAILED");
      expect(JSON.stringify(e)).not.toContain("secret connection value");
    }
  }
});
it("named database configuration rejects wrong region/project and enforces certificate verification without connecting", () => {
  let pools = 0;
  const h = harness();
  managedPostgresDatabase(env, () => {
    pools++;
    return {
      query: h.db.query,
      connect: async () => {
        throw Error("No connection expected");
      },
      end: async () => {},
    };
  });
  expect(pools).toBe(1);
  expect(
    managedPostgresConfiguration({ ...env, PGSSLMODE: "disable" }),
  ).toMatchObject({
    port: 5432,
    ssl: { rejectUnauthorized: true },
    database: "postgres",
    max: 4,
  });
  for (const extra of [
    { CUEVARO_POSTGRES_HOST: "unrelated.example" },
    { CUEVARO_POSTGRES_HOST: "aws-1.us-east-1.pooler.supabase.com" },
    {
      CUEVARO_POSTGRES_HOST: "aws-1.ap-southeast-1.pooler.supabase.com",
      CUEVARO_POSTGRES_USER: "postgres.otherproject",
    },
    { CUEVARO_POSTGRES_USER: "postgres?sslmode=disable" },
  ])
    expect(() => managedPostgresConfiguration({ ...env, ...extra })).toThrow(
      "MANAGED_DATABASE_CONFIGURATION_INVALID",
    );
  expect(
    managedPostgresConfiguration({
      ...env,
      CUEVARO_POSTGRES_HOST: "aws-1.ap-southeast-1.pooler.supabase.com",
      CUEVARO_POSTGRES_USER: "postgres.wqwapaklrfpckhgjsejf",
    }).ssl.rejectUnauthorized,
  ).toBe(true);
  expect(() => managedPostgresConfiguration({})).toThrow(
    "MANAGED_DATABASE_CONFIGURATION_REQUIRED",
  );
});
