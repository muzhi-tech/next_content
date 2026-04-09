import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Article } from "../types";

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
  getKeywords,
  getKeyword,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  getArticles,
  saveArticle,
  saveArticles,
  deleteArticlesByKeyword,
  getApiConfigs,
  getDefaultApiConfig,
  createApiConfig,
  updateApiConfig,
  deleteApiConfig,
  getPersonas,
  getPersona,
  createPersona,
  updatePersona,
  deletePersona,
  getStyles,
  getStyle,
  createStyle,
  updateStyle,
  deleteStyle,
  getKnowledgeBases,
  getKnowledgeBase,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getCategories,
  createCategory,
  deleteCategory,
  buildAIContext,
} from "../db";

beforeEach(() => {
  _testResetDB();
});

// ============ Keywords ============

describe("Keywords CRUD", () => {
  it("getKeywords returns empty list initially", async () => {
    const result = await getKeywords();
    expect(result).toHaveLength(0);
  });

  it("createKeyword adds a keyword", async () => {
    const kw = await createKeyword({ name: "Test", platforms: ["xhs"], categoryId: "c1" });
    expect(kw.name).toBe("Test");
    expect(kw.platforms).toEqual(["xhs"]);
    expect(kw.id).toBeTruthy();
  });

  it("getKeywords returns all keywords", async () => {
    await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    await createKeyword({ name: "Tech", platforms: ["wx"], categoryId: "cat2" });
    const result = await getKeywords();
    expect(result).toHaveLength(2);
  });

  it("getKeywords filters by categoryId", async () => {
    await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    await createKeyword({ name: "Tech", platforms: ["wx"], categoryId: "cat2" });
    const result = await getKeywords("cat1");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("AI");
  });

  it("getKeyword returns keyword by id", async () => {
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    const result = await getKeyword(kw.id);
    expect(result?.name).toBe("AI");
  });

  it("getKeyword returns null for unknown id", async () => {
    const result = await getKeyword("nonexistent");
    expect(result).toBeNull();
  });

  it("updateKeyword modifies name and platforms", async () => {
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    const updated = await updateKeyword(kw.id, { name: "AI Updated", platforms: ["xhs", "wx"] });
    expect(updated?.name).toBe("AI Updated");
    expect(updated?.platforms).toEqual(["xhs", "wx"]);
  });

  it("updateKeyword returns null for unknown id", async () => {
    const result = await updateKeyword("nonexistent", { name: "x" });
    expect(result).toBeNull();
  });

  it("deleteKeyword removes keyword", async () => {
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: "cat1" });
    const result = await deleteKeyword(kw.id);
    expect(result).toBe(true);
    const all = await getKeywords();
    expect(all).toHaveLength(0);
  });

  it("deleteKeyword returns false for unknown id", async () => {
    const result = await deleteKeyword("nonexistent");
    expect(result).toBe(false);
  });
});

// ============ Articles ============

