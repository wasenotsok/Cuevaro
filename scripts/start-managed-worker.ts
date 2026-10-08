// Separate private development worker; never starts HTTP or applies migrations.
import { buildManagedDevelopmentServices } from "../services/api/managed";
import { runManagedWorker } from "../services/worker/managed";
let services:
  Awaited<ReturnType<typeof buildManagedDevelopmentServices>> | undefined;
try {
  services = await buildManagedDevelopmentServices();
  await services.ready();
  const stop = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => stop.abort());
  console.log(
    JSON.stringify({
      status: "private development worker running",
      scope: "approved synthetic tests only",
    }),
  );
  await runManagedWorker(services.runOnce, stop.signal, () =>
    console.error(
      JSON.stringify({ status: "retrying", code: "WORKER_OPERATION_FAILED" }),
    ),
  );
} catch {
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "MANAGED_WORKER_STARTUP_FAILED",
    }),
  );
  process.exitCode = 2;
} finally {
  if (services)
    try {
      await services.close();
    } catch {
      process.exitCode = 1;
    }
}
