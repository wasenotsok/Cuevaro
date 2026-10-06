import type { ImageSignals } from "./quality";

// Bounded, local pixel heuristics. This detects light paper on contrasting
// backgrounds; absence of this evidence never means edges are complete.
export function documentPreflight(image: ImageSignals): ImageSignals {
  const { width, height, luminance } = image;
  if (width < 1 || height < 1 || luminance.length !== width * height)
    throw Error("INVALID_IMAGE");
  const step = Math.max(1, Math.ceil(Math.max(width, height) / 240));
  const w = Math.ceil(width / step),
    h = Math.ceil(height / step);
  const pixels = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let total = 0,
        count = 0;
      for (let yy = y * step; yy < Math.min(height, (y + 1) * step); yy++)
        for (let xx = x * step; xx < Math.min(width, (x + 1) * step); xx++) {
          total += luminance[yy * width + xx];
          count++;
        }
      pixels[y * w + x] = Math.round(total / count);
    }
  const border: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2)
        border.push(pixels[y * w + x]);
  border.sort((a, b) => a - b);
  const background = border[Math.floor(border.length * 0.2)];
  const threshold = Math.max(160, background + 45);
  if (threshold > 240) return image;
  const mask = Uint8Array.from(pixels, (v) => (v >= threshold ? 1 : 0));
  const components = connected(mask, w, h)
    .filter((c) => c.length > w * h * 0.06)
    .sort((a, b) => b.length - a.length);
  if (!components.length) return image;
  const paper = components[0];
  if (paper.length < w * h * 0.15) return image;
  const rowMin = new Map<number, number>(),
    rowMax = new Map<number, number>();
  const colMin = new Map<number, number>(),
    colMax = new Map<number, number>();
  for (const i of paper) {
    const x = i % w,
      y = Math.floor(i / w);
    rowMin.set(y, Math.min(rowMin.get(y) ?? x, x));
    rowMax.set(y, Math.max(rowMax.get(y) ?? x, x));
    colMin.set(x, Math.min(colMin.get(x) ?? y, y));
    colMax.set(x, Math.max(colMax.get(x) ?? y, y));
  }
  const left = Math.min(...rowMin.values()),
    right = Math.max(...rowMax.values());
  const top = Math.min(...colMin.values()),
    bottom = Math.max(...colMax.values());
  const touches = left <= 1 || top <= 1 || right >= w - 2 || bottom >= h - 2;
  const widths = [...rowMin.keys()]
    .sort((a, b) => a - b)
    .slice(Math.ceil((bottom - top) * 0.2), Math.floor((bottom - top) * 0.8))
    .map((y) => rowMax.get(y)! - rowMin.get(y)! + 1);
  const perspectiveRatio = widths.length
    ? Math.max(...widths) / Math.max(1, Math.min(...widths))
    : 1;
  const meanX = paper.reduce((sum, i) => sum + (i % w), 0) / paper.length;
  const meanY =
    paper.reduce((sum, i) => sum + Math.floor(i / w), 0) / paper.length;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const i of paper) {
    const x = (i % w) - meanX,
      y = Math.floor(i / w) - meanY;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  const eigenGap = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy);
  const elongated =
    (xx + yy + eigenGap) / Math.max(1, xx + yy - eigenGap) > 1.7;
  let skew = elongated
    ? (Math.atan2(2 * xy, xx - yy) * 90) / Math.PI
    : undefined;
  if (skew !== undefined) {
    if (skew > 45) skew -= 90;
    if (skew < -45) skew += 90;
  }
  const darkMask = new Uint8Array(w * h);
  for (const [y, min] of rowMin)
    for (let x = min + 2; x <= rowMax.get(y)! - 2; x++)
      if (y > top + 2 && y < bottom - 2 && pixels[y * w + x] < threshold - 30)
        darkMask[y * w + x] = 1;
  const darkRegions = connected(darkMask, w, h);
  const edgeCover = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x >= left - 2 && x <= right + 2 && y >= top - 2 && y <= bottom + 2)
        continue;
      const v = pixels[y * w + x];
      if (v > background + 18 && v < threshold - 8) edgeCover[y * w + x] = 1;
    }
  const edgeObstruction = connected(edgeCover, w, h).some(
    (region) =>
      region.length > paper.length * 0.04 &&
      region.some((i) => {
        const x = i % w,
          y = Math.floor(i / w);
        return (
          (x >= left &&
            x <= right &&
            (Math.abs(y - top) <= 4 || Math.abs(y - bottom) <= 4)) ||
          (y >= top &&
            y <= bottom &&
            (Math.abs(x - left) <= 4 || Math.abs(x - right) <= 4))
        );
      }),
  );
  const occluded =
    edgeObstruction || darkRegions.some((c) => c.length > paper.length * 0.08);
  // An isolated bright hole surrounded by darker paper is possible washout,
  // not proof of reflection. Blank white paper is never called glare here.
  const saturated = new Uint8Array(w * h);
  for (const i of paper) if (pixels[i] >= 254) saturated[i] = 1;
  const washout = connected(saturated, w, h).some((region) => {
    if (region.length < paper.length * 0.02) return false;
    let l = w,
      r = 0,
      t = h,
      b = 0;
    for (const i of region) {
      const x = i % w,
        y = Math.floor(i / w);
      l = Math.min(l, x);
      r = Math.max(r, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
    }
    if (l <= left + 2 || r >= right - 2 || t <= top + 2 || b >= bottom - 2)
      return false;
    const cx = Math.round((l + r) / 2),
      cy = Math.round((t + b) / 2);
    const around = [
      pixels[cy * w + l - 2],
      pixels[cy * w + r + 2],
      pixels[(t - 2) * w + cx],
      pixels[(b + 2) * w + cx],
    ];
    return around.filter((v) => v < 248 && v > threshold).length >= 3;
  });
  const x0 = left * step,
    y0 = top * step,
    roiWidth = Math.min(width - x0, (right - left + 1) * step),
    roiHeight = Math.min(height - y0, (bottom - top + 1) * step);
  const roi = new Uint8Array(roiWidth * roiHeight);
  for (let y = 0; y < roiHeight; y++)
    roi.set(
      luminance.subarray(
        (y0 + y) * width + x0,
        (y0 + y) * width + x0 + roiWidth,
      ),
      y * roiWidth,
    );
  return {
    ...image,
    width: roiWidth,
    height: roiHeight,
    luminance: roi,
    // A visible rectangle cannot prove completeness: a background-colored cover
    // is indistinguishable from a genuinely shorter receipt. Require user review.
    edgeComplete: touches ? false : undefined,
    skewDegrees: skew,
    perspectiveRatio,
    occluded,
    regionalWashout: washout,
    documentCount: components.length,
  };
}
function connected(mask: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(mask.length),
    result: number[][] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const queue = [i];
    seen[i] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor],
        x = at % width,
        y = Math.floor(at / width);
      for (const [xx, yy] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const next = yy * width + xx;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    result.push(queue);
  }
  return result;
}
