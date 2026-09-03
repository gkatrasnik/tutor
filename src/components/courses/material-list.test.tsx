import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { MaterialList } from "./material-list";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/app/(authenticated)/app/materials/material-actions", () => ({
  MaterialActions: ({
    title,
    canRetry,
  }: {
    title: string;
    canRetry: boolean;
  }) =>
    createElement("button", null, `${canRetry ? "Retry" : "Delete"} ${title}`),
}));

const material = {
  id: "material",
  courseId: "course",
  courseName: "Biology",
  filename: "Notes.pdf",
  status: "ready",
  error: null,
  sourceType: "pdf",
  pageCount: 5,
  indexed: true,
};
let rows: (
  typeof material | (Omit<typeof material, "error"> & { error: string })
)[];
beforeEach(() => {
  rows = [material];
  const query = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockImplementation(async () => rows),
  };
  vi.mocked(db.select).mockReturnValue(
    query as unknown as ReturnType<typeof db.select>,
  );
});

describe("compact material rows", () => {
  it("renders one semantic list with metadata and actions, without per-file cards", async () => {
    const html = renderToStaticMarkup(
      await MaterialList({ ownerId: "owner", courseId: "course" }),
    );
    expect(html).toContain("<ul");
    expect(html).toContain('aria-label="Material files"');
    expect(html).toContain("<li");
    expect(html).not.toContain('data-slot="card"');
    expect(html).toContain("Notes.pdf");
    expect(html).toContain("Indexed");
    expect(html).toContain("5 pages");
    expect(html).toContain("Delete Notes.pdf");
  });
  it("keeps failure details and retry actions in the affected row", async () => {
    rows = [
      {
        ...material,
        status: "failed",
        error: "Could not prepare <notes>",
        indexed: false,
      },
    ];
    const html = renderToStaticMarkup(
      await MaterialList({ ownerId: "owner", courseId: "course" }),
    );
    expect(html).toContain("Needs attention");
    expect(html).toContain("Could not prepare &lt;notes&gt;");
    expect(html).toContain("Retry Notes.pdf");
  });
  it("keeps the empty state lightweight", async () => {
    rows = [];
    const html = renderToStaticMarkup(
      await MaterialList({ ownerId: "owner", courseId: "course" }),
    );
    expect(html).toContain("No materials yet");
    expect(html).not.toContain("<ul");
  });
});
