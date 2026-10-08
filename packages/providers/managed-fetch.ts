// Node-only provider transport. Explicit deadlines do not weaken TLS or retry writes.
export function boundedManagedFetch(
  transport: typeof fetch = fetch,
  timeoutMs = 30000,
): typeof fetch {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000)
    throw Error("INVALID_PROVIDER_DEADLINE");
  return async (input, init) => {
    const upstream =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = upstream ? AbortSignal.any([upstream, deadline]) : deadline;
    signal.throwIfAborted();
    return transport(input, { ...init, signal });
  };
}
