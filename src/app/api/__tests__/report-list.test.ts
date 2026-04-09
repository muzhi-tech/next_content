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

import { GET } from "../report/list/route";
import { _testResetDB, addReport } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/report/list", () => {
  it("returns empty list when no reports exist", async () => {
    const request = new Request("http://localhost/api/report/list");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toEqual([]);
  });

  it("returns all reports without filter", async () => {
    await addReport({
      id: "r1",
      categoryId: "cat1",
      createdAt: new Date().toISOString(),
      summary: "Report 1",
      topics: [{ title: "T1", why: "W1", boom: "B1", growth: "G1" }],
    });
    await addReport({
      id: "r2",
      categoryId: "cat2",
      createdAt: new Date().toISOString(),
      summary: "Report 2",
      topics: [{ title: "T2", why: "W2", boom: "B2", growth: "G2" }],
    });

    const request = new Request("http://localhost/api/report/list");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toHaveLength(2);
  });

  it("returns reports filtered by categoryId", async () => {
    await addReport({
      id: "r1",
      categoryId: "cat1",
      createdAt: new Date().toISOString(),
      summary: "Report 1",
      topics: [{ title: "T1", why: "W1", boom: "B1", growth: "G1" }],
    });
    await addReport({
      id: "r2",
      categoryId: "cat2",
      createdAt: new Date().toISOString(),
      summary: "Report 2",
      topics: [{ title: "T2", why: "W2", boom: "B2", growth: "G2" }],
    });

    const request = new Request("http://localhost/api/report/list?categoryId=cat1");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].categoryId).toBe("cat1");
    expect(body.data[0].summary).toBe("Report 1");
  });
});
