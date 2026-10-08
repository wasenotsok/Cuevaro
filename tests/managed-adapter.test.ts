import { it, expect } from "vitest";
import { managedBackend } from "../packages/providers/supabase";
const uid = "11111111-1111-4111-8111-111111111111",
  h = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  capture = "22222222-2222-4222-8222-222222222222",
  evidence = "33333333-3333-4333-8333-333333333333";
function harness() {
  const state = {
    role: "owner",
    revoked: false,
    authenticated: true,
    path: `${h}/${capture}/original`,
    failMembership: false,
    failStorage: false,
    revokeOnMetadata: false,
    page: 1,
  };
  const calls: { path: string; body: unknown; headers: Headers }[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const path = url.pathname;
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ path, body, headers: new Headers(init?.headers) });
    const response = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (path === "/auth/v1/user")
      return state.authenticated
        ? response({
            id: uid,
            app_metadata: {},
            user_metadata: { role: "owner" },
            aud: "authenticated",
            created_at: "2026-10-08T00:00:00Z",
          })
        : response({ message: "Invalid token" }, 401);
    if (path === "/rest/v1/household_memberships")
      return state.failMembership
        ? response({ message: "Unavailable" }, 503)
        : response({
            user_id: uid,
            household_id: h,
            role: state.role,
            revoked_at: state.revoked ? "2026-10-08T00:00:00Z" : null,
          });
    if (path === "/rest/v1/evidence_objects") {
      if (state.revokeOnMetadata) state.revoked = true;
      return response({
        storage_key: state.path,
        capture_id: capture,
        page_number: state.page,
      });
    }
    if (path.startsWith("/storage/v1/object/sign/"))
      return state.failStorage
        ? response({ message: "Unavailable" }, 503)
        : response({
            signedURL: `/object/sign/evidence/${h}/${capture}/original?token=synthetic-test-only`,
          });
    if (path.startsWith("/storage/v1/object/"))
      return state.failStorage
        ? response({ message: "Unavailable" }, 503)
        : response({ Key: `evidence/${h}/${capture}/original` });
    throw Error("Unexpected synthetic transport route");
  };
  return {
    state,
    calls,
    backend: managedBackend(
      "https://synthetic.example",
      "synthetic-publishable",
      "synthetic-service",
      transport,
    ),
  };
}
it("managed adapter uses genuine client serialization, verified identity, tenant filters and immutable uploads", async () => {
  const { backend, calls } = harness();
  const actor = await backend.actor("synthetic-token", h, true);
  expect(Object.isFrozen(actor)).toBe(true);
  expect(
    await backend.storeOriginal(
      actor,
      capture,
      new Uint8Array([1, 2]),
      "image/png",
    ),
  ).toBe(`${h}/${capture}/original`);
  const upload = calls.find((c) => c.path.startsWith("/storage/"))!;
  expect(upload.headers.get("x-upsert")).toBe("false");
  expect(calls.filter((c) => c.path === "/auth/v1/user")).toHaveLength(2);
  await expect(backend.evidenceUrl({ ...actor }, evidence)).rejects.toThrow(
    "UNVERIFIED_ACTOR",
  );
});
it("managed signed URL validates metadata and repeats authorization before the bounded signing call", async () => {
  const { backend, calls } = harness();
  const actor = await backend.actor("synthetic-token", h);
  expect(await backend.evidenceUrl(actor, evidence)).toContain(
    "https://synthetic.example/storage/v1/object/sign/",
  );
  const signed = calls.find((c) =>
    c.path.startsWith("/storage/v1/object/sign/"),
  )!;
  expect(signed.body).toEqual({ expiresIn: 60 });
  expect(calls.filter((c) => c.path === "/auth/v1/user")).toHaveLength(3);
});
it("managed adapter refuses revoked, viewer-write, invalid-role and expired-token access before storage", async () => {
  for (const kind of ["revoked", "viewer", "role", "expired", "unavailable"]) {
    const { backend, state, calls } = harness();
    const actor = await backend.actor("synthetic-token", h);
    if (kind === "revoked") state.revoked = true;
    if (kind === "viewer") state.role = "viewer";
    if (kind === "role") state.role = "admin";
    if (kind === "expired") state.authenticated = false;
    if (kind === "unavailable") state.failMembership = true;
    await expect(
      backend.storeOriginal(actor, capture, new Uint8Array([1]), "image/png"),
    ).rejects.toThrow();
    expect(calls.some((c) => c.path.startsWith("/storage/"))).toBe(false);
  }
});
it("viewer reads are allowed while between-metadata revocation refuses signing", async () => {
  const { backend, state, calls } = harness();
  state.role = "viewer";
  const actor = await backend.actor("synthetic-token", h);
  state.revokeOnMetadata = true;
  await expect(backend.evidenceUrl(actor, evidence)).rejects.toThrow(
    "ACCESS_DENIED",
  );
  expect(calls.some((c) => c.path.startsWith("/storage/"))).toBe(false);
  state.revoked = false;
  state.revokeOnMetadata = false;
  await expect(backend.evidenceUrl(actor, evidence)).resolves.toContain(
    "/storage/v1/",
  );
});
it("foreign, traversal and wrong-page storage identities fail closed, while ordered-page paths remain valid", async () => {
  for (const path of [
    `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/${capture}/original`,
    `${h}/../original`,
    `${h}/${capture}/original-page-2`,
  ]) {
    const { backend, state, calls } = harness();
    state.path = path;
    const actor = await backend.actor("synthetic-token", h);
    await expect(backend.evidenceUrl(actor, evidence)).rejects.toThrow(
      "INVALID_STORAGE_IDENTITY",
    );
    expect(calls.some((c) => c.path.startsWith("/storage/"))).toBe(false);
  }
  const { backend, state } = harness();
  state.path = `${h}/${capture}/original-page-2`;
  state.page = 2;
  await expect(
    backend.evidenceUrl(await backend.actor("synthetic-token", h), evidence),
  ).resolves.toContain("/storage/v1/");
});
it("managed transport failures never claim durability or successful signing and retry does not upsert", async () => {
  const { backend, state, calls } = harness();
  const actor = await backend.actor("synthetic-token", h);
  state.failStorage = true;
  await expect(
    backend.storeOriginal(actor, capture, new Uint8Array([1]), "image/jpeg"),
  ).rejects.toThrow("STORAGE_FAILED");
  await expect(backend.evidenceUrl(actor, evidence)).rejects.toThrow(
    "STORAGE_FAILED",
  );
  state.failStorage = false;
  await expect(
    backend.storeOriginal(actor, capture, new Uint8Array([1]), "image/jpeg"),
  ).resolves.toBe(`${h}/${capture}/original`);
  expect(
    calls
      .filter(
        (c) =>
          c.path.startsWith("/storage/v1/object/") &&
          !c.path.includes("/sign/"),
      )
      .every((c) => c.headers.get("x-upsert") === "false"),
  ).toBe(true);
});
