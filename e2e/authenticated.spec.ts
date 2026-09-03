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

  test("keeps usage details quiet and course creation inline", async ({
    page,
  }) => {
    await page.goto("/app");
    const usage = page.getByRole("button", { name: /Daily usage/ });
    await expect(usage).toHaveAttribute("aria-expanded", "false");
    await expect(usage).toContainText("tutor turns left");
    await expect(usage).toContainText("material imports left");
    await usage.focus();
    await page.keyboard.press("Enter");
    await expect(usage).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/Both allowances reset/)).toBeVisible();
    if (await page.getByTestId("open-course").count()) {
      await expect(
        page.getByLabel("Course name", { exact: true }),
      ).toBeHidden();
      await page
        .getByRole("button", { name: "Create course", exact: true })
        .click();
    }
    await expect(page.getByLabel("Course name", { exact: true })).toBeVisible();
  });

  test("puts lessons before material management and preserves upload drafts", async ({
    page,
  }) => {
    await page.goto("/app");
    const courseLinks = page.getByTestId("open-course");
    test.skip(
      (await courseLinks.count()) === 0,
      "Requires an existing learner course.",
    );
    await courseLinks.first().click();
    const about = page
      .locator("details")
      .filter({ hasText: "About this course" });
    if (await about.count()) await expect(about).toHaveAttribute("open", "");
    const lessons = page.getByRole("region", { name: "Lessons", exact: true });
    const materials = page.getByRole("region", {
      name: "Course materials",
      exact: true,
    });
    if (await lessons.count()) {
      const lessonsBox = await lessons.boundingBox();
      const materialsBox = await materials.boundingBox();
      expect(lessonsBox!.y).toBeLessThan(materialsBox!.y);
      await expect(
        page.getByText("Your outline is up to date", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Add course material", exact: true }),
      ).toBeHidden();
    } else {
      await expect(
        page.getByRole("heading", { name: "Add course material", exact: true }),
      ).toBeVisible();
    }
    const add = materials.getByRole("button", {
      name: "Add material",
      exact: true,
    });
    if (await add.count()) await add.click();
    const listToggle = materials.getByRole("button", {
      name: /Course materials ·/,
    });
    if ((await listToggle.getAttribute("aria-expanded")) === "true")
      await listToggle.click();
    await expect(listToggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("heading", { name: "Add course material", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Paste text" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Temporary UI test");
    await page
      .getByLabel("Your text", { exact: true })
      .fill("A local, intercepted upload used to verify the inline panel.");
    const hide = materials.getByRole("button", { name: "Close upload panel" });
    await hide.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Title", { exact: true })).toBeHidden();
    await add.scrollIntoViewIfNeeded();
    const beforeOpen = await add.boundingBox();
    await add.click();
    const uploadId = await hide.getAttribute("aria-controls");
    const uploadPanel = page.locator(`[id="${uploadId}"]`);
    await expect(uploadPanel).toHaveCSS("transition-property", "height");
    await expect(uploadPanel).not.toHaveAttribute("data-starting-style");
    await uploadPanel.evaluate(async (panel) => {
      await Promise.all(
        panel.getAnimations().map((animation) => animation.finished),
      );
    });
    const afterOpen = await hide.boundingBox();
    expect(Math.abs(afterOpen!.y - beforeOpen!.y)).toBeLessThan(3);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Temporary UI test",
    );
    await expect(listToggle).toHaveAttribute("aria-expanded", "false");
    await listToggle.click();
    await expect(page.getByLabel("Title", { exact: true })).toBeVisible();

    // Intercept both writes: this test never creates a material in the learner's account.
    await page.route("**/api/materials", (route) =>
      route.fulfill({ json: { id: "ui-test-material" } }),
    );
    let releaseProcessing!: () => void;
    const processing = new Promise<void>((resolve) => {
      releaseProcessing = resolve;
    });
    await page.route(
      "**/api/materials/ui-test-material/process",
      async (route) => {
        await processing;
        await route.fulfill({ json: { id: "ui-test-material" } });
      },
    );
    try {
      await page.getByRole("button", { name: "Save and prepare" }).click();
      await expect(hide).toBeDisabled();
      await expect(
        materials.getByRole("button", { name: /Course materials ·/ }),
      ).toBeEnabled();
      await expect(
        page.getByRole("tab", { name: "Upload PDF" }),
      ).toBeDisabled();
      releaseProcessing();
      await expect(hide).toBeEnabled();
      await expect(
        page.getByRole("heading", { name: "Add course material", exact: true }),
      ).toBeVisible();
    } finally {
      releaseProcessing();
    }
    const files = materials.getByRole("list", { name: "Material files" });
    if (await files.count())
      await expect(files.locator('[data-slot="card"]')).toHaveCount(0);
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
