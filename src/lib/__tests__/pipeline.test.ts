import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionJSON: vi.fn(),
  parseJSON: vi.fn(),
}));

vi.mock(import("../wiki-query"), () => ({
  buildWikiContext: vi.fn(),
}));

vi.mock(import("../agents/humanize"), () => ({
  humanizeContent: vi.fn(),
}));

vi.mock(import("../agents/score"), () => ({
  scoreContent: vi.fn(),
}));

vi.mock(import("../agents/review"), () => ({
  reviewContent: vi.fn(),
}));

vi.mock(import("../agents/illustrate"), () => ({
  generateIllustrations: vi.fn(),
}));

vi.mock(import("../agents/publisher"), () => ({
  publishContent: vi.fn(),
}));

vi.mock(import("../agents/style-extractor"), () => ({
  extractStyleProfile: vi.fn(),
}));

// Mock db for executeCollect + pipeline persistence
vi.mock(import("@/lib/db"), () => ({
  getArticles: vi.fn(),
  getPipelineRun: vi.fn(),
  createPipelineRun: vi.fn(),
  updatePipelineStep: vi.fn(),
  updatePipelineStatus: vi.fn(),
  updatePipelineRun: vi.fn(),
  listPipelineRuns: vi.fn(),
}));

import { createChatCompletionJSON } from "@/lib/content-generator";
import { humanizeContent } from "../agents/humanize";
import { scoreContent } from "../agents/score";
import { reviewContent } from "../agents/review";
import { generateIllustrations } from "../agents/illustrate";
import { publishContent } from "../agents/publisher";
import { extractStyleProfile } from "../agents/style-extractor";
import { getArticles, getPipelineRun, createPipelineRun, updatePipelineStep, updatePipelineStatus, updatePipelineRun, listPipelineRuns } from "@/lib/db";
import { runPipeline, getPipeline } from "../pipeline";

const mockConfig = { apiUrl: "https://api.test.com/v1", apiKey: "test-key", modelName: "test-model" };

// In-memory store for mock pipeline runs
const mockPipelineStore = new Map<string, any>();

beforeEach(() => {
  vi.clearAllMocks();
  mockPipelineStore.clear();

  // Set WeChat env vars so executePublish doesn't throw
  process.env.WECHAT_APP_ID = "test-app-id";
  process.env.WECHAT_APP_SECRET = "test-app-secret";

  // createPipelineRun stores in mock store
  (createPipelineRun as ReturnType<typeof vi.fn>).mockImplementation(async (run: any) => {
    mockPipelineStore.set(run.id, run);
    return run;
  });

  // getPipelineRun reads from mock store
  (getPipelineRun as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
    return mockPipelineStore.get(id) || null;
  });

  // updatePipelineStep updates step in mock store
  (updatePipelineStep as ReturnType<typeof vi.fn>).mockImplementation(async (id: string, stepIndex: number, update: any) => {
    const run = mockPipelineStore.get(id);
    if (!run) return null;
    run.steps[stepIndex] = { ...run.steps[stepIndex], ...update };
    run.updatedAt = new Date().toISOString();
    return run;
  });

  // updatePipelineStatus
  (updatePipelineStatus as ReturnType<typeof vi.fn>).mockImplementation(async (id: string, status: string, result?: string, error?: string) => {
    const run = mockPipelineStore.get(id);
    if (!run) return null;
    run.status = status;
    if (result !== undefined) run.result = result;
    if (error !== undefined) run.error = error;
    run.updatedAt = new Date().toISOString();
    return run;
  });

  // updatePipelineRun
  (updatePipelineRun as ReturnType<typeof vi.fn>).mockImplementation(async (id: string, updates: any) => {
    const run = mockPipelineStore.get(id);
    if (!run) return null;
    Object.assign(run, updates);
    run.updatedAt = new Date().toISOString();
    return run;
  });

  // listPipelineRuns
  (listPipelineRuns as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  // extractStyleProfile: return a simple profile by default
  (extractStyleProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
    guidelines: "Be conversational",
    samples: "I think this is great",
    constraints: "Avoid jargon",
  });
});

