import { managedBackend } from "./supabase";

export const managedDevelopmentUrl = "https://wqwapaklrfpckhgjsejf.supabase.co";
type Environment = Readonly<Record<string, string | undefined>>;
// Syntax/role checks prevent accidental key swaps; only Supabase verifies keys.
function keyRole(value: string): string | undefined {
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return undefined;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}
function required(env: Environment, name: string): string {
  const value = env[name];
  if (!value || value.length > 8192 || /\s/.test(value))
    throw Error("MANAGED_CONFIGURATION_REQUIRED");
  return value;
}
export function requireManagedPublishableKey(value: string): string {
  if (
    value.length > 8192 ||
    /\s/.test(value) ||
    !(
      /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(value) ||
      keyRole(value) === "anon"
    )
  )
    throw Error("MANAGED_CONFIGURATION_INVALID");
  return value;
}
// Server-only composition. No .env loading, network access, persistence or listener.
// The named development target cannot be redirected through configuration.
export function managedDevelopmentRuntime(
  env: Environment = process.env,
  transport: typeof fetch = fetch,
) {
  const publishable = requireManagedPublishableKey(
    required(env, "CUEVARO_SUPABASE_PUBLISHABLE_KEY"),
  );
  const service = required(env, "CUEVARO_SUPABASE_SERVICE_ROLE_KEY");
  if (
    !(
      /^sb_secret_[A-Za-z0-9_-]{16,}$/.test(service) ||
      keyRole(service) === "service_role"
    ) ||
    publishable === service
  )
    throw Error("MANAGED_CONFIGURATION_INVALID");
  return managedBackend(managedDevelopmentUrl, publishable, service, transport);
}
