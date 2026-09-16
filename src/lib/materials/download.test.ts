import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  get: vi.fn(),
  log: vi.fn(),
}));
vi.mock("@/lib/auth/dal", () => ({ requireUser: mocks.user }));
vi.mock("@/db", () => ({ db: { select: mocks.select } }));
vi.mock("@vercel/blob", () => ({ get: mocks.get }));
vi.mock("@/lib/observability/logger", () => ({ logServerError: mocks.log }));

import { GET } from "@/app/api/materials/[id]/download/route";

const id = "02564de2-4a8b-4426-8fe2-4e92cc1265ea";
const material = {
  id,
  sourceType: "pdf",
  originalFilename: "Lecture č.pdf",
  blobPathname: "materials/learner-a/uploads/lecture.pdf",
};
let rows: (typeof material)[];
const download = (materialId = id) =>
  GET(
    new Request(`https://example.test/api/materials/${materialId}/download`),
    {
      params: Promise.resolve({ id: materialId }),
    },
  );

beforeEach(() => {
  vi.resetAllMocks();
  rows = [{ ...material }];
  mocks.user.mockResolvedValue({ id: "learner-a" });
  mocks.where.mockReturnValue({ limit: async () => rows });
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.get.mockImplementation(async () => ({
    statusCode: 200,
    stream: new Response("original file bytes").body,
  }));
});

describe("private material downloads", () => {
  it("streams the original file with a Unicode filename and no caching", async () => {
    const response = await download();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("original file bytes");
    expect(mocks.get).toHaveBeenCalledWith(material.blobPathname, {
      access: "private",
    });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''Lecture%20%C4%8D.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"materials"."owner_id"');
    expect(query.params).toEqual([id, "learner-a"]);
  });

  it("downloads pasted notes as text and sanitizes the filename", async () => {
    rows = [
      { ...material, sourceType: "text", originalFilename: "Notes/č\r\n" },
    ];
    const response = await download();
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toContain(
      "Notes_%C4%8D__.txt",
    );
  });

  it("does not access storage for missing or unowned materials", async () => {
    rows = [];
    expect((await download()).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs before querying", async () => {
    expect((await download("invalid")).status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("requires authentication before accessing materials", async () => {
    mocks.user.mockRejectedValue(new Error("Unauthorized"));
    await expect(download()).rejects.toThrow("Unauthorized");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("handles missing blobs and storage failures", async () => {
    mocks.get.mockResolvedValue(null);
    expect((await download()).status).toBe(404);
    mocks.get.mockRejectedValue(new Error("private storage details"));
    const response = await download();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private storage details");
  });
});