describe("runPipeline", () => {
  it("fails early when no articles collected", async () => {
    (getArticles as ReturnType<typeof vi.fn>).mockResolvedValue({ articles: [], total: 0 });

    const ctx = await runPipeline({ categoryId: "cat1", apiConfig: mockConfig });

    expect(ctx.status).toBe("failed");
    expect(ctx.history[0].step).toBe("collect");
    expect(ctx.history[0].status).toBe("success");
    expect(ctx.history[1].step).toBe("topic");
    expect(ctx.history[1].status).toBe("skipped");
    expect(ctx.history[2].step).toBe("write");
    expect(ctx.history[2].status).toBe("skipped");
  });

  it("runs full pipeline successfully", async () => {
    // Collect: return some articles
    (getArticles as ReturnType<typeof vi.fn>).mockResolvedValue({
      articles: [
        { title: "AI Trends", content: "content", platform: "xhs" },
      ],
      total: 1,
    });

    // Topic
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("  AI选题分析  ");

    // Score: pass on first try
    (scoreContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: 85,
      feedback: "Good",
      passed: true,
    });

    // Humanize
    (humanizeContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "Humanized content",
      changes: ["Fixed em-dashes"],
      score: 90,
    });

    // Review: approved
    (reviewContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      approved: true,
      issues: [],
      riskLevel: "low",
    });

    // Illustrate
    (generateIllustrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      coverPrompt: "A beautiful cover image",
      coverUrl: "https://example.com/cover.jpg",
      illustrations: [
        { label: "Intro illustration", prompt: "An intro image", url: "https://example.com/illust1.jpg" },
      ],
    });

    // Publish
    (publishContent as ReturnType<typeof vi.fn>).mockResolvedValue([
      { platform: "wx", success: true, url: "https://mp.weixin.qq.com/s/test", mediaId: "mock-media-id" },
    ]);

    const ctx = await runPipeline({ categoryId: "cat1", apiConfig: mockConfig });

    expect(ctx.status).toBe("completed");
    expect(ctx.topic).toBeTruthy();
    expect(ctx.content).toBeTruthy();

    // Verify all steps present in history
    const steps = ctx.history.map((h) => h.step);
    expect(steps).toContain("collect");
    expect(steps).toContain("topic");
    expect(steps).toContain("write");
    expect(steps).toContain("score");
    expect(steps).toContain("humanize");
    expect(steps).toContain("review");
    expect(steps).toContain("illustrate");
    expect(steps).toContain("publish");

    // All steps should be success
    const failedSteps = ctx.history.filter((h) => h.status === "failed");
    expect(failedSteps).toHaveLength(0);

    // Verify pipeline is stored
    const stored = await getPipeline(ctx.id);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe("completed");
  });

  it("retries write when score fails then passes", async () => {
    (getArticles as ReturnType<typeof vi.fn>).mockResolvedValue({
      articles: [{ title: "Test", content: "c", platform: "xhs" }],
      total: 1,
    });

    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("topic");

    // Score: fail first, pass second
    (scoreContent as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ score: 40, feedback: "Bad", passed: false })
      .mockResolvedValueOnce({ score: 80, feedback: "Good", passed: true });

    (humanizeContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "h", changes: [], score: 80,
    });
    (reviewContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      approved: true, issues: [], riskLevel: "low",
    });
    (generateIllustrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      coverPrompt: "cover", coverUrl: "https://example.com/cover.jpg", illustrations: [],
    });
    (publishContent as ReturnType<typeof vi.fn>).mockResolvedValue([
      { platform: "wx", success: true, url: "https://mp.weixin.qq.com/s/test2" },
    ]);

    const ctx = await runPipeline({ categoryId: "cat1", apiConfig: mockConfig });

    expect(ctx.status).toBe("completed");
    // Should have 2 write attempts and 2 score attempts
    const writeSteps = ctx.history.filter((h) => h.step === "write");
    const scoreSteps = ctx.history.filter((h) => h.step === "score");
    expect(writeSteps).toHaveLength(2);
    expect(scoreSteps).toHaveLength(2);
  });

  it("fails when review rejects content", async () => {
    (getArticles as ReturnType<typeof vi.fn>).mockResolvedValue({
      articles: [{ title: "Test", content: "c", platform: "xhs" }],
      total: 1,
    });

    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("topic");
    (scoreContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: 85, feedback: "Good", passed: true,
    });
    (humanizeContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "h", changes: [], score: 80,
    });
    (reviewContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      approved: false, issues: ["Sensitive content"], riskLevel: "high",
    });

    const ctx = await runPipeline({ categoryId: "cat1", apiConfig: mockConfig });

    expect(ctx.status).toBe("failed");
    const reviewStep = ctx.history.find((h) => h.step === "review");
    expect(reviewStep?.status).toBe("failed");
    // Should not reach illustrate or publish
    const steps = ctx.history.map((h) => h.step);
    expect(steps).not.toContain("illustrate");
    expect(steps).not.toContain("publish");
  });

  it("handles exceptions in pipeline steps gracefully", async () => {
    (getArticles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB connection failed"));

    const ctx = await runPipeline({ categoryId: "cat1", apiConfig: mockConfig });

    expect(ctx.status).toBe("failed");
    expect(ctx.history.some((h) => h.status === "failed")).toBe(true);
  });

  it("stores pipeline context accessible via getPipeline", async () => {
    (getArticles as ReturnType<typeof vi.fn>).mockResolvedValue({ articles: [], total: 0 });

    const ctx = await runPipeline({ categoryId: "cat1", apiConfig: mockConfig });
    const retrieved = await getPipeline(ctx.id);

    expect(retrieved?.id).toEqual(ctx.id);
  });

  it("getPipeline returns undefined for unknown id", async () => {
    const result = await getPipeline("nonexistent");
    expect(result).toBeUndefined();
  });
});
