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

import { GET as getKeywords, POST as postKeyword } from "../keywords/route";
import { DELETE as deleteKeyword, PUT as putKeyword } from "../keywords/[id]/route";
import { _testResetDB } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/keywords", () => {
  it("returns empty list when no keywords exist", async () => {
    const request = new Request("http://localhost/api/keywords");
    const response = await getKeywords(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toEqual([]);
  });

  it("returns keywords filtered by categoryId", async () => {
    // Create a keyword first
    const createReq = new Request("http://localhost/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "AI", platforms: ["xhs"], categoryId: "cat1" }),
    });
    await postKeyword(createReq as any);

    // Create another in different category
    const createReq2 = new Request("http://localhost/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech", platforms: ["wx"], categoryId: "cat2" }),
    });
    await postKeyword(createReq2 as any);

    // Filter by cat1
    const filterReq = new Request("http://localhost/api/keywords?categoryId=cat1");
    const response = await getKeywords(filterReq as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("AI");
  });
});

describe("POST /api/keywords", () => {
  it("creates a keyword successfully", async () => {
    const request = new Request("http://localhost/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "AI内容", platforms: ["xhs", "wx"], categoryId: "cat1" }),
    });
    const response = await postKeyword(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.name).toBe("AI内容");
    expect(body.data.platforms).toEqual(["xhs", "wx"]);
    expect(body.data.categoryId).toBe("cat1");
  });

  it("returns 400 when required fields are missing", async () => {
    const request = new Request("http://localhost/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "AI" }),
    });
    const response = await postKeyword(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toBe("缺少必要参数");
  });
});

describe("DELETE /api/keywords/[id]", () => {
  it("deletes an existing keyword", async () => {
    // Create a keyword first
    const createReq = new Request("http://localhost/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ToDelete", platforms: ["xhs"], categoryId: "cat1" }),
    });
    const createRes = await postKeyword(createReq as any);
    const created = await createRes.json();

    const response = await deleteKeyword({} as any, { params: { id: created.data.id } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
  });

  it("returns 404 for non-existent keyword", async () => {
    const response = await deleteKeyword({} as any, { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe(404);
  });
});
