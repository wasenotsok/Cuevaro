import { managedDevelopmentRuntime } from "../packages/providers/managed-development";
try {
  managedDevelopmentRuntime();
  console.log(
    JSON.stringify({
      status: "configured locally",
      project: "wqwapaklrfpckhgjsejf",
      networkCalls: 0,
      limitations: [
        "Key validity and managed API acceptance unverified; no application listener started",
      ],
    }),
  );
} catch (error) {
  const code =
    error instanceof Error &&
    [
      "MANAGED_CONFIGURATION_REQUIRED",
      "MANAGED_CONFIGURATION_INVALID",
    ].includes(error.message)
      ? error.message
      : "MANAGED_CONFIGURATION_FAILED";
  console.error(JSON.stringify({ status: "blocked", code }));
  process.exitCode = 2;
}
