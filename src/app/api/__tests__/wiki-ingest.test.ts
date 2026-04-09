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

// Mock wiki-ingest to avoid actual AI calls
vi.mock(import("@/lib/wiki-ingest"), () => ({
  ingestArticleToWiki: vi.fn().mockResolvedValue({
    updatedEntities: ["entity1"],
    updatedTopics: ["topic1"],
    createdPages: ["page1"],
    conflicts: [],
    logEntry: "test log",
  }),
}));

import { POST } from "../wiki/ingest/route";
import { _testResetDB, saveArticle, createApiConfig } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("POST /api/wiki/ingest", () => {
  it("returns 400 when articleId is missing", async () => {
    const request = new Request("http://localhost/api/wiki/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("articleId");
  });

  it("returns 400 when categoryId is missing", async () => {
    const request = new Request("http://localhost/api/wiki/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: "art1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("categoryId");
  });

  it("returns 404 when article does not exist", async () => {
    const request = new Request("http://localhost/api/wiki/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: "nonexistent", categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe(404);
    expect(body.msg).toContain("文章不存在");
  });

  it("returns 400 when no API config is set", async () => {
    // Save an article but no API config
    const article = await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      title: "Test Article",
      content: "Some content",
      author: "author",
      url: "https://example.com/1",
      likes: 10,
      comments: 5,
      collectedAt: Date.now(),
      publishedAt: Date.now(),
      extra: {},
    });

    const request = new Request("http://localhost/api/wiki/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: article.id, categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("未配置");
  });

  it("successfully ingests an article to wiki", async () => {
    // Save an article
    const article = await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      title: "Test Article",
      content: "Some content about AI",
      author: "author",
      url: "https://example.com/1",
      likes: 10,
      comments: 5,
      collectedAt: Date.now(),
      publishedAt: Date.now(),
      extra: {},
    });

    // Create API config
    await createApiConfig({
      name: "Test API",
      apiUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      modelName: "gpt-4",
      isDefault: true,
    });

    const request = new Request("http://localhost/api/wiki/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: article.id, categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toBeDefined();
    expect(body.data.updatedEntities).toContain("entity1");
    expect(body.data.createdPages).toContain("page1");
  });
});
