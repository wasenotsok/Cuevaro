import { pageManifest } from "../packages/domain/capture-pages";
import { strToU8 } from "fflate";
import { it, expect, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { recordArchive } from "../apps/mobile/export-record";
import type { Capture, RecordCache } from "../apps/mobile/storage";
const hash = async (b: Uint8Array) =>
  createHash("sha256").update(b).digest("hex");
const capture = async (): Promise<Capture> => {
  const bytes = new Uint8Array([1, 2, 3]);
  return {
    id: randomUUID(),
    hash: await hash(bytes),
    mime: "image/png",
    bytes,
    state: "confirmed",
    createdAt: "2026-10-06T00:00:00Z",
  };
};
const record = (c: Capture): RecordCache => ({
  id: randomUUID(),
  captureId: c.id,
  facts: [],
  events: [],
  cues: [],
  createdAt: c.createdAt,
  version: 1,
});
it("device ZIP roundtrips exact originals, JSON and retained replacements without network", async () => {
  const c = await capture(),
    retired = { ...(await capture()), bytes: new Uint8Array([4, 5]) };
  retired.hash = await hash(retired.bytes);
  c.retiredPageIds = [retired.id];
  const r = record(c),
    files = unzipSync(await recordArchive(r, [c, retired], hash));
  const manifest = JSON.parse(strFromU8(files["record.json"]));
  expect(manifest.encrypted).toBe(false);
  expect(manifest.record).toEqual(r);
  expect(manifest.originals).toHaveLength(2);
  expect(manifest.originals[1].role).toBe("retained_replacement");
  expect(files[manifest.originals[0].file]).toEqual(c.bytes);
  expect(files[manifest.originals[1].file]).toEqual(retired.bytes);
  expect(strFromU8(files["README.txt"])).toContain("not a cloud backup");
});
it("device ZIP refuses queued edits, missing/corrupt originals and unsafe archive filenames", async () => {
  const c = await capture(),
    r = record(c);
  await expect(
    recordArchive(
      {
        ...r,
        pendingCorrection: {
          mutationId: randomUUID(),
          version: 1,
          field: "merchant",
          value: "New",
        },
      },
      [c],
      hash,
    ),
  ).rejects.toThrow("PENDING_CORRECTION");
  await expect(recordArchive(r, [], hash)).rejects.toThrow("MISSING_ORIGINAL");
  await expect(
    recordArchive(r, [{ ...c, bytes: new Uint8Array([9]) }], hash),
  ).rejects.toThrow("EVIDENCE_INTEGRITY");
  c.retiredPageIds = [randomUUID()];
  await expect(recordArchive(r, [c], hash)).rejects.toThrow("MISSING_ORIGINAL");
  c.retiredPageIds = undefined;
  const unsafe = { ...c, id: "../unrelated" };
  await expect(
    recordArchive({ ...r, captureId: unsafe.id }, [unsafe], hash),
  ).rejects.toThrow("INVALID_ORIGINAL");
});
const mocks = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  available: true,
  share: vi.fn(async () => {}),
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => mocks.available,
  shareAsync: mocks.share,
}));
vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    name: string;
    constructor(_: unknown, name: string) {
      this.name = name;
      this.uri = "cache/" + name;
    }
    get exists() {
      return mocks.files.has(this.name);
    }
    create() {
      if (this.exists) throw Error("EXISTS");
      mocks.files.set(this.name, new Uint8Array());
    }
    write(b: Uint8Array) {
      mocks.files.set(this.name, b);
    }
    delete() {
      mocks.files.delete(this.name);
    }
  }
  return {
    File,
    Paths: {
      cache: {
        list: () => [...mocks.files.keys()].map((n) => new File(null, n)),
      },
    },
  };
});
import {
  deliverArchive,
  pendingExportCleanup,
} from "../apps/mobile/export-delivery.native";
it("native sharing adapter retains its owned temporary ZIP until cleanup, finds it after restart and preserves unrelated cache", async () => {
  mocks.files.clear();
  mocks.available = true;
  mocks.share.mockResolvedValue();
  mocks.files.set("original.png", new Uint8Array([8]));
  const cleanup = await deliverArchive(new Uint8Array([1, 2]));
  expect(mocks.share).toHaveBeenCalled();
  expect(mocks.files.size).toBe(2);
  const recovered = await pendingExportCleanup();
  expect(recovered).toBeDefined();
  recovered!();
  expect(mocks.files.size).toBe(1);
  expect(mocks.files.has("original.png")).toBe(true);
  cleanup!();
  mocks.available = false;
  await expect(deliverArchive(new Uint8Array([1]))).rejects.toThrow(
    "SHARING_UNAVAILABLE",
  );
  expect(mocks.files.size).toBe(1);
  mocks.available = true;
  mocks.share.mockRejectedValueOnce(Error("cancelled failure"));
  await expect(deliverArchive(new Uint8Array([1]))).rejects.toThrow();
  expect(mocks.files.size).toBe(1);
});

it("multi-page replaced-first-page archive retains ordering and earlier original; missing page and manifest corruption fail closed", async () => {
  const root = await capture(),
    page = await capture(),
    old = await capture();
  page.bytes = new Uint8Array([6, 7]);
  page.hash = await hash(page.bytes);
  old.bytes = new Uint8Array([8, 9]);
  old.hash = await hash(old.bytes);
  root.originalHash = root.hash;
  root.pageIds = [root.id, page.id];
  root.retiredPageIds = [old.id];
  root.hash = await hash(
    strToU8(
      pageManifest(
        [root.originalHash, page.hash],
        [root.bytes.length, page.bytes.length],
      )!,
    ),
  );
  const r = record(root),
    files = unzipSync(await recordArchive(r, [root, page, old], hash));
  const manifest = JSON.parse(strFromU8(files["record.json"]));
  expect(
    manifest.originals.map((m: { page: number | null }) => m.page),
  ).toEqual([1, 2, null]);
  for (const [i, c] of [root, page, old].entries())
    expect(files[manifest.originals[i].file]).toEqual(c.bytes);
  await expect(recordArchive(r, [root, old], hash)).rejects.toThrow(
    "MISSING_PAGE_ORIGINAL",
  );
  await expect(
    recordArchive(r, [{ ...root, hash: "a".repeat(64) }, page, old], hash),
  ).rejects.toThrow("EVIDENCE_INTEGRITY");
});
