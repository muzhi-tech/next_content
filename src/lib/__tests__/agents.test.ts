import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock content-generator
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionJSON: vi.fn(),
  parseJSON: vi.fn(),
}));

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import { humanizeContent } from "../agents/humanize";
import { scoreContent } from "../agents/score";
import { reviewContent } from "../agents/review";

const mockConfig = { apiUrl: "https://api.test.com/v1", apiKey: "test-key", modelName: "test-model" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ humanizeContent ============

describe("humanizeContent", () => {
  it("returns humanized result with defaults for missing fields", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw-response");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      content: "Humanized article",
      changes: ["Fixed em-dashes", "Removed fake excitement"],
      score: 85,
    });

    const result = await humanizeContent(mockConfig, "AI generated content");
    expect(result.content).toBe("Humanized article");
    expect(result.changes).toEqual(["Fixed em-dashes", "Removed fake excitement"]);
    expect(result.score).toBe(85);
  });

  it("falls back to original content when content field is missing", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      changes: ["Fixed something"],
      score: 70,
    });

    const result = await humanizeContent(mockConfig, "original content");
    expect(result.content).toBe("original content");
  });

  it("defaults changes to empty array and score to 0", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = await humanizeContent(mockConfig, "content");
    expect(result.changes).toEqual([]);
    expect(result.score).toBe(0);
  });

  it("calls AI with correct prompts", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    await humanizeContent(mockConfig, "test content");

    expect(createChatCompletionJSON).toHaveBeenCalledTimes(1);
    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("去 AI 化");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("test content");
  });
});

// ============ scoreContent ============

describe("scoreContent", () => {
  it("returns score result with passed=true when score >= 70", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      score: 85,
      feedback: "Great article with good depth",
    });

    const result = await scoreContent(mockConfig, "AI topic", "Article content");
    expect(result.score).toBe(85);
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe("Great article with good depth");
  });

  it("returns passed=false when score < 70", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      score: 45,
      feedback: "Needs improvement",
    });

    const result = await scoreContent(mockConfig, "topic", "content");
    expect(result.score).toBe(45);
    expect(result.passed).toBe(false);
  });

  it("defaults score to 0 and feedback to empty string", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = await scoreContent(mockConfig, "topic", "content");
    expect(result.score).toBe(0);
    expect(result.feedback).toBe("");
    expect(result.passed).toBe(false);
  });

  it("calls AI with topic and content in user message", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({ score: 80, feedback: "" });

    await scoreContent(mockConfig, "My Topic", "My Content");

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(messages[1].content).toContain("My Topic");
    expect(messages[1].content).toContain("My Content");
  });
});

// ============ reviewContent ============

describe("reviewContent", () => {
  it("returns approved result with no issues", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      approved: true,
      issues: [],
      riskLevel: "low",
    });

    const result = await reviewContent(mockConfig, "Clean content");
    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.riskLevel).toBe("low");
  });

  it("returns not approved with issues", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      approved: false,
      issues: ["Contains sensitive content", "Logical error in paragraph 3"],
      riskLevel: "high",
    });

    const result = await reviewContent(mockConfig, "Problematic content");
    expect(result.approved).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.riskLevel).toBe("high");
  });

  it("defaults approved to true when field is missing", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = await reviewContent(mockConfig, "content");
    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.riskLevel).toBe("low");
  });

  it("defaults approved to true when explicitly false is not returned", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({ approved: null });

    const result = await reviewContent(mockConfig, "content");
    // approved !== false, so it defaults to true
    expect(result.approved).toBe(true);
  });

  it("calls AI with content in user message", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({ approved: true });

    await reviewContent(mockConfig, "Review this content");

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(messages[1].content).toContain("Review this content");
  });
});
