import { it, expect } from "vitest";
import sharp from "sharp";
import { imageQuality } from "../services/api/development";
import type { Quality } from "../packages/domain/quality";
import { mkdirSync, writeFileSync } from "node:fs";
function photo(
  paper = '<rect x="120" y="80" width="560" height="840" fill="#eee"/>',
  extra = "",
) {
  const lines = Array.from(
    { length: 22 },
    (_, i) =>
      `<text x="155" y="${140 + i * 30}" font-size="20" fill="#222">SYNTHETIC receipt line ${i}</text>`,
  ).join("");
  return Buffer.from(
    `<svg width="800" height="1000"><rect width="800" height="1000" fill="#555"/>${paper}${lines}${extra}</svg>`,
  );
}
it("measures paper boundaries, cut-off, perspective, obstruction and washout from actual pixels", async () => {
  const base = await sharp(photo()).png().toBuffer();
  const cases = {
    bordered: base,
    cut_off: await sharp(base)
      .extract({ left: 200, top: 0, width: 600, height: 1000 })
      .png()
      .toBuffer(),
    skew: await sharp(base).rotate(25, { background: "#555" }).png().toBuffer(),
    perspective: await sharp(
      photo('<polygon points="240,80 560,80 680,920 120,920" fill="#eee"/>'),
    )
      .png()
      .toBuffer(),
    occlusion: await sharp(
      photo(
        undefined,
        '<rect x="320" y="300" width="250" height="300" fill="#8a6652"/>',
      ),
    )
      .png()
      .toBuffer(),
    washout: await sharp(
      photo(
        undefined,
        '<rect x="250" y="300" width="300" height="300" fill="white"/>',
      ),
    )
      .png()
      .toBuffer(),
    blank: await sharp(
      Buffer.from(
        '<svg width="800" height="1000"><rect width="800" height="1000" fill="#555"/><rect x="120" y="80" width="560" height="840" fill="#eee"/></svg>',
      ),
    )
      .png()
      .toBuffer(),
    edge_occlusion: await sharp(
      photo(
        undefined,
        '<rect x="120" y="650" width="560" height="270" fill="#8a6652"/>',
      ),
    )
      .png()
      .toBuffer(),
    camouflaged_edge: await sharp(
      photo(
        undefined,
        '<rect x="120" y="650" width="560" height="270" fill="#555"/>',
      ),
    )
      .png()
      .toBuffer(),
    narrow_camouflaged_edge: await sharp(
      Buffer.from(
        `<svg width="800" height="1000"><rect width="800" height="1000" fill="#555"/><rect x="200" y="80" width="400" height="840" fill="#eee"/>${Array.from({ length: 22 }, (_, i) => `<text x="220" y="${140 + i * 30}" font-size="18" fill="#222">SYNTHETIC receipt ${i}</text>`).join("")}<rect x="200" y="650" width="400" height="270" fill="#555"/></svg>`,
      ),
    )
      .png()
      .toBuffer(),
    missing_corner: await sharp(
      photo(undefined, '<polygon points="120,80 240,80 120,200" fill="#555"/>'),
    )
      .png()
      .toBuffer(),
  };
  mkdirSync(".local/document-preflight", { recursive: true });
  const report: (Quality & { name: string })[] = [];
  for (const [name, bytes] of Object.entries(cases)) {
    const q = await imageQuality(bytes);
    writeFileSync(`.local/document-preflight/${name}.png`, bytes);
    report.push({ name, ...q });
  }
  writeFileSync(
    ".local/document-preflight/report.json",
    JSON.stringify(report, null, 2),
  );
  const find = (name: string) => report.find((r) => r.name === name)!;
  expect(find("bordered").grade).toBe("questionable");
  expect(find("bordered").findings).toContain("unverified_edges");
  expect(find("bordered").findings).not.toContain("glare");
  expect(find("cut_off").findings).toContain("cut_off");
  expect(find("cut_off").grade).toBe("bad");
  expect(find("skew").findings).toContain("skew");
  expect(find("perspective").findings).toContain("perspective");
  expect(find("occlusion").findings).toContain("occlusion");
  expect(find("occlusion").grade).toBe("bad");
  expect(find("washout").findings).toContain("washout");
  expect(find("washout").grade).not.toBe("good");
  expect(find("blank").grade).toBe("bad");
  expect(find("edge_occlusion").grade).not.toBe("good");
  expect(find("camouflaged_edge").grade).not.toBe("good");
  expect(find("narrow_camouflaged_edge").grade).toBe("questionable");
  expect(find("narrow_camouflaged_edge").findings).toContain(
    "unverified_edges",
  );
  expect(find("missing_corner").grade).not.toBe("good");
});
