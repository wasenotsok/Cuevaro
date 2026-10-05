export type Finding =
  | "blur"
  | "glare"
  | "low_light"
  | "faded"
  | "small_text"
  | "cut_off"
  | "skew"
  | "occlusion"
  | "multiple_documents"
  | "unverified_edges";
export type Quality = {
  grade: "good" | "questionable" | "bad";
  findings: Finding[];
  version: "quality-v1";
  limits: string[];
};
export type ImageSignals = {
  width: number;
  height: number;
  luminance: Uint8Array;
  edgeComplete?: boolean;
  skewDegrees?: number;
  occluded?: boolean;
  documentCount?: number;
  textHeightPx?: number;
};
// Conservative preflight, not calibrated document understanding. Geometry/OCR checks
// must supply measurements; absent edge detection cannot imply complete evidence.
export function qualityGate(s: ImageSignals): Quality {
  if (s.width < 1 || s.height < 1 || s.luminance.length !== s.width * s.height)
    throw Error("INVALID_IMAGE");
  const f: Finding[] = [];
  let bad = false;
  let sum = 0,
    sum2 = 0,
    bright = 0,
    dark = 0,
    lapSum = 0,
    lap2 = 0,
    n = 0;
  for (const v of s.luminance) {
    sum += v;
    sum2 += v * v;
    if (v > 250) bright++;
    if (v < 24) dark++;
  }
  const mean = sum / s.luminance.length,
    contrast = Math.sqrt(Math.max(0, sum2 / s.luminance.length - mean * mean));
  for (let y = 1; y < s.height - 1; y++)
    for (let x = 1; x < s.width - 1; x++) {
      const i = y * s.width + x,
        l =
          4 * s.luminance[i] -
          s.luminance[i - 1] -
          s.luminance[i + 1] -
          s.luminance[i - s.width] -
          s.luminance[i + s.width];
      lapSum += l;
      lap2 += l * l;
      n++;
    }
  const sharpness = n ? lap2 / n - (lapSum / n) ** 2 : 0;
  if (mean < 45 || dark / s.luminance.length > 0.8) {
    f.push("low_light");
    bad = true;
  }
  if (contrast < 14) {
    f.push("faded");
    bad = true;
  } else if (contrast < 25) f.push("faded");
  if (sharpness < 12) {
    f.push("blur");
    bad = true;
  } else if (sharpness < 65) f.push("blur");
  // White paper alone is not glare. Bright saturated regions need broader evidence.
  if (bright / s.luminance.length > 0.93 && contrast < 10) {
    f.push("glare");
    bad = true;
  }
  if (
    Math.min(s.width, s.height) < 400 ||
    (s.textHeightPx !== undefined && s.textHeightPx < 10)
  ) {
    f.push("small_text");
    if (
      Math.min(s.width, s.height) < 200 ||
      (s.textHeightPx !== undefined && s.textHeightPx < 5)
    )
      bad = true;
  }
  if (s.edgeComplete === false) {
    f.push("cut_off");
    bad = true;
  }
  if (s.edgeComplete === undefined) f.push("unverified_edges");
  if (s.skewDegrees !== undefined && Math.abs(s.skewDegrees) > 15) {
    f.push("skew");
    if (Math.abs(s.skewDegrees) > 40) bad = true;
  }
  if (s.occluded) {
    f.push("occlusion");
    bad = true;
  }
  if (s.documentCount !== undefined && s.documentCount > 1)
    f.push("multiple_documents");
  return {
    grade: bad ? "bad" : f.length ? "questionable" : "good",
    findings: f,
    version: "quality-v1",
    limits: [
      "Heuristic thresholds are provisional; physical-receipt benchmark and edge/occlusion detector validation remain open.",
    ],
  };
}
export function mayExtract(q: Quality, useAnyway: boolean): boolean {
  return q.grade === "good" || (q.grade === "questionable" && useAnyway);
}
