import type { SqlDatabase, SqlQuery } from "./database";
export interface PostgresConnection extends SqlQuery {
  release(destroy?: boolean): void;
}
export interface PostgresPool extends SqlQuery {
  connect(): Promise<PostgresConnection>;
  end(): Promise<void>;
}
function failure(error: unknown): Error {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const allowed = [
    "23505",
    "23503",
    "23514",
    "40001",
    "40P01",
    "57014",
    "08006",
  ];
  return Object.assign(Error("DATABASE_OPERATION_FAILED"), {
    code: allowed.includes(code) ? code : "DATABASE_UNAVAILABLE",
  });
}
// Pool injection enables disposable SQL/transport tests, without a managed login.
export function postgresDatabase(
  pool: PostgresPool,
): SqlDatabase & { close(): Promise<void> } {
  return {
    async query<T>(sql: string, parameters?: unknown[]) {
      try {
        return await pool.query<T>(sql, parameters);
      } catch (error) {
        throw failure(error);
      }
    },
    async transaction<T>(callback: (tx: SqlQuery) => Promise<T>): Promise<T> {
      let client: PostgresConnection;
      try {
        client = await pool.connect();
      } catch (error) {
        throw failure(error);
      }
      let active = true,
        destroy = false;
      const tx: SqlQuery = {
        async query<R>(sql: string, parameters?: unknown[]) {
          if (!active) throw Error("TRANSACTION_CLOSED");
          try {
            return await client.query<R>(sql, parameters);
          } catch (error) {
            const safe = failure(error);
            if ((safe as Error & { code: string }).code === "08006")
              destroy = true;
            throw safe;
          }
        },
      };
      try {
        await tx.query("begin");
        const result = await callback(tx);
        active = false;
        try {
          await client.query("commit");
        } catch {
          destroy = true;
          throw Error("DATABASE_COMMIT_UNCERTAIN");
        }
        return result;
      } catch (error) {
        active = false;
        try {
          await client.query("rollback");
        } catch {
          destroy = true;
        }
        throw error;
      } finally {
        active = false;
        client.release(destroy);
      }
    },
    async close() {
      await pool.end();
    },
  };
}
