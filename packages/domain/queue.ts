export type PendingCapture = {
  id: string;
  hash: string;
  state: "local_pending" | "uploading" | "stored" | "failed";
  evidenceRef: string;
  serverId?: string;
  errorCode?: string;
};
export interface QueueStore {
  list(): Promise<PendingCapture[]>;
  put(capture: PendingCapture): Promise<void>;
}
export async function syncQueue(
  store: QueueStore,
  upload: (
    c: PendingCapture,
  ) => Promise<{ id: string; hash: string; durable: boolean }>,
) {
  for (const capture of await store.list()) {
    if (capture.state === "stored") continue;
    await store.put({ ...capture, state: "uploading", errorCode: undefined });
    try {
      const ack = await upload(capture);
      if (!ack.durable || ack.hash !== capture.hash) throw Error("INVALID_ACK");
      // Original is retained even after acknowledgment; cleanup is a separate explicit command.
      await store.put({
        ...capture,
        state: "stored",
        serverId: ack.id,
        errorCode: undefined,
      });
    } catch {
      await store.put({
        ...capture,
        state: "failed",
        errorCode: "UPLOAD_RETRY_REQUIRED",
      });
    }
  }
}
