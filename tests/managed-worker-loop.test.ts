import { it, expect } from "vitest";
import { runManagedWorker } from "../services/worker/managed";
import { boundedManagedFetch } from "../packages/providers/managed-fetch";
it("worker stop drains its in-flight job and prevents a second claim", async () => {
  const controller = new AbortController();
  let release!: () => void,
    calls = 0;
  const loop = runManagedWorker(async () => {
    calls++;
    await new Promise<void>((r) => (release = r));
    return true;
  }, controller.signal);
  controller.abort();
  expect(calls).toBe(1);
  release();
  await loop;
  expect(calls).toBe(1);
});
it("worker failure is sanitized by its caller hook and polling recovers", async () => {
  const stop = new AbortController();
  let attempts = 0,
    failures = 0;
  await runManagedWorker(
    async () => {
      attempts++;
      if (attempts === 1) throw Error("synthetic-sensitive-provider-detail");
      stop.abort();
      return true;
    },
    stop.signal,
    () => failures++,
    1,
  );
  expect(attempts).toBe(2);
  expect(failures).toBe(1);
});
it("provider calls combine caller cancellation with a hard deadline", async () => {
  let calls = 0;
  const transport: typeof fetch = async (_input, init) => {
    calls++;
    return await new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(Error("ABORTED")), {
        once: true,
      });
    });
  };
  await expect(
    boundedManagedFetch(transport, 5)("https://synthetic.example"),
  ).rejects.toThrow("ABORTED");
  expect(calls).toBe(1);
  const stop = new AbortController();
  stop.abort();
  await expect(
    boundedManagedFetch(transport)("https://synthetic.example", {
      signal: stop.signal,
    }),
  ).rejects.toThrow();
  expect(calls).toBe(1);
  expect(() => boundedManagedFetch(transport, 0)).toThrow(
    "INVALID_PROVIDER_DEADLINE",
  );
});
