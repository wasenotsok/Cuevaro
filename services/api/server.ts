import { getRecords } from "./records";
import { correctionSchema } from "../../packages/domain/corrections";
import Fastify from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import {
  openDevelopmentDb,
  developmentActor,
  createCapture,
  createPageCapture,
  getDraft,
  confirmPurchase,
  runOneJob,
  assertActor,
  changeAttention,
  correctPurchase,
} from "./development";
import { fields } from "../../packages/domain/purchase";
import { itemChoicesSchema } from "../../packages/domain/review-items";
import { syntheticReceiptSvg } from "../../packages/test-fixtures/receipt";
const body = z
  .object({
    clientId: z.uuid(),
    base64: z
      .string()
      .min(1)
      .max(27000000)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
    useAnyway: z.boolean(),
    additionalPages: z
      .array(
        z
          .string()
          .min(1)
          .max(27000000)
          .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      )
      .max(9)
      .optional(),
  })
  .strict();
const values = z
  .object(
    Object.fromEntries(fields.map((f) => [f, z.string().max(200).nullable()])),
  )
  .strict();
const attention = z
  .object({
    version: z.number().int().positive(),
    command: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("stop"),
          kind: z.enum(["return", "warranty"]),
        })
        .strict(),
      z
        .object({ type: z.literal("dismiss"), cueId: z.string().max(200) })
        .strict(),
      z
        .object({
          type: z.literal("snooze"),
          cueId: z.string().max(200),
          date: z.string().max(10),
        })
        .strict(),
    ]),
  })
  .strict();
export async function buildApi(
  db: Awaited<ReturnType<typeof openDevelopmentDb>>,
) {
  const app = Fastify({ logger: false, bodyLimit: 28000000 });
  app.addHook("onRequest", async (req, res) => {
    if (!/^(localhost|127\.0\.0\.1)(:(4329|80))?$/.test(req.headers.host ?? ""))
      return res.code(403).send({ code: "HOST_DENIED" });
    const origin = req.headers.origin;
    if (
      origin &&
      !/^http:\/\/(localhost|127\.0\.0\.1):(8081|19006|4187)$/.test(origin)
    )
      return res.code(403).send({ code: "ORIGIN_DENIED" });
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Cache-Control", "no-store");
    if (req.method === "OPTIONS")
      return res
        .header(
          "Access-Control-Allow-Headers",
          "Content-Type,X-Cuevaro-Development",
        )
        .header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        .code(204)
        .send();
    if (
      req.method !== "GET" &&
      req.headers["x-cuevaro-development"] !== "synthetic-only"
    )
      return res.code(403).send({ code: "DEVELOPMENT_ONLY" });
  });
  app.setErrorHandler((error, req, res) => {
    const msg = error instanceof Error ? error.message : "";
    const code =
      error instanceof z.ZodError
        ? "INVALID_REQUEST"
        : msg === "ACCESS_DENIED"
          ? "ACCESS_DENIED"
          : msg === "QUALITY_REVIEW_REQUIRED"
            ? "QUALITY_REVIEW_REQUIRED"
            : msg === "STATE_CONFLICT"
              ? "STATE_CONFLICT"
              : "OPERATION_FAILED";
    res
      .code(code === "ACCESS_DENIED" ? 403 : 400)
      .send({ code, requestId: randomUUID() });
  });
  app.get("/v1/health", () => ({
    environment: "local-synthetic-development",
    managedAuth: false,
    cloudBackup: false,
    push: false,
  }));
  app.get("/v1/fixture", async (_req, res) =>
    res
      .type("image/png")
      .send(await sharp(Buffer.from(syntheticReceiptSvg())).png().toBuffer()),
  );
  app.post("/v1/captures", async (req) => {
    const b = body.parse(req.body);
    return createPageCapture(
      db,
      developmentActor,
      b.clientId,
      [
        Buffer.from(b.base64, "base64"),
        ...(b.additionalPages ?? []).map((p) => Buffer.from(p, "base64")),
      ],
      b.useAnyway,
    );
  });
  app.get<{ Params: { id: string } }>("/v1/captures/:id", async (req) =>
    getDraft(db, developmentActor, z.uuid().parse(req.params.id)),
  );
  app.post<{ Params: { id: string } }>(
    "/v1/captures/:id/confirm",
    async (req) => {
      const b = z
        .object({ values, itemChoices: itemChoicesSchema })
        .strict()
        .safeParse(req.body);
      return confirmPurchase(
        db,
        developmentActor,
        z.uuid().parse(req.params.id),
        b.success ? b.data.values : values.parse(req.body),
        b.success ? b.data.itemChoices : undefined,
      );
    },
  );
  app.post<{ Params: { id: string } }>(
    "/v1/purchases/:id/attention",
    async (req) => {
      const b = attention.parse(req.body);
      return changeAttention(
        db,
        developmentActor,
        z.uuid().parse(req.params.id),
        b.command,
        b.version,
      );
    },
  );
  app.get("/v1/records", () =>
    db.transaction((tx) => getRecords(tx, developmentActor)),
  );
  app.post<{ Params: { id: string } }>(
    "/v1/purchases/:id/corrections",
    async (req) =>
      correctPurchase(
        db,
        developmentActor,
        z.uuid().parse(req.params.id),
        correctionSchema.parse(req.body),
      ),
  );
  return app;
}
if (process.argv[1]?.endsWith("server.ts")) {
  mkdirSync(".local", { recursive: true });
  const db = await openDevelopmentDb(
    process.env.CUEVARO_EPHEMERAL === "1" ? undefined : ".local/database",
  );
  const app = await buildApi(db);
  // Loopback only; this synthetic fixture identity is never a network authentication mechanism.
  await app.listen({ host: "127.0.0.1", port: 4329 });
  console.log(
    "Cuevaro synthetic development API on http://127.0.0.1:4329. No production auth or cloud service.",
  );
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runOneJob(db);
    } finally {
      running = false;
    }
  }, 1000);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, async () => {
      clearInterval(timer);
      await app.close();
      await db.close();
      process.exit(0);
    });
}
