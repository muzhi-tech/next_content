import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock path to redirect DB to :memory: for testing
vi.mock(import("path"), async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const realJoin = actual.join.bind(actual);
  const mockJoin = (...args: string[]) => {
    if (args.includes("data") && args.includes("content.db")) {
      return ":memory:";
    }
    return realJoin(...args);
  };
  return {
    ...actual,
    default: { ...actual, join: mockJoin },
    join: mockJoin,
  };
});

// Mock wiki-lint to avoid file system operations
const mockLintWiki = vi.fn();
vi.mock(import("@/lib/wiki-lint"), () => ({
  lintWiki: (...args: unknown[]) => mockLintWiki(...args),
}));

import { POST } from "../wiki/lint/route";

describe("POST /api/wiki/lint", () => {
  beforeEach(() => {
    mockLintWiki.mockReset();
  });

  it("returns 400 when categoryId is missing", async () => {
    const request = new Request("http://localhost/api/wiki/lint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("categoryId");
  });

  it("returns lint issues for a category", async () => {
    mockLintWiki.mockResolvedValue([
      { severity: "high", page: "openai.md", message: "Missing references", suggestion: "Add sources" },
      { severity: "low", page: "gpt.md", message: "Short content", suggestion: "Expand content" },
    ]);

    const request = new Request("http://localhost/api/wiki/lint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.issues).toHaveLength(2);
    expect(body.data.issues[0].severity).toBe("high");
    expect(body.data.issues[1].page).toBe("gpt.md");
  });

  it("returns empty issues when wiki is healthy", async () => {
    mockLintWiki.mockResolvedValue([]);

    const request = new Request("http://localhost/api/wiki/lint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.issues).toEqual([]);
  });

  it("returns 500 when lint throws an error", async () => {
    mockLintWiki.mockRejectedValue(new Error("FS error"));

    const request = new Request("http://localhost/api/wiki/lint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(500);
  });
});
