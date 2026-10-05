import { test, expect } from "@playwright/test";
import sharp from "sharp";
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
