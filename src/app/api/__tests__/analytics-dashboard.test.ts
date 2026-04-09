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

import { GET } from "../analytics/dashboard/route";
import { _testResetDB, saveArticle, createGeneratedContent, createKeyword, createCollectionLog, createCategory } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/analytics/dashboard", () => {
  it("returns empty data when no articles exist", async () => {
    const request = new Request("http://localhost/api/analytics/dashboard");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.totalArticles).toBe(0);
    expect(body.data.weeklyArticles).toBe(0);
    expect(body.data.platformDistribution).toEqual([]);
    expect(body.data.generatedContentStats.total).toBe(0);
    expect(body.data.topKeywords).toEqual([]);
  });

  it("returns correct article counts", async () => {
    const now = Date.now();
    await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      title: "Test Article 1",
      content: "Content",
      author: "Author",
      url: "http://example.com/1",
      likes: 10,
      comments: 5,
      collectedAt: now,
      publishedAt: now,
    });
    await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "wx",
      title: "Test Article 2",
      content: "Content",
      author: "Author",
      url: "http://example.com/2",
      likes: 20,
      comments: 10,
      collectedAt: now - 8 * 24 * 60 * 60 * 1000, // 8 days ago, not this week
    });

    const request = new Request("http://localhost/api/analytics/dashboard");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.totalArticles).toBe(2);
    expect(body.data.weeklyArticles).toBe(1);
  });

  it("returns correct platform distribution", async () => {
    const now = Date.now();
    await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      title: "XHS Article",
      content: "Content",
      author: "Author",
      url: "http://example.com/xhs",
      likes: 10,
      comments: 5,
      collectedAt: now,
      publishedAt: now,
    });
    await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "wx",
      title: "WX Article",
      content: "Content",
      author: "Author",
      url: "http://example.com/wx",
      likes: 20,
      comments: 10,
      collectedAt: now,
      publishedAt: now,
    });

    const request = new Request("http://localhost/api/analytics/dashboard");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.platformDistribution).toHaveLength(2);
    expect(body.data.platformDistribution.find((p: any) => p.platform === "xhs")?.count).toBe(1);
    expect(body.data.platformDistribution.find((p: any) => p.platform === "wx")?.count).toBe(1);
  });

  it("returns correct generated content stats", async () => {
    await createGeneratedContent({
      topic: "Topic 1",
      content: "Content 1",
      status: "draft",
    });
    await createGeneratedContent({
      topic: "Topic 2",
      content: "Content 2",
      status: "reviewed",
    });

    const request = new Request("http://localhost/api/analytics/dashboard");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.generatedContentStats.total).toBe(2);
    expect(body.data.generatedContentStats.byStatus).toContainEqual(
      expect.objectContaining({ status: "draft", count: 1 })
    );
    expect(body.data.generatedContentStats.byStatus).toContainEqual(
      expect.objectContaining({ status: "reviewed", count: 1 })
    );
  });

  it("returns top keywords with article counts", async () => {
    const catId = "cat1";
    await createCategory(catId);
    const kw1 = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: catId });
    await createKeyword({ name: "Tech", platforms: ["wx"], categoryId: catId });

    const now = Date.now();
    await saveArticle({
      keywordId: kw1.id,
      keywordName: "AI",
      platform: "xhs",
      title: "AI Article 1",
      content: "Content",
      author: "Author",
      url: "http://example.com/ai1",
      likes: 10,
      comments: 5,
      collectedAt: now,
      publishedAt: now,
    });
    await saveArticle({
      keywordId: kw1.id,
      keywordName: "AI",
      platform: "xhs",
      title: "AI Article 2",
      content: "Content",
      author: "Author",
      url: "http://example.com/ai2",
      likes: 20,
      comments: 10,
      collectedAt: now,
      publishedAt: now,
    });

    const request = new Request("http://localhost/api/analytics/dashboard");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.topKeywords).toHaveLength(2);
    // Top keyword should be AI with 2 articles
    expect(body.data.topKeywords[0].keywordName).toBe("AI");
    expect(body.data.topKeywords[0].articleCount).toBe(2);
  });

  it("returns 7 days of collection trend data", async () => {
    const request = new Request("http://localhost/api/analytics/dashboard");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.collectionTrend).toHaveLength(7);
    // All should have date strings in YYYY-MM-DD format
    body.data.collectionTrend.forEach((day: any) => {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof day.count).toBe("number");
    });
  });
});
