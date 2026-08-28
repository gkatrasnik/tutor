import { expect, test } from "@playwright/test";

const learnerState = process.env.PLAYWRIGHT_LEARNER_STATE?.trim();
const adminState = process.env.PLAYWRIGHT_ADMIN_STATE?.trim();
const emptyState = { cookies: [], origins: [] };

test.describe("saved learner session", () => {
  test.use({ storageState: learnerState || emptyState });
  test.skip(!learnerState, "Set PLAYWRIGHT_LEARNER_STATE to run this journey.");

  test("opens the private courses page", async ({ page }) => {
    await page.goto("/app");

    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Welcome back/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Your courses" }),
    ).toBeVisible();
  });
});

test.describe("saved admin session", () => {
  test.use({ storageState: adminState || emptyState });
  test.skip(!adminState, "Set PLAYWRIGHT_ADMIN_STATE to run this journey.");

  test("opens read-only administration", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin/);
    await expect(
      page.getByRole("heading", { level: 1, name: "AI operations" }),
    ).toBeVisible();
  });
});
