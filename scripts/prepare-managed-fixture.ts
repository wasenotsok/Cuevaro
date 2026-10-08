// Local artifacts only. No credentials, Auth accounts, managed writes or network calls.
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { syntheticReceiptSvg } from "../packages/test-fixtures/receipt";
import { planManagedFixture } from "../packages/test-fixtures/managed-development";
try {
  if (process.argv.length !== 3) throw Error("IDENTITY_UUID_FILE_REQUIRED");
  if ((await stat(process.argv[2])).size > 4096)
    throw Error("BOUNDED_MANIFEST_REQUIRED");
  const input = JSON.parse(await readFile(process.argv[2], "utf8"));
  const bytes = await sharp(Buffer.from(syntheticReceiptSvg()))
    .png()
    .toBuffer();
  const plan = planManagedFixture(input, bytes);
  const dir = `.local/managed-fixtures/${randomUUID()}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/original.png`, bytes, { flag: "wx" });
  await writeFile(
    `${dir}/manifest.json`,
    JSON.stringify(plan.manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  await writeFile(`${dir}/01-households.sql`, plan.setupSql, { flag: "wx" });
  // Deliberately do not generate evidence SQL before a verified upload receipt.
  console.log(
    JSON.stringify({
      status: "local plan prepared",
      directory: dir,
      networkCalls: 0,
      next: "Parent reviews household SQL; actual Auth identities and immutable Storage upload/readback remain required",
    }),
  );
} catch {
  console.error(
    JSON.stringify({ status: "blocked", code: "FIXTURE_PREPARATION_FAILED" }),
  );
  process.exitCode = 2;
}
