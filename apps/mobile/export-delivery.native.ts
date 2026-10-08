import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
export async function deliverArchive(
  bytes: Uint8Array,
): Promise<(() => void) | undefined> {
  if (!(await Sharing.isAvailableAsync())) throw Error("SHARING_UNAVAILABLE");
  const file = new File(
    Paths.cache,
    `cuevaro-export-${Crypto.randomUUID()}.zip`,
  );
  file.create({ overwrite: false });
  try {
    file.write(bytes);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/zip",
      UTI: "public.zip-archive",
      dialogTitle: "Export Cuevaro record",
    });
  } catch (e) {
    file.delete();
    throw e;
  }
  // Android recipients can read after chooser resolution. Keep until explicit user cleanup.
  return () => {
    if (file.exists) file.delete();
  };
}

export async function pendingExportCleanup(): Promise<
  (() => void) | undefined
> {
  const files = Paths.cache
    .list()
    .filter(
      (f): f is File =>
        f instanceof File && /^cuevaro-export-[a-f0-9-]{36}\.zip$/.test(f.name),
    );
  return files.length
    ? () => {
        for (const f of files) if (f.exists) f.delete();
      }
    : undefined;
}
