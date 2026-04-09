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

import { GET, POST } from "../categories/route";
import { DELETE } from "../categories/[id]/route";
import { _testResetDB, getCategories } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/categories", () => {
  it("returns default category from seed data", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("默认分类");
    expect(body.data[0].id).toBe("default");
  });
});

describe("POST /api/categories", () => {
  it("creates a new category", async () => {
    const request = new Request("http://localhost/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "科技" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.name).toBe("科技");
    expect(body.data.id).toBeTruthy();
  });

  it("returns 400 when name is missing", async () => {
    const request = new Request("http://localhost/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toBe("缺少分类名称");
  });
});

describe("DELETE /api/categories/[id]", () => {
  it("deletes an existing category", async () => {
    // Create a category first via db directly
    const { createCategory } = await import("@/lib/db");
    const cat = await createCategory("ToDelete");

    const response = await DELETE({} as any, { params: { id: cat.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
  });

  it("returns 404 for non-existent category", async () => {
    const response = await DELETE({} as any, { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe(404);
  });
});
