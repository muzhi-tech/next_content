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

import { GET as getCollectionLogs } from "../collection-logs/route";
import { _testResetDB, createCollectionLog } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/collection-logs", () => {
  it("returns empty list when no logs", async () => {
    const request = new Request("http://localhost/api/collection-logs");
    const response = await getCollectionLogs(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toEqual([]);
  });

  it("returns all logs ordered by startedAt desc", async () => {
    for (let i = 0; i < 3; i++) {
      await createCollectionLog({
        platform: "xhs",
        status: "success",
        articleCount: i,
        startedAt: Date.now() + i * 1000,
      });
    }

    const request = new Request("http://localhost/api/collection-logs");
    const response = await getCollectionLogs(request as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data).toHaveLength(3);
    expect(body.data[0].articleCount).toBe(2);
    expect(body.data[2].articleCount).toBe(0);
  });

  it("filters by categoryId", async () => {
    await createCollectionLog({ categoryId: "cat1", platform: "xhs", status: "success", articleCount: 5, startedAt: Date.now() });
    await createCollectionLog({ categoryId: "cat2", platform: "wx", status: "success", articleCount: 3, startedAt: Date.now() });

    const request = new Request("http://localhost/api/collection-logs?categoryId=cat1");
    const response = await getCollectionLogs(request as any);
    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].categoryId).toBe("cat1");
    expect(body.data[0].articleCount).toBe(5);
  });

  it("respects limit parameter", async () => {
    for (let i = 0; i < 10; i++) {
      await createCollectionLog({
        platform: "xhs",
        status: "success",
        articleCount: i,
        startedAt: Date.now() + i,
      });
    }

    const request = new Request("http://localhost/api/collection-logs?limit=5");
    const response = await getCollectionLogs(request as any);
    const body = await response.json();

    expect(body.data).toHaveLength(5);
  });

  it("defaults limit to 50", async () => {
    for (let i = 0; i < 60; i++) {
      await createCollectionLog({
        platform: "xhs",
        status: "success",
        articleCount: i,
        startedAt: Date.now() + i,
      });
    }

    const request = new Request("http://localhost/api/collection-logs");
    const response = await getCollectionLogs(request as any);
    const body = await response.json();

    expect(body.data).toHaveLength(50);
  });

  it("includes errorMsg for failed logs", async () => {
    await createCollectionLog({
      platform: "wx",
      status: "failed",
      articleCount: 0,
      errorMsg: "Connection timeout",
      startedAt: Date.now(),
    });

    const request = new Request("http://localhost/api/collection-logs");
    const response = await getCollectionLogs(request as any);
    const body = await response.json();

    expect(body.data[0].status).toBe("failed");
    expect(body.data[0].errorMsg).toBe("Connection timeout");
  });
});
