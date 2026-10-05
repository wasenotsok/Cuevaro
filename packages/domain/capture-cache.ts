// Only temporary files beneath the application's cache directory are eligible.
// Preservation must have succeeded before deleting a picker original.
export async function cleanupOwnedCache(
  uri: string,
  cacheRoot: string,
  preserved: boolean,
  remove: (uri: string) => Promise<void>,
) {
  if (!preserved) return;
  const file = new URL(uri),
    root = new URL(cacheRoot);
  if (
    file.protocol !== "file:" ||
    root.protocol !== "file:" ||
    file.host !== root.host
  )
    return;
  const path = decodeURIComponent(file.pathname),
    base = decodeURIComponent(root.pathname).replace(/\/$/, "") + "/";
  if (
    !path.startsWith(base) ||
    path
      .slice(base.length)
      .split("/")
      .some((part) => part === ".." || part === ".") ||
    path === base
  )
    return;
  await remove(uri);
}
