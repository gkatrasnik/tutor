import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ErrorFallback } from "./error-fallback";

describe("ErrorFallback", () => {
  it("shows recovery actions and a safe digest without exposing the error message", () => {
    const error = Object.assign(
      new Error("private database connection string"),
      {
        digest: "safe-reference",
      },
    );
    const html = renderToStaticMarkup(
      <ErrorFallback
        title="Could not load"
        description="Try again."
        error={error}
        retry={vi.fn()}
        returnHref="/app"
        returnLabel="Return to courses"
      />,
    );

    expect(html).toContain("Could not load");
    expect(html).toContain("Try again");
    expect(html).toContain("safe-reference");
    expect(html).toContain('href="/app"');
    expect(html).not.toContain("private database connection string");
  });
});
