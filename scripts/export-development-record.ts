import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  openDevelopmentDb,
  developmentActor,
} from "../services/api/development";
import { exportRecord } from "../services/api/export";
const id = z.uuid().parse(process.argv[2]);
const db = await openDevelopmentDb(".local/database");
try {
  const bundle = await exportRecord(db, developmentActor, id);
  const target = join(".local", "exports", randomUUID());
  mkdirSync(join(target, "originals"), { recursive: true });
  writeFileSync(
    join(target, "record.json"),
    JSON.stringify(bundle.manifest, null, 2),
    { flag: "wx" },
  );
  for (const original of bundle.originals)
    writeFileSync(join(target, original.file), original.bytes, { flag: "wx" });
  // Verify exported bytes immediately; this is export integrity, not a database restore drill.
  for (const original of bundle.originals)
    if (
      createHash("sha256")
        .update(readFileSync(join(target, original.file)))
        .digest("hex") !== original.sha256
    )
      throw Error("EXPORT_VERIFICATION_FAILED");
  console.log(
    `Synthetic record exported and byte-verified in ${target}. Not a cloud backup or database restore.`,
  );
} finally {
  await db.close();
}
