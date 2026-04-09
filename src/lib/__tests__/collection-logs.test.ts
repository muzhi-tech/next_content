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

import {
  _testResetDB,
  createCollectionLog,
  getCollectionLogs,
} from "../db";

beforeEach(() => {
  _testResetDB();
});

describe("CollectionLogs", () => {
  it("creates a collection log", async () => {
    const now = Date.now();
    const log = await createCollectionLog({
      categoryId: "cat1",
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      status: "success",
      articleCount: 10,
      startedAt: now,
      completedAt: now + 5000,
    });

    expect(log.id).toBeTruthy();
    expect(log.categoryId).toBe("cat1");
    expect(log.platform).toBe("xhs");
    expect(log.status).toBe("success");
    expect(log.articleCount).toBe(10);
  });

  it("creates a failed log with errorMsg", async () => {
    const log = await createCollectionLog({
      categoryId: "cat1",
      platform: "wx",
      status: "failed",
      articleCount: 0,
      errorMsg: "Connection timeout",
      startedAt: Date.now(),
    });

    expect(log.status).toBe("failed");
    expect(log.errorMsg).toBe("Connection timeout");
  });

  it("gets collection logs with categoryId filter", async () => {
    await createCollectionLog({
      categoryId: "cat1",
      platform: "xhs",
      status: "success",
      articleCount: 5,
      startedAt: Date.now(),
    });
    await createCollectionLog({
      categoryId: "cat2",
      platform: "wx",
      status: "success",
      articleCount: 3,
      startedAt: Date.now(),
    });

    const cat1Logs = await getCollectionLogs({ categoryId: "cat1" });
    expect(cat1Logs).toHaveLength(1);
    expect(cat1Logs[0].platform).toBe("xhs");

    const cat2Logs = await getCollectionLogs({ categoryId: "cat2" });
    expect(cat2Logs).toHaveLength(1);
    expect(cat2Logs[0].platform).toBe("wx");
  });

  it("gets collection logs with limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createCollectionLog({
        platform: "xhs",
        status: "success",
        articleCount: i,
        startedAt: Date.now() + i * 1000,
      });
    }

    const limited = await getCollectionLogs({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it("returns logs sorted by startedAt descending", async () => {
    await createCollectionLog({
      platform: "xhs",
      status: "success",
      articleCount: 1,
      startedAt: 1000,
    });
    await createCollectionLog({
      platform: "wx",
      status: "success",
      articleCount: 2,
      startedAt: 3000,
    });
    await createCollectionLog({
      platform: "dy",
      status: "success",
      articleCount: 3,
      startedAt: 2000,
    });

    const logs = await getCollectionLogs({});
    expect(logs[0].startedAt).toBe(3000);
    expect(logs[1].startedAt).toBe(2000);
    expect(logs[2].startedAt).toBe(1000);
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

    const logs = await getCollectionLogs({});
    expect(logs).toHaveLength(50);
  });
});
