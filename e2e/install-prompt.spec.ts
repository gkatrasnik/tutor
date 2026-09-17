import { expect, test, type Page } from "@playwright/test";

async function offerInstall(page: Page, outcome = "accepted") {
  // Wait for hydration before simulating the browser's installability event.
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await page.evaluate((choice) => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installRequested = "true";
        return { outcome: choice };
      },
    });
    window.dispatchEvent(event);
  }, outcome);
}

test("install card opens the browser prompt and fits a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/auth/sign-in");
  await offerInstall(page);
  const card = page.getByRole("complementary", { name: "Install Tutor" });
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-install-requested",
    "true",
  );
  await expect(card).toHaveCount(0);
});

for (const action of ["Not now", "Never"]) {
  test(`${action} stays dismissed after reload`, async ({ page }) => {
    await page.goto("/auth/sign-in");
    await offerInstall(page);
    await page.getByRole("button", { name: action, exact: true }).click();
    await page.reload();
    await offerInstall(page);
    await expect(
      page.getByRole("complementary", { name: "Install Tutor" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => ({
        local: localStorage.getItem("tutor-install-dismissed"),
        session: sessionStorage.getItem("tutor-install-dismissed"),
      })),
    ).toEqual(
      action === "Never"
        ? { local: "never", session: null }
        : { local: null, session: "later" },
    );
  });
}

test("manifest and install icons are publicly accessible", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Tutor",
    display: "standalone",
    start_url: "/app",
  });
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toContain("image/png");
  }
});
