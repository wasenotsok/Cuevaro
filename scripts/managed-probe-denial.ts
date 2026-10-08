// Verification evidence must distinguish authorization denial from outage/invalid requests.
export function expectedDenial(
  error: unknown,
  kind: "auth" | "database" | "storage",
): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };
  if (kind === "database")
    return (
      value.code === "42501" && [401, 403].includes(value.status as number)
    );
  if (kind === "auth") return value.status === 401 || value.status === 403;
  return [403, 404, "403", "404"].includes(value.statusCode as number | string);
}
export function requireExpectedDenial(
  error: unknown,
  kind: "auth" | "database" | "storage",
) {
  if (!expectedDenial(error, kind)) throw Error("API_DENIAL_INCONCLUSIVE");
}