describe("Articles CRUD", () => {
  const sampleArticle: Omit<Article, "id"> = {
    keywordId: "kw1",
    keywordName: "AI",
    platform: "xhs",
    title: "Test Article",
    content: "content",
    author: "author",
    url: "https://example.com/1",
    likes: 10,
    comments: 5,
    collectedAt: 1000,
    publishedAt: 900,
    extra: {},
  };

  it("saveArticle creates new article", async () => {
    const result = await saveArticle(sampleArticle);
    expect(result.id).toBeTruthy();
    expect(result.title).toBe("Test Article");
  });

  it("saveArticle updates existing article by platform+url", async () => {
    const first = await saveArticle(sampleArticle);
    const updated = await saveArticle({ ...sampleArticle, title: "Updated Title" });
    expect(updated.id).toBe(first.id);
    expect(updated.title).toBe("Updated Title");
    const { total } = await getArticles({});
    expect(total).toBe(1);
  });

  it("getArticles returns paginated results sorted by collectedAt desc", async () => {
    await saveArticle({ ...sampleArticle, collectedAt: 1000 });
    await saveArticle({ ...sampleArticle, collectedAt: 2000, url: "https://example.com/2" });
    await saveArticle({ ...sampleArticle, collectedAt: 1500, url: "https://example.com/3" });
    const result = await getArticles({ page: 1, pageSize: 2 });
    expect(result.total).toBe(3);
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].collectedAt).toBe(2000);
    expect(result.articles[1].collectedAt).toBe(1500);
  });

  it("getArticles filters by platform", async () => {
    await saveArticle({ ...sampleArticle, platform: "xhs" as const });
    await saveArticle({ ...sampleArticle, platform: "wx" as const, url: "https://example.com/2" });
    const result = await getArticles({ platform: "wx" });
    expect(result.total).toBe(1);
    expect(result.articles[0].platform).toBe("wx");
  });

  it("deleteArticlesByKeyword removes matching articles", async () => {
    await saveArticle({ ...sampleArticle, keywordId: "kw1" });
    await saveArticle({ ...sampleArticle, keywordId: "kw2", url: "https://example.com/2" });
    await deleteArticlesByKeyword("kw1");
    const { total } = await getArticles({});
    expect(total).toBe(1);
  });

  it("saveArticles calls saveArticle for each item", async () => {
    const result = await saveArticles([
      { ...sampleArticle },
      { ...sampleArticle, url: "https://example.com/2" },
    ]);
    expect(result.added).toBe(2);
  });
});

// ============ ApiConfigs ============

describe("ApiConfig CRUD", () => {
  it("createApiConfig adds config", async () => {
    const config = await createApiConfig({
      name: "Test API",
      apiUrl: "https://api.test.com/v1",
      apiKey: "key123",
      modelName: "gpt-4",
      isDefault: true,
    });
    expect(config.name).toBe("Test API");
    expect(config.isDefault).toBe(true);
  });

  it("createApiConfig with isDefault cancels other defaults", async () => {
    await createApiConfig({
      name: "Old",
      apiUrl: "",
      apiKey: "",
      modelName: "",
      isDefault: true,
    });
    await createApiConfig({
      name: "New",
      apiUrl: "https://new.com",
      apiKey: "k",
      modelName: "m",
      isDefault: true,
    });
    const all = await getApiConfigs();
    expect(all[0].isDefault).toBe(false);
    expect(all[1].isDefault).toBe(true);
  });

  it("getDefaultApiConfig returns first default config", async () => {
    await createApiConfig({
      name: "Not Default",
      apiUrl: "",
      apiKey: "",
      modelName: "",
      isDefault: false,
    });
    await createApiConfig({
      name: "Default",
      apiUrl: "",
      apiKey: "",
      modelName: "",
      isDefault: true,
    });
    const result = await getDefaultApiConfig();
    expect(result?.name).toBe("Default");
  });

  it("getDefaultApiConfig falls back to first config", async () => {
    await createApiConfig({
      name: "First",
      apiUrl: "",
      apiKey: "",
      modelName: "",
      isDefault: false,
    });
    const result = await getDefaultApiConfig();
    expect(result?.name).toBe("First");
  });

  it("updateApiConfig modifies config fields", async () => {
    const config = await createApiConfig({
      name: "Old",
      apiUrl: "",
      apiKey: "",
      modelName: "",
      isDefault: false,
    });
    const updated = await updateApiConfig(config.id, { name: "New Name", isDefault: true });
    expect(updated?.name).toBe("New Name");
    expect(updated?.isDefault).toBe(true);
  });

  it("deleteApiConfig removes config", async () => {
    const config = await createApiConfig({
      name: "ToDelete",
      apiUrl: "",
      apiKey: "",
      modelName: "",
      isDefault: false,
    });
    const result = await deleteApiConfig(config.id);
    expect(result).toBe(true);
    const all = await getApiConfigs();
    expect(all).toHaveLength(0);
  });
});

