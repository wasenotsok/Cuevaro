import { it, expect } from "vitest";
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { syntheticReceiptSvg } from "../packages/test-fixtures/receipt";
import { imageQuality } from "../services/api/development";
it("preflights actual degraded synthetic receipt pixels without claiming a calibrated camera benchmark", async () => {
  const original = await sharp(Buffer.from(syntheticReceiptSvg()))
    .png()
    .toBuffer();
  const cases = {
    crisp: original,
    blur: await sharp(original).blur(8).png().toBuffer(),
    glare: await sharp(original)
      .composite([
        {
          input: Buffer.from(
            '<svg width="650" height="450"><rect width="650" height="450" fill="white"/></svg>',
          ),
          left: 100,
          top: 200,
        },
      ])
      .png()
      .toBuffer(),
    low_light: await sharp(original)
      .modulate({ brightness: 0.1 })
      .png()
      .toBuffer(),
    cut_off: await sharp(original)
      .extract({ left: 120, top: 220, width: 680, height: 630 })
      .png()
      .toBuffer(),
    faded_thermal: await sharp(original).linear(0.12, 210).png().toBuffer(),
    skew: await sharp(original)
      .rotate(25, { background: "#888" })
      .png()
      .toBuffer(),
    small_text: await sharp(original).resize({ width: 160 }).png().toBuffer(),
    occluded: await sharp(original)
      .composite([
        {
          input: Buffer.from(
            '<svg width="350" height="500"><rect width="350" height="500" fill="#977A66"/></svg>',
          ),
          left: 280,
          top: 300,
        },
      ])
      .png()
      .toBuffer(),
  };
  mkdirSync(".local/quality-fixtures", { recursive: true });
  const results = [];
  for (const [name, bytes] of Object.entries(cases)) {
    const q = await imageQuality(bytes);
    expect(q.grade).not.toBe("good"); // Absent verified edges is always surfaced.
    if (name === "crisp" || name === "cut_off")
      expect(q.findings).not.toContain("glare");
    if (["blur", "low_light", "faded_thermal", "small_text"].includes(name))
      expect(q.grade).toBe("bad");
    writeFileSync(`.local/quality-fixtures/${name}.png`, bytes);
    results.push({ case: name, ...q });
  }
  writeFileSync(
    ".local/quality-benchmark.json",
    JSON.stringify(
      { kind: "synthetic-preflight-regression", notCalibrated: true, results },
      null,
      2,
    ),
  );
});
