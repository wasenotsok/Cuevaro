// Shared SQL shape used by the existing application commands and workers.
// PGlite remains the disposable/local implementation; managed PostgreSQL uses one
// checked-out connection for the whole transaction.
export interface SqlQuery {
  query<T = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface SqlDatabase extends SqlQuery {
  transaction<T>(callback: (tx: SqlQuery) => Promise<T>): Promise<T>;
}
