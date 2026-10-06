import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { syntheticPdf } from "../../packages/test-fixtures/pdf";
test("mobile PDF text review retains page provenance and retrieves exact original after reload", async ({
  page,
}) => {
  const bytes = syntheticPdf([
    [
      "Merchant: Synthetic PDF Shop",
      "Date: 2026-10-05",
      "Item: Test toaster",
      "Total: PHP 1299.00",
    ],
    ["Return by: 2026-10-19", "Warranty ends: 2027-10-05"],
  ]);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose PDF", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic-receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByRole("heading", { name: /^Questionable/ }),
  ).toBeVisible();
  await expect(page.getByText(/Embedded text may be hidden/)).toBeVisible();
  await page.screenshot({ path: ".local/pdf-quality.png" });
  await expect(
    page.getByRole("heading", { name: "Check these facts", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByLabel("Item", { exact: true })).toHaveValue(
    "Test toaster",
    { timeout: 60000 },
  );
  const source = page.getByText(
    'Receipt (PDF page 2): "Return by: 2026-10-19"',
    { exact: true },
  );
  await expect(source).toBeVisible();
  await source.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/pdf-review.png" });
  for (const name of [
    "Confirm purchase date",
    "Confirm total",
    "Confirm return deadline",
    "Track warranty",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await expect(
    page.getByText("What Cuevaro is watching", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Things", exact: true }).click();
  await page.getByLabel("Search saved purchases").fill("toaster");
  await page.getByRole("button", { name: "Open saved purchase" }).click();
  await page
    .getByRole("button", { name: "View original evidence", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download original PDF", exact: true })
    .click();
  expect(readFileSync((await (await download).path())!)).toEqual(
    Buffer.from(bytes),
  );
});
test("unsupported PDF keeps its original and offers honest manual fallback", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose PDF", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic-image-only.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(syntheticPdf([[]])),
  });
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByText(/No embedded text was found/)).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByRole("button", { name: "Review manually", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/pdf-unsupported.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume saved capture", exact: true }),
  ).toHaveCount(1);
});
test("pixel quality decisions show actionable advice on narrow mobile in dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  for (const [name, advice] of [
    ["cut_off", "Part of the receipt is cut off."],
    ["occlusion", "A large region may cover or hide receipt text."],
  ]) {
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", {
        name: name === "cut_off" ? "Choose photo" : "Choose another photo",
        exact: true,
      })
      .click();
    await (
      await chooser
    ).setFiles({
      name: `synthetic-${name}.png`,
      mimeType: "image/png",
      buffer: readFileSync(`.local/document-preflight/${name}.png`),
    });
    await expect(
      page.getByRole("heading", { name: /^Bad.*retake needed$/ }),
    ).toBeVisible();
    await expect(page.getByText(advice, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Use anyway", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Retake photo", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.local/quality-ui-${name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Choose another photo", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic-bordered.png",
    mimeType: "image/png",
    buffer: readFileSync(".local/document-preflight/bordered.png"),
  });
  await expect(
    page.getByRole("heading", {
      name: /^Questionable.*check before continuing$/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Check these facts", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Check these facts", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: ".local/quality-ui-good.png", fullPage: true });
});
test("mobile receipt → quality warning → real OCR → reviewed lifecycle → retrieval across reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Try synthetic receipt" }).click();
  await expect(
    page.getByText("Questionable · check before continuing", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByLabel("Item", { exact: true })).toHaveValue(
    "Electric kettle",
    { timeout: 60000 },
  );
  await expect(page.getByLabel("Return deadline", { exact: true })).toHaveValue(
    "2026-10-19",
  );
  await page
    .getByRole("button", { name: "Confirm purchase date", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm total", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm return deadline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Track warranty", exact: true })
    .click();
  // The server commits, then its response is lost. Recover the same reviewed record.
  await page.route("**/confirm", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await expect(
    page.getByText("What Cuevaro is watching", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Return deadline: 2026-10-19/)).toBeVisible();
  await page.getByRole("button", { name: "View original evidence" }).click();
  await expect(page.getByAltText("Original purchase evidence")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Things", exact: true }).click();
  await page.getByLabel("Search saved purchases").fill("kettle");
  await page.getByRole("button", { name: "Open saved purchase" }).click();
  await expect(
    page.getByRole("heading", { name: "Electric kettle", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/mobile-slice.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page.route("**/attention", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page
    .getByRole("button", { name: "Stop return reminders", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Return window reminder", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Things", exact: true }).click();
  await page.getByRole("button", { name: "Open saved purchase" }).click();
  await expect(page.getByText(/Reminders stopped/)).toBeVisible();
  await page.unroute("**/attention");
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page
    .getByRole("button", { name: "Stop warranty reminders", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Warranty reminder", { exact: true }),
  ).toHaveCount(0);
});
test("uploaded capture reviewed manually retains working local reminder controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Try synthetic receipt" }).click();
  await page.route("**/v1/captures/*", (route) => route.abort());
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("original is safe");
  await page
    .getByRole("button", { name: "Review manually", exact: true })
    .click();
  await page.getByLabel("Item", { exact: true }).fill("Manual kettle");
  await page.getByLabel("Purchase date", { exact: true }).fill("2026-10-05");
  await page
    .getByRole("button", { name: "Confirm purchase date", exact: true })
    .click();
  await page.getByLabel("Return deadline", { exact: true }).fill("2026-10-19");
  await page
    .getByRole("button", { name: "Confirm return deadline", exact: true })
    .click();
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  let requests = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/attention")) requests++;
  });
  await page
    .getByRole("button", { name: "Stop return reminders", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Return window reminder", { exact: true }),
  ).toHaveCount(0);
  expect(requests).toBe(0);
});
test("bad image is retained with retake choices; no use-anyway bypass", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const bytes = await sharp({
    create: { width: 500, height: 700, channels: 3, background: "#101010" },
  })
    .png()
    .toBuffer();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic-low-light.png",
    mimeType: "image/png",
    buffer: bytes,
  });
  await expect(
    page.getByText("Bad · retake needed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use anyway", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Retake photo" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Resume saved capture" }).click();
  await expect(
    page.getByText("Bad · retake needed", { exact: true }),
  ).toBeVisible();
});
test("failed upload retains original across restart and reconnect recovers without duplicate purchases", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Try synthetic receipt" }).click();
  await page.route("**/v1/captures", (route) => route.abort());
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("original is safe");
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Resume saved capture" }).click();
  await page.getByRole("button", { name: "View original evidence" }).click();
  await expect(page.getByAltText("Original purchase evidence")).toBeVisible();
  await page.unroute("**/v1/captures");
  await page.getByRole("button", { name: "Retry processing" }).click();
  await expect(page.getByLabel("Item", { exact: true })).toHaveValue(
    "Electric kettle",
    { timeout: 60000 },
  );
});
test("desktop companion preview remains keyboard-operable and fits its viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local/desktop-preview.png", fullPage: true });
});
