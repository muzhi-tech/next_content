import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock content-generator
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionJSON: vi.fn(),
  parseJSON: vi.fn(),
}));

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import { reviewContent } from "../review";

const mockConfig = { apiUrl: "https://api.test.com/v1", apiKey: "test-key", modelName: "test-model" };

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it("returns not approved with L1 issues and high risk level", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      approved: false,
      issues: [
        "L1: Found forbidden phrase '本质上', suggest replacing with '说到底'",
        "L1: Found colon '：', should use comma instead",
      ],
      riskLevel: "low",
    });

    const result = await reviewContent(mockConfig, "Content with violations");
    expect(result.approved).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it("returns not approved with compliance issues and high risk", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      approved: false,
      issues: ["Contains politically sensitive content"],
      riskLevel: "high",
    });

    const result = await reviewContent(mockConfig, "Sensitive content");
    expect(result.approved).toBe(false);
    expect(result.riskLevel).toBe("high");
  });

  it("returns approved with medium risk for style-only issues", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockReturnValue("raw");
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      approved: true,
      issues: ["L2: Could use more casual transitions"],
      riskLevel: "medium",
    });

    const result = await reviewContent(mockConfig, "Content with minor style issues");
    expect(result.approved).toBe(true);
    expect(result.riskLevel).toBe("medium");
  });

  it("defaults approved to true when field is missing or falsy non-false", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = await reviewContent(mockConfig, "content");
    expect(result.approved).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.riskLevel).toBe("low");
  });

  it("defaults approved to true when approved is null (not strict false)", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({ approved: null });

    const result = await reviewContent(mockConfig, "content");
    expect(result.approved).toBe(true);
  });

  it("sends correct system prompt with L1-L4 review levels", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({ approved: true });

    await reviewContent(mockConfig, "Test content");

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("L1");
    expect(messages[0].content).toContain("L2");
    expect(messages[0].content).toContain("L3");
    expect(messages[0].content).toContain("L4");
    expect(messages[1].content).toContain("Test content");
  });

  it("propagates errors from createChatCompletionJSON", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("API Error (429)")
    );

    await expect(reviewContent(mockConfig, "content")).rejects.toThrow("API Error (429)");
  });
});