// ============ Personas ============

describe("Persona CRUD", () => {
  it("create and get persona", async () => {
    const p = await createPersona({ name: "Bot", description: "A bot", systemPrompt: "You are a bot" });
    expect(p.name).toBe("Bot");
    const fetched = await getPersona(p.id);
    expect(fetched?.name).toBe("Bot");
  });

  it("update persona", async () => {
    const p = await createPersona({ name: "Old", description: "d", systemPrompt: "sp" });
    const updated = await updatePersona(p.id, { name: "New" });
    expect(updated?.name).toBe("New");
  });

  it("delete persona", async () => {
    const p = await createPersona({ name: "ToDelete", description: "d", systemPrompt: "sp" });
    expect(await deletePersona(p.id)).toBe(true);
    const all = await getPersonas();
    expect(all).toHaveLength(0);
  });
});

// ============ Styles ============

describe("Style CRUD", () => {
  it("create and get style", async () => {
    const s = await createStyle({ name: "Casual", icon: "🎨", systemPrompt: "Write casually" });
    expect(s.name).toBe("Casual");
    const fetched = await getStyle(s.id);
    expect(fetched?.name).toBe("Casual");
  });

  it("update style", async () => {
    const s = await createStyle({ name: "Old", icon: "x", systemPrompt: "sp" });
    const updated = await updateStyle(s.id, { name: "New" });
    expect(updated?.name).toBe("New");
  });

  it("delete style", async () => {
    const s = await createStyle({ name: "ToDelete", icon: "x", systemPrompt: "sp" });
    expect(await deleteStyle(s.id)).toBe(true);
    const all = await getStyles();
    expect(all).toHaveLength(0);
  });
});

// ============ KnowledgeBases ============

describe("KnowledgeBase CRUD", () => {
  it("create and get knowledge base", async () => {
    const kb = await createKnowledgeBase({ name: "KB1", description: "desc", content: "content" });
    expect(kb.name).toBe("KB1");
    const fetched = await getKnowledgeBase(kb.id);
    expect(fetched?.name).toBe("KB1");
  });

  it("update knowledge base", async () => {
    const kb = await createKnowledgeBase({ name: "Old", description: "d", content: "c" });
    const updated = await updateKnowledgeBase(kb.id, { name: "New" });
    expect(updated?.name).toBe("New");
  });

  it("delete knowledge base", async () => {
    const kb = await createKnowledgeBase({ name: "ToDelete", description: "d", content: "c" });
    expect(await deleteKnowledgeBase(kb.id)).toBe(true);
    const all = await getKnowledgeBases();
    expect(all).toHaveLength(0);
  });
});

// ============ Templates ============

describe("WxTemplate CRUD", () => {
  it("create and get template", async () => {
    const t = await createTemplate({
      name: "T1",
      titleTemplate: "Title: {topic}",
      contentTemplate: "Content for {topic}",
      coverPromptTemplate: "Cover for {topic}",
    });
    expect(t.name).toBe("T1");
    const fetched = await getTemplate(t.id);
    expect(fetched?.name).toBe("T1");
  });

  it("update template", async () => {
    const t = await createTemplate({ name: "Old", titleTemplate: "t", contentTemplate: "c" });
    const updated = await updateTemplate(t.id, { name: "New" });
    expect(updated?.name).toBe("New");
  });

  it("delete template", async () => {
    const t = await createTemplate({ name: "ToDelete", titleTemplate: "t", contentTemplate: "c" });
    expect(await deleteTemplate(t.id)).toBe(true);
    const all = await getTemplates();
    expect(all).toHaveLength(0);
  });
});

// ============ Categories ============

