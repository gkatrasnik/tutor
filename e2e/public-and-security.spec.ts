import { expect, test } from "@playwright/test";

test("landing page exposes the primary learning action", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Stop rereading. Start understanding.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your first course" }),
  ).toHaveAttribute("href", "/app");
});

test("unauthenticated learners are redirected to sign in", async ({ page }) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome to Tutor" }),
  ).toBeVisible();
});

test("unauthenticated administrators are redirected to sign in", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("responses include the browser hardening policy", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
});
