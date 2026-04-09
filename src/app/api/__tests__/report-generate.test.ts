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

// Mock wiki module
vi.mock(import("@/lib/wiki"), () => ({
  getWikiIndex: vi.fn().mockResolvedValue(""),
}));

// Mock content-generator to avoid actual AI calls
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionJSON: vi.fn().mockResolvedValue(
    JSON.stringify({
      summary: "AI is trending",
      topics: [
        { title: "Topic 1", why: "Reason 1", boom: "Boom 1", growth: "Growth 1" },
        { title: "Topic 2", why: "Reason 2", boom: "Boom 2", growth: "Growth 2" },
      ],
    })
  ),
  parseJSON: vi.fn().mockReturnValue({
    summary: "AI is trending",
    topics: [
      { title: "Topic 1", why: "Reason 1", boom: "Boom 1", growth: "Growth 1" },
      { title: "Topic 2", why: "Reason 2", boom: "Boom 2", growth: "Growth 2" },
    ],
  }),
}));

import { POST } from "../report/generate/route";
import { _testResetDB, saveArticle, createApiConfig, createKeyword } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("POST /api/report/generate", () => {
  it("returns 400 when categoryId is missing", async () => {
    const request = new Request("http://localhost/api/report/generate", {
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

  it("returns 400 when no articles exist for category", async () => {
    const request = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "empty-cat" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("暂无文章");
  });

  it("returns 400 when no API config is set", async () => {
    // Create a keyword and article in a category
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    await saveArticle({
      keywordId: kw.id,
      keywordName: "AI",
      platform: "xhs",
      title: "Test Article",
      content: "c",
      author: "a",
      url: "https://example.com/1",
      likes: 10,
      comments: 5,
      collectedAt: Date.now(),
      publishedAt: Date.now(),
      extra: {},
    });

    const request = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("未配置");
  });

  it("successfully generates a report", async () => {
    // Set up: create keyword, article, and API config
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    await saveArticle({
      keywordId: kw.id,
      keywordName: "AI",
      platform: "xhs",
      title: "AI Trends 2025",
      content: "Content about AI trends",
      author: "author",
      url: "https://example.com/1",
      likes: 100,
      comments: 50,
      collectedAt: Date.now(),
      publishedAt: Date.now(),
      extra: {},
    });

    await createApiConfig({
      name: "Test API",
      apiUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      modelName: "gpt-4",
      isDefault: true,
    });

    const request = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "cat1" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeTruthy();
    expect(body.data.categoryId).toBe("cat1");
    expect(body.data.summary).toBeTruthy();
    expect(body.data.topics).toHaveLength(2);
    expect(body.data.topics[0].title).toBe("Topic 1");
    expect(body.data.topics[0].why).toBe("Reason 1");
  });
});