describe("Category CRUD", () => {
  it("create and get category", async () => {
    const cat = await createCategory("Tech");
    expect(cat.name).toBe("Tech");
    const all = await getCategories();
    expect(all).toHaveLength(2); // default seed + newly created
  });

  it("deleteCategory also removes associated keywords and articles", async () => {
    const cat = await createCategory("Tech");
    const kw = await createKeyword({ name: "AI", platforms: ["xhs"], categoryId: cat.id });
    await saveArticle({
      keywordId: kw.id,
      keywordName: "AI",
      platform: "xhs",
      title: "t",
      content: "c",
      author: "a",
      url: "u",
      likes: 0,
      comments: 0,
      collectedAt: 1,
      publishedAt: 1,
      extra: {},
    });

    const result = await deleteCategory(cat.id);
    expect(result).toBe(true);
    expect(await getCategories()).toHaveLength(1); // seed default remains
    expect(await getKeywords()).toHaveLength(0);
    const { total } = await getArticles({});
    expect(total).toBe(0);
  });
});

// ============ buildAIContext ============

describe("buildAIContext", () => {
  it("returns empty system prompt when no params", async () => {
    const { systemPrompt, contextData } = await buildAIContext({});
    expect(systemPrompt).toBe("");
    expect(contextData.persona).toBeUndefined();
    expect(contextData.style).toBeUndefined();
    expect(contextData.knowledgeBases).toEqual([]);
    expect(contextData.template).toBeUndefined();
  });

  it("includes persona in system prompt", async () => {
    const p = await createPersona({ name: "Expert", description: "d", systemPrompt: "You are an expert" });
    const { systemPrompt, contextData } = await buildAIContext({ personaId: p.id });
    expect(systemPrompt).toContain("You are an expert");
    expect(contextData.persona?.name).toBe("Expert");
  });

  it("includes style in system prompt", async () => {
    const s = await createStyle({ name: "Casual", icon: "x", systemPrompt: "Write casually" });
    const { systemPrompt } = await buildAIContext({ styleId: s.id });
    expect(systemPrompt).toContain("Write casually");
  });

  it("includes knowledge bases in system prompt", async () => {
    const kb = await createKnowledgeBase({ name: "AI知识", description: "d", content: "AI is powerful" });
    const { systemPrompt, contextData } = await buildAIContext({ knowledgeIds: [kb.id] });
    expect(systemPrompt).toContain("AI知识");
    expect(systemPrompt).toContain("AI is powerful");
    expect(contextData.knowledgeBases).toHaveLength(1);
  });

  it("includes template in system prompt", async () => {
    const t = await createTemplate({
      name: "T1",
      titleTemplate: "Title: {topic}",
      contentTemplate: "Body: {topic}",
    });
    const { systemPrompt } = await buildAIContext({ templateId: t.id });
    expect(systemPrompt).toContain("Title: {topic}");
    expect(systemPrompt).toContain("Body: {topic}");
  });

  it("combines all context elements", async () => {
    const p = await createPersona({ name: "P", description: "d", systemPrompt: "persona prompt" });
    const s = await createStyle({ name: "S", icon: "x", systemPrompt: "style prompt" });
    const kb = await createKnowledgeBase({ name: "KB", description: "d", content: "knowledge" });

    const { systemPrompt } = await buildAIContext({
      personaId: p.id,
      styleId: s.id,
      knowledgeIds: [kb.id],
    });

    expect(systemPrompt).toContain("persona prompt");
    expect(systemPrompt).toContain("style prompt");
    expect(systemPrompt).toContain("knowledge");
  });

  it("handles non-existent IDs gracefully", async () => {
    const { systemPrompt, contextData } = await buildAIContext({
      personaId: "nonexistent",
      styleId: "nonexistent",
      knowledgeIds: ["nonexistent"],
      templateId: "nonexistent",
    });
    expect(systemPrompt).toBe("");
    expect(contextData.persona).toBeUndefined();
    expect(contextData.style).toBeUndefined();
    expect(contextData.knowledgeBases).toEqual([]);
  });
});
