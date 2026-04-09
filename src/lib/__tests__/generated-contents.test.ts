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
  createGeneratedContent,
  getGeneratedContents,
  getGeneratedContent,
  updateGeneratedContent,
  deleteGeneratedContent,
  createCategory,
} from "../db";

beforeEach(() => {
  _testResetDB();
});

describe("GeneratedContents", () => {
  it("creates and retrieves content", async () => {
    const item = await createGeneratedContent({
      categoryId: "cat1",
      topic: "AI未来趋势",
      content: "这是一篇关于AI趋势的文章",
      style: "casual",
      status: "draft",
      sourceType: "manual",
    });

    expect(item.id).toBeTruthy();
    expect(item.topic).toBe("AI未来趋势");
    expect(item.content).toBe("这是一篇关于AI趋势的文章");
    expect(item.status).toBe("draft");
    expect(item.sourceType).toBe("manual");

    const fetched = await getGeneratedContent(item.id);
    expect(fetched).toBeDefined();
    expect(fetched?.topic).toBe("AI未来趋势");
  });

  it("lists contents with pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await createGeneratedContent({
        topic: `Topic ${i}`,
        content: `Content ${i}`,
      });
    }

    const page1 = await getGeneratedContents({ page: 1, pageSize: 3 });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(3);

    const page2 = await getGeneratedContents({ page: 2, pageSize: 3 });
    expect(page2.items).toHaveLength(2);
  });

  it("filters by status", async () => {
    await createGeneratedContent({ topic: "Draft", content: "c", status: "draft" });
    await createGeneratedContent({ topic: "Published", content: "c", status: "published" });
    await createGeneratedContent({ topic: "Archived", content: "c", status: "archived" });

    const drafts = await getGeneratedContents({ status: "draft" });
    expect(drafts.total).toBe(1);
    expect(drafts.items[0].topic).toBe("Draft");

    const published = await getGeneratedContents({ status: "published" });
    expect(published.total).toBe(1);
  });

  it("filters by categoryId", async () => {
    const cat = await createCategory("TestCat");
    await createGeneratedContent({ categoryId: cat.id, topic: "InCat", content: "c" });
    await createGeneratedContent({ categoryId: "other", topic: "Other", content: "c" });

    const result = await getGeneratedContents({ categoryId: cat.id });
    expect(result.total).toBe(1);
    expect(result.items[0].topic).toBe("InCat");
  });

  it("searches by topic", async () => {
    await createGeneratedContent({ topic: "深度学习入门指南", content: "c" });
    await createGeneratedContent({ topic: "React hooks 详解", content: "c" });
    await createGeneratedContent({ topic: "深度学习实战案例", content: "c" });

    const result = await getGeneratedContents({ search: "深度学习" });
    expect(result.total).toBe(2);
  });

  it("updates content and status", async () => {
    const item = await createGeneratedContent({
      topic: "Original Topic",
      content: "Original Content",
      status: "draft",
    });

    const updated = await updateGeneratedContent(item.id, {
      topic: "Updated Topic",
      status: "published",
    });

    expect(updated?.topic).toBe("Updated Topic");
    expect(updated?.status).toBe("published");

    const fetched = await getGeneratedContent(item.id);
    expect(fetched?.topic).toBe("Updated Topic");
  });

  it("updateGeneratedContent returns null for unknown id", async () => {
    const result = await updateGeneratedContent("nonexistent", { topic: "x" });
    expect(result).toBeNull();
  });

  it("deletes content", async () => {
    const item = await createGeneratedContent({ topic: "ToDelete", content: "c" });

    const deleted = await deleteGeneratedContent(item.id);
    expect(deleted).toBe(true);

    const fetched = await getGeneratedContent(item.id);
    expect(fetched).toBeNull();
  });

  it("deleteGeneratedContent returns false for unknown id", async () => {
    const result = await deleteGeneratedContent("nonexistent");
    expect(result).toBe(false);
  });

  it("defaults sourceType to manual", async () => {
    const item = await createGeneratedContent({ topic: "Test", content: "c" });
    expect(item.sourceType).toBe("manual");
  });

  it("sets sourceType to pipeline", async () => {
    const item = await createGeneratedContent({ topic: "Test", content: "c", sourceType: "pipeline" });
    expect(item.sourceType).toBe("pipeline");
  });
});
