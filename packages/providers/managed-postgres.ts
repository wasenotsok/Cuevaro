import { Pool } from "pg";
import { postgresDatabase } from "./postgres";
import type { PostgresPool } from "./postgres";
type Environment = Readonly<Record<string, string | undefined>>;
export function managedPostgresConfiguration(env: Environment = process.env) {
  const host = env.CUEVARO_POSTGRES_HOST,
    user = env.CUEVARO_POSTGRES_USER,
    password = env.CUEVARO_POSTGRES_PASSWORD;
  if (!host || !user || !password)
    throw Error("MANAGED_DATABASE_CONFIGURATION_REQUIRED");
  const direct = host === "db.wqwapaklrfpckhgjsejf.supabase.co";
  const pooler = /^aws-[0-9]+\.ap-southeast-1\.pooler\.supabase\.com$/.test(
    host,
  );
  if (
    (!direct && !pooler) ||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(user) ||
    (pooler && !user.endsWith(".wqwapaklrfpckhgjsejf")) ||
    password.length > 8192
  )
    throw Error("MANAGED_DATABASE_CONFIGURATION_INVALID");
  // Discrete fields avoid URL sslmode overrides; TLS verification is mandatory.
  return {
    host,
    user,
    password,
    database: "postgres",
    port: 5432,
    ssl: {
      rejectUnauthorized: true,
      ...(env.CUEVARO_POSTGRES_CA ? { ca: env.CUEVARO_POSTGRES_CA } : {}),
    },
    max: 4,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,
    enableChannelBinding: true,
  };
}
export function managedPostgresDatabase(
  env: Environment = process.env,
  makePool: (
    config: ReturnType<typeof managedPostgresConfiguration>,
  ) => PostgresPool = (config) => {
    const pool = new Pool(config);
    // An idle connection error must not log the connection/password or crash a process.
    pool.on("error", () => {});
    return pool as PostgresPool;
  },
) {
  return postgresDatabase(makePool(managedPostgresConfiguration(env)));
}
