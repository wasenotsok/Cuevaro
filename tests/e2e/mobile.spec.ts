import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { syntheticReceiptSvg } from "../../packages/test-fixtures/receipt";
import { syntheticPdf } from "../../packages/test-fixtures/pdf";
test("correction survives offline restart and lost acknowledgement, records history and respects stopped reminders", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic-correction.png",
    mimeType: "image/png",
    buffer: await sharp(
      Buffer.from(
        syntheticReceiptSvg().replace(
          "Synthetic Appliances",
          "Synthetic Correction Shop",
        ),
      ),
    )
      .png()
      .toBuffer(),
  });
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByLabel("Return deadline", { exact: true })).toHaveValue(
    "2026-10-19",
    { timeout: 60000 },
  );
  for (const name of [
    "Confirm purchase date",
    "Confirm total",
    "Confirm return deadline",
    "Track warranty",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await page
    .getByRole("button", { name: "Correct return deadline", exact: true })
    .click();
  await page.getByLabel("Corrected value").fill("2026-10-21");
  await page.route("**/corrections", (route) => route.abort());
  await page
    .getByRole("button", { name: "Save correction & update reminders" })
    .click();
  await expect(
    page.getByText("Correction waiting to sync", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Return deadline: 2026-10-19/)).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Review queued correction" }).click();
  await page.unroute("**/corrections");
  await page.route("**/corrections", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "Retry queued correction" }).click();
  await expect(
    page.getByText("Correction waiting to sync", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Review queued correction" }).click();
  await page.unroute("**/corrections");
  await page.getByRole("button", { name: "Retry queued correction" }).click();
  await expect(page.getByText(/Return deadline: 2026-10-21/)).toBeVisible();
  await expect(
    page.getByText("Correction waiting to sync", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View correction history" }).click();
  await expect(
    page.getByText("Return deadline: 2026-10-19 — Earlier", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Return deadline: 2026-10-21 — Current", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Correct tracked item 1" }).click();
  await page.getByLabel("Corrected value").fill("Recovered kettle");
  await page
    .getByRole("button", { name: "Save correction & update reminders" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recovered kettle", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page
    .getByRole("button", { name: "Stop return reminders", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Stop return reminders", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Things", exact: true }).click();
  await page.getByRole("button", { name: "Open saved purchase" }).click();
  await page
    .getByRole("button", { name: "Correct return deadline", exact: true })
    .click();
  await page.getByLabel("Corrected value").fill("2026-10-23");
  await page
    .getByRole("button", { name: "Save correction & update reminders" })
    .click();
  await expect(
    page.getByText(/Return deadline: 2026-10-23.*Reminders stopped/),
  ).toBeVisible();
  await page.getByRole("button", { name: "View correction history" }).click();
  await page
    .getByText("Correction history", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/correction-history.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop return reminders", exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate(async () => {
    const res = await fetch("http://127.0.0.1:4329/v1/records", {
      headers: { "X-Cuevaro-Development": "synthetic-only" },
    });
    return res.json();
  });
  expect(saved).toHaveLength(1);
  expect(
    saved[0].history.filter((f: { field: string }) => f.field === "returnDate"),
  ).toHaveLength(3);
  expect(saved[0].itemHistory).toHaveLength(2);
});
test("multi-item review requires explicit choices and preserves corrected names and sources after lost response/reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (await chooser).setFiles(".local/multi-item/receipt.png");
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByLabel("Item 1 name", { exact: true })).toHaveValue(
    "Electric kettle",
    { timeout: 60000 },
  );
  await expect(page.getByLabel("Item 2 name", { exact: true })).toHaveValue(
    "Synthetic toaster",
  );
  await page.getByLabel("Item 1 name", { exact: true }).fill("Reviewed kettle");
  for (const name of [
    "Confirm purchase date",
    "Confirm total",
    "Confirm return deadline",
    "Track warranty",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await expect(
    page.getByText("Confirm or skip each item before saving.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Track item 1", exact: true }).click();
  await page.getByRole("button", { name: "Track item 2", exact: true }).click();
  await page
    .getByLabel("Item 1 name", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/multi-item/review-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.route("**/confirm", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await expect(page.getByText("Tracked items", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Reviewed kettle", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic toaster", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await page.getByRole("button", { name: "Things", exact: true }).click();
  await page.getByLabel("Search saved purchases").fill("Reviewed kettle");
  await expect(
    page.getByRole("button", { name: "Open saved purchase", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Open saved purchase", exact: true })
    .click();
  await expect(
    page.getByText(/Corrected by you.*Item: Electric kettle/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Item-specific warranty coverage remains unverified/),
  ).toBeVisible();
});
test("multi-page receipt survives bad-page replacement, lost upload acknowledgement and restart with exact originals", async ({
  page,
}) => {
  const original1 = readFileSync(".local/receipt-pages/page-1.png"),
    original2 = readFileSync(".local/receipt-pages/page-2.png");
  const bad = await sharp({
    create: { width: 800, height: 800, channels: 3, background: "#080808" },
  })
    .png()
    .toBuffer();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const select = async (label: string, bytes: Buffer, name: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: label, exact: true }).click();
    await (
      await chooser
    ).setFiles({ name, mimeType: "image/png", buffer: bytes });
  };
  await select("Choose photo", original1, "synthetic-page-1.png");
  await select("Choose next receipt page", bad, "synthetic-bad-page-2.png");
  await expect(page.getByText("Page 2: bad", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use anyway", exact: true }),
  ).toHaveCount(0);
  await select("Replace page 2", original2, "synthetic-page-2.png");
  await expect(
    page.getByText("Page 2: questionable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View earlier original 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View page 2", exact: true }).click();
  const image = page.getByAltText("Original purchase evidence");
  await image.scrollIntoViewIfNeeded();
  expect(await image.getAttribute("src")).toBe(
    `data:image/png;base64,${original2.toString("base64")}`,
  );
  await page.screenshot({ path: ".local/multi-page-quality.png" });
  await page.route("**/v1/captures", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(
    page.getByText(/original is safe on this device/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose next receipt page", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume saved capture", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Resume saved capture", exact: true })
    .click();
  await page.unroute("**/v1/captures");
  await page
    .getByRole("button", { name: "Retry processing", exact: true })
    .click();
  await expect(page.getByLabel("Return deadline", { exact: true })).toHaveValue(
    "2026-10-19",
    { timeout: 60000 },
  );
  await expect(
    page.getByText('Receipt (page 2): "Return by: 2026-10-19"', {
      exact: true,
    }),
  ).toBeVisible();
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
  await page.getByLabel("Search saved purchases").fill("Page test toaster");
  await expect(
    page.getByRole("button", { name: "Open saved purchase", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Open saved purchase", exact: true })
    .click();
  for (const [i, bytes] of [original1, original2].entries()) {
    await page
      .getByRole("button", { name: `View page ${i + 1}`, exact: true })
      .click();
    expect(
      await page.getByAltText("Original purchase evidence").getAttribute("src"),
    ).toBe(`data:image/png;base64,${bytes.toString("base64")}`);
  }
  await page
    .getByRole("button", { name: "View earlier original 1", exact: true })
    .click();
  expect(
    await page.getByAltText("Original purchase evidence").getAttribute("src"),
  ).toBe(`data:image/png;base64,${bad.toString("base64")}`);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await select("Choose photo", original1, "synthetic-page-1-again.png");
  await expect(
    page.getByText(
      "This evidence is already saved. No duplicate purchase was created.",
    ),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume saved capture", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Things", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open saved purchase", exact: true }),
  ).toHaveCount(1);
});
test("failed atomic page attachment leaves both saved originals recoverable without a partial bundle", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const select = async (label: string, index: number) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: label, exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: `synthetic-page-${index}.png`,
      mimeType: "image/png",
      buffer: readFileSync(`.local/receipt-pages/page-${index}.png`),
    });
  };
  await select("Choose photo", 1);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      if (value?.groupParentId)
        throw new DOMException("Synthetic write failure", "DataCloneError");
      return key === undefined
        ? put.call(this, value)
        : put.call(this, value, key);
    };
  });
  await select("Choose next receipt page", 2);
  await expect(
    page.getByText(/Local storage could not finish the page attachment/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume saved capture", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Resume saved capture", exact: true })
    .first()
    .click();
  await expect(page.getByText(/1 receipt page\./)).toBeVisible();
});
test("mobile alternate receipt layout shows normalized dates with the original excerpt before confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open synthetic development preview" })
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "synthetic-alternate-layout.png",
    mimeType: "image/png",
    buffer: readFileSync(".local/receipt-layouts/layout-0.png"),
  });
  await page.getByRole("button", { name: "Use anyway", exact: true }).click();
  await expect(page.getByLabel("Return deadline", { exact: true })).toHaveValue(
    "2026-10-19",
    { timeout: 60000 },
  );
  const source = page.getByText('Receipt: "Return deadline: 19 Oct 2026"', {
    exact: true,
  });
  await expect(source).toBeVisible();
  await source.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".local/receipt-layout-review.png" });
  for (const name of [
    "Confirm purchase date",
    "Confirm total",
    "Confirm return deadline",
    "Track warranty",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Save purchase & cues" }).click();
  await expect(page.getByText(/Return deadline: 2026-10-19/)).toBeVisible();
});
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
