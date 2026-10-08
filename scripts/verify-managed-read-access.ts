// Read-only real API probe. Provisioned approved identities/fixtures must already exist.
// Credentials stay in the caller's process environment; never logged or persisted.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHash } from "node:crypto";
const url = "https://wqwapaklrfpckhgjsejf.supabase.co";
const key = process.env.CUEVARO_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.CUEVARO_APPROVED_USER_TOKEN;
const household = z.uuid().safeParse(process.env.CUEVARO_TEST_HOUSEHOLD_ID);
const path = process.env.CUEVARO_TEST_ORIGINAL_PATH;
const otherToken = process.env.CUEVARO_OTHER_APPROVED_USER_TOKEN;
async function run() {
  if (!key || !token || !household.success || !path) {
    console.log(
      JSON.stringify({
        status: "blocked",
        reason:
          "Existing secure process configuration and approved Auth identity/synthetic fixture required",
        project: "wqwapaklrfpckhgjsejf",
      }),
    );
    process.exitCode = 2;
    return;
  }
  const client = (authToken?: string) =>
    createClient(url, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: authToken
        ? { headers: { Authorization: `Bearer ${authToken}` } }
        : undefined,
    });
  const user = client(token);
  const identity = await user.auth.getUser(token);
  if (identity.error || !identity.data.user)
    throw Error("AUTH_IDENTITY_FAILED");
  const invalid = await client().auth.getUser("synthetic-invalid-token");
  if (!invalid.error) throw Error("INVALID_TOKEN_ACCEPTED");
  const anonymous = await client().from("households").select("id").limit(1);
  if (!anonymous.error) throw Error("ANONYMOUS_TABLE_ACCESS");
  const own = await user
    .from("households")
    .select("id")
    .eq("id", household.data);
  if (own.error || own.data?.length !== 1)
    throw Error("OWN_HOUSEHOLD_READ_FAILED");
  if (!path.startsWith(`${household.data}/`))
    throw Error("FOREIGN_FIXTURE_PATH");
  const metadata = await user
    .from("evidence_objects")
    .select("sha256,byte_size")
    .eq("household_id", household.data)
    .eq("storage_key", path)
    .single();
  if (
    metadata.error ||
    !metadata.data ||
    !/^[a-f0-9]{64}$/.test(metadata.data.sha256) ||
    !Number.isInteger(metadata.data.byte_size) ||
    metadata.data.byte_size < 1 ||
    metadata.data.byte_size > 20000000
  )
    throw Error("ORIGINAL_METADATA_FAILED");
  const original = await user.storage.from("evidence").download(path);
  if (original.error || !original.data)
    throw Error("AUTHENTICATED_ORIGINAL_READ_FAILED");
  if (
    original.data.size !== metadata.data.byte_size ||
    createHash("sha256")
      .update(new Uint8Array(await original.data.arrayBuffer()))
      .digest("hex") !== metadata.data.sha256
  )
    throw Error("ORIGINAL_INTEGRITY_FAILED");
  const signing = await user.storage
    .from("evidence")
    .createSignedUrl(path, 86400);
  if (!signing.error) throw Error("DIRECT_CLIENT_SIGNING_ALLOWED");
  const batch = await user.storage
    .from("evidence")
    .createSignedUrls([path], 86400);
  if (!batch.error && batch.data?.some((x) => x.signedUrl))
    throw Error("DIRECT_BATCH_SIGNING_ALLOWED");
  let foreign = "blocked: second approved identity unavailable";
  if (otherToken) {
    const other = client(otherToken);
    const auth = await other.auth.getUser(otherToken);
    if (
      auth.error ||
      !auth.data.user ||
      auth.data.user.id === identity.data.user.id
    )
      throw Error("SECOND_IDENTITY_INVALID");
    const rows = await other
      .from("households")
      .select("id")
      .eq("id", household.data);
    if (rows.error || rows.data?.length !== 0)
      throw Error("CROSS_HOUSEHOLD_READ_FAILED");
    const file = await other.storage.from("evidence").download(path);
    if (!file.error) throw Error("CROSS_HOUSEHOLD_ORIGINAL_ACCESS");
    foreign = "passed";
  }
  console.log(
    JSON.stringify({
      status: "partial API acceptance",
      project: "wqwapaklrfpckhgjsejf",
      authentication: "passed",
      anonymousDenial: "passed",
      ownerRead: "passed",
      privateDownload: "passed",
      originalIntegrity: "passed",
      directSigningDenial: "passed",
      foreignDenial: foreign,
      limitations: [
        "No uploads, mutations, revocation, signed URL expiry, backup/restore or native acceptance performed",
      ],
    }),
  );
}
run().catch((error) => {
  const known = new Set([
    "AUTH_IDENTITY_FAILED",
    "ORIGINAL_METADATA_FAILED",
    "ORIGINAL_INTEGRITY_FAILED",
    "INVALID_TOKEN_ACCEPTED",
    "ANONYMOUS_TABLE_ACCESS",
    "OWN_HOUSEHOLD_READ_FAILED",
    "FOREIGN_FIXTURE_PATH",
    "AUTHENTICATED_ORIGINAL_READ_FAILED",
    "DIRECT_CLIENT_SIGNING_ALLOWED",
    "DIRECT_BATCH_SIGNING_ALLOWED",
    "SECOND_IDENTITY_INVALID",
    "CROSS_HOUSEHOLD_READ_FAILED",
    "CROSS_HOUSEHOLD_ORIGINAL_ACCESS",
  ]);
  console.error(
    JSON.stringify({
      status: "failed",
      code:
        error instanceof Error && known.has(error.message)
          ? error.message
          : "MANAGED_API_PROBE_FAILED",
    }),
  );
  process.exitCode = 1;
});
