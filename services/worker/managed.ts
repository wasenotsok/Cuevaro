// Reuses runOneJob; separate process entrypoint is supplied by the development script.
export async function runManagedWorker(
  runOnce: () => Promise<boolean>,
  signal: AbortSignal,
  onFailure: () => void = () => {},
  intervalMs = 1000,
) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1)
    throw Error("INVALID_WORKER_INTERVAL");
  while (!signal.aborted) {
    try {
      await runOnce();
    } catch {
      onFailure();
    }
    if (signal.aborted) break;
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, intervalMs);
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
    });
  }
}
