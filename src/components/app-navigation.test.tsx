import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { AppNavigation } from "./app-navigation";

describe("AppNavigation", () => {
  it("hides the admin link for regular learners", () => {
    const html = renderToStaticMarkup(<AppNavigation />);

    expect(html).not.toContain('href="/admin"');
  });

  it("shows the admin link when the server-authorized flag is present", () => {
    const html = renderToStaticMarkup(<AppNavigation showAdmin />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain("Admin");
  });
});
