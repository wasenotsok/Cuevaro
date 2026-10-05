import { it, expect } from "vitest";
import { cleanupOwnedCache } from "../packages/domain/capture-cache";
it("cleans only preserved app-cache copies and retains originals on failure", async () => {
  const removed: string[] = [];
  const remove = async (uri: string) => {
    removed.push(uri);
  };
  const root = "file:///data/app/cache/";
  for (const uri of [
    "file:///data/app/photos/receipt.jpg",
    "file:///data/app/cache-other/receipt.jpg",
    "content://photos/receipt",
    "file:///data/app/cache/%2e%2e/private.jpg",
  ])
    await cleanupOwnedCache(uri, root, true, remove);
  await cleanupOwnedCache(root + "receipt.pdf", root, false, remove);
  expect(removed).toEqual([]);
  await cleanupOwnedCache(root + "picker/receipt.pdf", root, true, remove);
  expect(removed).toEqual([root + "picker/receipt.pdf"]);
});
