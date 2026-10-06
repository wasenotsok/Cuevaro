import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type {
  Draft,
  ConfirmedFact,
  Lifecycle,
  Cue,
} from "../../packages/domain/purchase";
import type { Quality } from "../../packages/domain/quality";
import type { ReviewedItem } from "../../packages/domain/review-items";
import type { Correction, ItemFact } from "../../packages/domain/corrections";
export type Capture = {
  id: string;
  hash: string;
  mime: string;
  bytes: Uint8Array;
  createdAt: string;
  quality?: Quality;
  useAnyway?: boolean;
  state: "local_pending" | "review_ready" | "confirmed" | "failed";
  draft?: Draft;
  serverId?: string;
  pageIds?: string[];
  originalHash?: string;
  originalQuality?: Quality;
  groupParentId?: string;
  assemblySealed?: boolean;
  retiredPageIds?: string[];
};
export type RecordCache = {
  id: string;
  captureId: string;
  serverCaptureId?: string;
  facts: ConfirmedFact[];
  items?: ReviewedItem[];
  history?: ConfirmedFact[];
  itemHistory?: ItemFact[];
  pendingCorrection?: Correction;
  localExportEvents?: { id: string; requestedAt: string }[];
  events: Lifecycle[];
  cues: Cue[];
  createdAt: string;
  version: number;
};
export interface LocalStore {
  captures(): Promise<Capture[]>;
  saveCapture(c: Capture): Promise<void>;
  saveCaptures(captures: Capture[]): Promise<void>;
  records(): Promise<RecordCache[]>;
  saveRecord(r: RecordCache, c: Capture): Promise<void>;
}
let opening: Promise<LocalStore> | undefined;
export async function openStore(): Promise<LocalStore> {
  if (opening) return opening;
  opening = nativeStore();
  try {
    return await opening;
  } catch (e) {
    opening = undefined;
    throw e;
  }
}
async function nativeStore(): Promise<LocalStore> {
  const db = await SQLite.openDatabaseAsync("cuevaro-private.db");
  const cipher = await db.getFirstAsync<Record<string, string>>(
    "PRAGMA cipher_version",
  );
  if (!cipher || !Object.values(cipher).some(Boolean)) {
    await db.closeAsync();
    throw Error(
      "Encrypted storage requires a Cuevaro development build. Expo Go is unsupported.",
    );
  }
  let key = await SecureStore.getItemAsync("cuevaro.db.key");
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync("cuevaro.db.key", key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw Error("INVALID_STORAGE_KEY");
  await db.execAsync(
    `PRAGMA key="x'${key}'"; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_captures(id TEXT PRIMARY KEY, metadata TEXT NOT NULL, original BLOB NOT NULL); CREATE TABLE IF NOT EXISTS local_records(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);`,
  );
  const save = async (d: SQLite.SQLiteDatabase, c: Capture) => {
    const { bytes, ...metadata } = c;
    await d.runAsync(
      "INSERT OR REPLACE INTO local_captures VALUES(?,?,?)",
      c.id,
      JSON.stringify(metadata),
      bytes,
    );
  };
  return {
    captures: async () =>
      (
        await db.getAllAsync<{ metadata: string; original: Uint8Array }>(
          "SELECT metadata,original FROM local_captures",
        )
      ).map((r) => ({ ...JSON.parse(r.metadata), bytes: r.original })),
    saveCapture: (c) => save(db, c),
    saveCaptures: (cs) =>
      db.withExclusiveTransactionAsync(async (tx) => {
        for (const c of cs) await save(tx, c);
      }),
    records: async () =>
      (
        await db.getAllAsync<{ metadata: string }>(
          "SELECT metadata FROM local_records",
        )
      ).map((r) => JSON.parse(r.metadata)),
    saveRecord: async (r, c) => {
      await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync(
          "INSERT OR REPLACE INTO local_records VALUES(?,?)",
          r.id,
          JSON.stringify(r),
        );
        await save(tx, c);
      });
    },
  };
}
