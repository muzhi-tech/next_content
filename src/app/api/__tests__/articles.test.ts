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

import { GET } from "../articles/route";
import { _testResetDB, saveArticle, createKeyword } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/articles", () => {
  it("returns empty list when no articles exist", async () => {
    const request = new Request("http://localhost/api/articles");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it("returns articles with pagination", async () => {
    // Save some articles directly via db
    await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      title: "Article 1",
      content: "c",
      author: "a",
      url: "https://example.com/1",
      likes: 10,
      comments: 5,
      collectedAt: 1000,
      publishedAt: 900,
      extra: {},
    });
    await saveArticle({
      keywordId: "kw1",
      keywordName: "AI",
      platform: "xhs",
      title: "Article 2",
      content: "c",
      author: "a",
      url: "https://example.com/2",
      likes: 20,
      comments: 10,
      collectedAt: 2000,
      publishedAt: 1900,
      extra: {},
    });

    const request = new Request("http://localhost/api/articles");
    const response = await GET(request as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(2);
    // Sorted by collectedAt desc
    expect(body.data[0].title).toBe("Article 2");
    expect(body.data[1].title).toBe("Article 1");
  });

  it("filters articles by categoryId", async () => {
    // Create a keyword in category "cat1"
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    await saveArticle({
      keywordId: kw.id,
      keywordName: "AI",
      platform: "xhs",
      title: "Categorized Article",
      content: "c",
      author: "a",
      url: "https://example.com/1",
      likes: 10,
      comments: 5,
      collectedAt: 1000,
      publishedAt: 900,
      extra: {},
    });
    // Save article in different category
    await saveArticle({
      keywordId: "other-kw",
      keywordName: "Other",
      platform: "wx",
      title: "Other Article",
      content: "c",
      author: "a",
      url: "https://example.com/2",
      likes: 5,
      comments: 2,
      collectedAt: 2000,
      publishedAt: 1900,
      extra: {},
    });

    const request = new Request("http://localhost/api/articles?categoryId=cat1");
    const response = await GET(request as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.total).toBe(1);
    expect(body.data[0].title).toBe("Categorized Article");
  });
});
