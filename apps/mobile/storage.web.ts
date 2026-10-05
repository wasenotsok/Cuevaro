import type { Capture, RecordCache, LocalStore } from "./storage.native";
export type { Capture, RecordCache, LocalStore } from "./storage.native";
let opening: Promise<LocalStore> | undefined;
export async function openStore(): Promise<LocalStore> {
  if (opening) return opening;
  opening = webStore();
  try {
    return await opening;
  } catch (e) {
    opening = undefined;
    throw e;
  }
}
async function webStore(): Promise<LocalStore> {
  // Development browser preview only. No claim of encrypted device storage.
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("cuevaro-synthetic-dev", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("captures", { keyPath: "id" });
      req.result.createObjectStore("records", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(Error("LOCAL_STORAGE_UNAVAILABLE"));
  });
  const all = <T>(name: string) =>
    new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(name, "readonly"),
        req = tx.objectStore(name).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(Error("LOCAL_STORAGE_UNAVAILABLE"));
    });
  const write = (entries: [string, unknown][]) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [...new Set(entries.map((e) => e[0]))],
        "readwrite",
      );
      for (const [name, value] of entries) tx.objectStore(name).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(Error("LOCAL_STORAGE_FULL"));
      tx.onabort = () => reject(Error("LOCAL_STORAGE_FULL"));
    });
  return {
    captures: () => all<Capture>("captures"),
    saveCapture: (c) => write([["captures", c]]),
    records: () => all<RecordCache>("records"),
    saveRecord: (r, c) =>
      write([
        ["records", r],
        ["captures", c],
      ]),
  };
}
