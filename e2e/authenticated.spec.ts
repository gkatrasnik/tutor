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

  test("personalizes the landing page for a returning learner", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "My courses" }),
    ).toHaveAttribute("href", "/app");
    await expect(
      page.getByRole("link", { name: "Go to my courses" }),
    ).toHaveAttribute("href", "/app");
    await expect(
      page.getByRole("link", { name: "Create your first course" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Open account menu" }),
    ).toBeVisible();
  });

  test("offers a persistent theme control in the account menu", async ({
    page,
  }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Open account menu" }).click();

    const darkMode = page.getByRole("menuitemcheckbox", { name: "Dark mode" });
    await expect(darkMode).toBeVisible();
    await expect(page.getByText("Settings", { exact: true })).toHaveCount(0);
    const wasChecked = (await darkMode.getAttribute("aria-checked")) === "true";
    await darkMode.click();
    await expect(darkMode).toHaveAttribute("aria-checked", String(!wasChecked));

    await page.reload();
    await page.getByRole("button", { name: "Open account menu" }).click();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Dark mode" }),
    ).toHaveAttribute("aria-checked", String(!wasChecked));
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
