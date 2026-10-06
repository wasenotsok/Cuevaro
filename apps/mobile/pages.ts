import type { Capture } from "./storage";
import {
  pageManifest,
  pagesQuality,
} from "../../packages/domain/capture-pages";
export function capturePages(root: Capture, all: Capture[]): Capture[] {
  const ids = root.pageIds ?? [root.id];
  if (ids.length < 1 || ids.length > 10 || new Set(ids).size !== ids.length)
    throw Error("INVALID_PAGE_BUNDLE");
  return ids.map((id) => {
    const page = id === root.id ? root : all.find((c) => c.id === id);
    if (!page || !page.bytes.length) throw Error("MISSING_PAGE_ORIGINAL");
    return page;
  });
}
// Caller supplies SHA-256, keeping this assembly logic platform-neutral/testable.
export async function assemblePage(
  root: Capture,
  page: Capture,
  all: Capture[],
  hashText: (s: string) => Promise<string>,
  replaceIndex?: number,
): Promise<Capture[]> {
  if (
    root.assemblySealed ||
    root.serverId ||
    root.draft ||
    root.state === "confirmed"
  )
    throw Error("ASSEMBLY_ALREADY_SEALED");
  if (
    !root.mime.startsWith("image/") ||
    !page.mime.startsWith("image/") ||
    page.assemblySealed ||
    page.serverId ||
    page.draft ||
    page.pageIds ||
    page.state === "confirmed" ||
    (page.groupParentId && page.groupParentId !== root.id)
  )
    throw Error("PHOTO_PAGES_ONLY");
  const current = capturePages(root, all),
    ids = current.map((c) => c.id);
  if (replaceIndex === undefined) ids.push(page.id);
  else {
    if (
      !Number.isInteger(replaceIndex) ||
      replaceIndex < 0 ||
      replaceIndex >= ids.length
    )
      throw Error("INVALID_PAGE_NUMBER");
    ids[replaceIndex] = page.id;
  }
  const originals = ids.map((id) =>
    id === page.id ? page : current.find((c) => c.id === id)!,
  );
  const hashes = originals.map((c) => c.originalHash ?? c.hash),
    manifest = pageManifest(
      hashes,
      originals.map((c) => c.bytes.length),
    );
  const qs = originals.map((c) => c.originalQuality ?? c.quality);
  if (qs.some((q) => !q)) throw Error("PAGE_QUALITY_REQUIRED");
  const retired = [
    ...new Set([
      ...(root.retiredPageIds ?? []),
      ...(replaceIndex === undefined ? [] : [current[replaceIndex].id]),
    ]),
  ].filter((id) => !ids.includes(id));
  const updated: Capture = {
    ...root,
    pageIds: ids,
    retiredPageIds: retired,
    originalHash: root.originalHash ?? root.hash,
    originalQuality: root.originalQuality ?? root.quality,
    hash: manifest ? await hashText(manifest) : hashes[0],
    quality: pagesQuality(qs as NonNullable<Capture["quality"]>[]),
    state: "local_pending",
    useAnyway: false,
  };
  return [updated, { ...page, groupParentId: root.id }];
}
