// Owner starts only after credential handoff and parent-reviewed migration application.
import { buildManagedDevelopmentServices } from "../services/api/managed";
let services:
  Awaited<ReturnType<typeof buildManagedDevelopmentServices>> | undefined;
try {
  services = await buildManagedDevelopmentServices();
  await services.ready();
  await services.api.listen({ host: "127.0.0.1", port: 4329 });
  console.log(
    JSON.stringify({
      status: "private development API listening",
      address: "http://127.0.0.1:4329",
      scope: "approved synthetic tests only",
      worker: "separate process",
      backup: false,
    }),
  );
  let closing = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, async () => {
      if (closing) return;
      closing = true;
      try {
        await services!.close();
      } catch {
        process.exitCode = 1;
      }
    });
} catch {
  if (services)
    try {
      await services.close();
    } catch {}
  console.error(
    JSON.stringify({ status: "blocked", code: "MANAGED_API_STARTUP_FAILED" }),
  );
  process.exitCode = 2;
}
