import { it, expect } from "vitest";
import {
  managedDevelopmentRuntime,
  managedDevelopmentUrl,
  requireManagedPublishableKey,
} from "../packages/providers/managed-development";
const publicKey = "sb_publishable_synthetic_fixture_only_000000";
const serviceKey = "sb_secret_synthetic_fixture_only_000000";
const env = {
  CUEVARO_SUPABASE_PUBLISHABLE_KEY: publicKey,
  CUEVARO_SUPABASE_SERVICE_ROLE_KEY: serviceKey,
};
const jwt = (role: string) =>
  `synthetic.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.unsigned-fixture`;
it("managed composition is named-project-only, creates no network calls, and leaks no configuration through its interface", () => {
  let requests = 0;
  const runtime = managedDevelopmentRuntime(
    { ...env, SUPABASE_URL: "https://unrelated.example" },
    async () => {
      requests++;
      throw Error("No network expected");
    },
  );
  expect(requests).toBe(0);
  expect(Object.keys(runtime).sort()).toEqual([
    "actor",
    "evidenceUrl",
    "storeOriginal",
    "verifyActor",
  ]);
  expect(JSON.stringify(runtime)).not.toContain(serviceKey);
});
it("missing, swapped, malformed and whitespace-bearing credentials fail before transport without echoing values", () => {
  const variants = [
    {},
    { ...env, CUEVARO_SUPABASE_SERVICE_ROLE_KEY: undefined },
    { ...env, CUEVARO_SUPABASE_PUBLISHABLE_KEY: serviceKey },
    { ...env, CUEVARO_SUPABASE_SERVICE_ROLE_KEY: publicKey },
    { ...env, CUEVARO_SUPABASE_SERVICE_ROLE_KEY: "private\nheader" },
    { ...env, CUEVARO_SUPABASE_SERVICE_ROLE_KEY: jwt("authenticated") },
    { ...env, CUEVARO_SUPABASE_PUBLISHABLE_KEY: "{" },
  ];
  let calls = 0;
  for (const config of variants) {
    expect(() =>
      managedDevelopmentRuntime(config, async () => {
        calls++;
        throw Error("unexpected");
      }),
    ).toThrow(/^MANAGED_CONFIGURATION_(REQUIRED|INVALID)$/);
  }
  expect(calls).toBe(0);
});
it("modern and legacy role syntax are supported without claiming local cryptographic authentication", () => {
  expect(() =>
    managedDevelopmentRuntime({
      CUEVARO_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
      CUEVARO_SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
    }),
  ).not.toThrow();
});
it("configured runtime separates public identity and privileged tenant reads, rechecks revocation, and rejects stale/copied actors", async () => {
  const uid = "11111111-1111-4111-8111-111111111111",
    household = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let revoked = false;
  const calls: { url: URL; headers: Headers }[] = [];
  const runtime = managedDevelopmentRuntime(env, async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const headers = new Headers(init?.headers);
    calls.push({ url, headers });
    expect(url.origin).toBe(managedDevelopmentUrl);
    const body =
      url.pathname === "/auth/v1/user"
        ? {
            id: uid,
            app_metadata: {},
            user_metadata: { role: "owner" },
            aud: "authenticated",
            created_at: "2026-10-08T00:00:00Z",
          }
        : {
            user_id: uid,
            household_id: household,
            role: "member",
            revoked_at: revoked ? "2026-10-08T00:00:00Z" : null,
          };
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  });
  const actor = await runtime.actor("synthetic-user-token", household, true);
  expect(calls[0].headers.get("apikey")).toBe(publicKey);
  expect(calls[0].headers.get("authorization")).toBe(
    "Bearer synthetic-user-token",
  );
  expect(calls[1].headers.get("apikey")).toBe(serviceKey);
  expect(calls[1].url.searchParams.get("household_id")).toBe(`eq.${household}`);
  await expect(
    runtime.storeOriginal(
      { ...actor },
      household,
      new Uint8Array([1]),
      "image/png",
    ),
  ).rejects.toThrow("UNVERIFIED_ACTOR");
  revoked = true;
  await expect(
    runtime.storeOriginal(actor, household, new Uint8Array([1]), "image/png"),
  ).rejects.toThrow("ACCESS_DENIED");
  expect(calls.some((c) => c.url.pathname.startsWith("/storage/"))).toBe(false);
  const restarted = managedDevelopmentRuntime(env);
  await expect(restarted.evidenceUrl(actor, household)).rejects.toThrow(
    "UNVERIFIED_ACTOR",
  );
});

it("read-only probes reject privileged keys locally before using an API client", () => {
  for (const key of [
    serviceKey,
    jwt("service_role"),
    jwt("authenticated"),
    "unexpected-token",
    publicKey + "\n",
  ])
    expect(() => requireManagedPublishableKey(key)).toThrow(
      "MANAGED_CONFIGURATION_INVALID",
    );
  expect(requireManagedPublishableKey(publicKey)).toBe(publicKey);
  expect(requireManagedPublishableKey(jwt("anon"))).toBe(jwt("anon"));
});
