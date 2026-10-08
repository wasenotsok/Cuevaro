import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const base = resolve("apps/mobile/dist");
createServer((req, res) => {
  let path;
  try {
    path = resolve(
      base,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!path.startsWith(base + sep) && path !== base) {
    res.writeHead(403).end();
    return;
  }
  if (path === base || !existsSync(path)) path = resolve(base, "index.html");
  try {
    res.setHeader(
      "Content-Type",
      extname(path) === ".js"
        ? "application/javascript"
        : extname(path) === ".html"
          ? "text/html"
          : "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(4187, "127.0.0.1", () =>
  console.log("Loopback-only synthetic mobile preview on 4187"),
);
