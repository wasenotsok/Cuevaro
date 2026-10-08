// Hash-check a supplied actual Storage download; produce SQL, never execute it.
import { readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { managedFixtureEvidenceSql } from "../packages/test-fixtures/managed-development";
try {
  if (process.argv.length !== 4)
    throw Error("MANIFEST_AND_DOWNLOADED_FILE_REQUIRED");
  if ((await stat(process.argv[2])).size > 16384)
    throw Error("BOUNDED_MANIFEST_REQUIRED");
  const size = (await stat(process.argv[3])).size;
  if (size < 1 || size > 20000000) throw Error("BOUNDED_DOWNLOAD_REQUIRED");
  const sql = managedFixtureEvidenceSql(
    JSON.parse(await readFile(process.argv[2], "utf8")),
    await readFile(process.argv[3]),
  );
  const output = join(
    dirname(process.argv[2]),
    "02-evidence-after-readback.sql",
  );
  await writeFile(output, sql, { flag: "wx" });
  console.log(
    JSON.stringify({
      status: "local bytes matched; SQL prepared",
      networkCalls: 0,
      limitations: [
        "Parent must independently establish actual API upload/readback provenance before SQL execution",
      ],
    }),
  );
} catch {
  console.error(
    JSON.stringify({ status: "blocked", code: "EVIDENCE_PREPARATION_FAILED" }),
  );
  process.exitCode = 2;
}
