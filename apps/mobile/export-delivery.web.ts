export async function deliverArchive(
  bytes: Uint8Array,
): Promise<(() => void) | undefined> {
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "cuevaro-record.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return undefined;
}

export async function pendingExportCleanup(): Promise<
  (() => void) | undefined
> {
  return undefined;
}
