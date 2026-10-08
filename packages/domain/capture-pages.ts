import type { Quality } from "./quality";
export function pageManifest(hashes: string[], sizes: number[]): string | null {
  if (
    hashes.length < 1 ||
    hashes.length > 10 ||
    hashes.length !== sizes.length ||
    hashes.some((h) => !/^[a-f0-9]{64}$/.test(h)) ||
    new Set(hashes).size !== hashes.length ||
    sizes.some((s) => !Number.isSafeInteger(s) || s < 1) ||
    sizes.reduce((a, b) => a + b, 0) > 20000000
  )
    throw Error("INVALID_PAGE_BUNDLE");
  return hashes.length === 1
    ? null
    : `cuevaro-page-bundle-v1:${JSON.stringify(hashes)}`;
}
export function pagesQuality(qualities: Quality[]): Quality {
  if (qualities.length < 1 || qualities.length > 10)
    throw Error("INVALID_PAGE_BUNDLE");
  return {
    grade: qualities.some((q) => q.grade === "bad")
      ? "bad"
      : qualities.some((q) => q.grade === "questionable")
        ? "questionable"
        : "good",
    findings: [...new Set(qualities.flatMap((q) => q.findings))],
    version: "quality-v2",
    limits: [...new Set(qualities.flatMap((q) => q.limits))],
  };
}
