import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock content-generator
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionJSON: vi.fn(),
  parseJSON: vi.fn(),
}));

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import { extractStyleProfile } from "../style-extractor";

const mockConfig = { apiUrl: "https://api.test.com/v1", apiKey: "test-key", modelName: "test-model" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractStyleProfile", () => {
  it("returns empty StyleProfile for empty article list", async () => {
    const result = await extractStyleProfile(mockConfig, []);
    expect(result).toEqual({ guidelines: "", samples: "", constraints: "" });
    expect(createChatCompletionJSON).not.toHaveBeenCalled();
  });

  it("extracts style profile from articles", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      guidelines: "Use casual tone,Avoid jargon,Keep paragraphs short",
      samples: "Piece 1 | Piece 2 | Piece 3",
      constraints: "No bullet points,No formal language",
    });

    const articles = [
      { title: "Test Article 1", content: "Content 1", platform: "xhs" },
      { title: "Test Article 2", content: "Content 2", platform: "wx" },
    ];

    const result = await extractStyleProfile(mockConfig, articles);
    expect(result.guidelines).toBe("Use casual tone,Avoid jargon,Keep paragraphs short");
    expect(result.samples).toBe("Piece 1 | Piece 2 | Piece 3");
    expect(result.constraints).toBe("No bullet points,No formal language");
  });

  it("defaults empty strings when LLM returns partial data", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      guidelines: "Some guidelines",
    });

    const result = await extractStyleProfile(mockConfig, [
      { title: "Article", content: "Content", platform: "xhs" },
    ]);
    expect(result.guidelines).toBe("Some guidelines");
    expect(result.samples).toBe("");
    expect(result.constraints).toBe("");
  });

  it("sends correct prompts to AI with article data", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    await extractStyleProfile(mockConfig, [
      { title: "My Title", content: "My Content", platform: "xhs" },
    ]);

    expect(createChatCompletionJSON).toHaveBeenCalledTimes(1);
    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("写作风格");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("My Title");
    expect(messages[1].content).toContain("My Content");
  });

  it("truncates article content to 1500 chars per article", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const longContent = "A".repeat(2000);
    await extractStyleProfile(mockConfig, [
      { title: "Title", content: longContent, platform: "xhs" },
    ]);

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const userMessage = messages[1].content;
    // The content in the message should not contain the full 2000 chars
    // It's truncated to 1500 within the formatted text
    expect(userMessage.length).toBeLessThan(longContent.length + 200);
  });

  it("limits to 10 articles max", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const articles = Array.from({ length: 15 }, (_, i) => ({
      title: `Article ${i}`,
      content: `Content ${i}`,
      platform: "xhs",
    }));

    await extractStyleProfile(mockConfig, articles);

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const userMessage = messages[1].content;
    // Should contain articles 1-10, not 11-15
    expect(userMessage).toContain("[文章1]");
    expect(userMessage).toContain("[文章10]");
    expect(userMessage).not.toContain("[文章11]");
  });

  it("propagates errors from createChatCompletionJSON", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("API Error (503)")
    );

    await expect(
      extractStyleProfile(mockConfig, [
        { title: "Title", content: "Content", platform: "xhs" },
      ])
    ).rejects.toThrow("API Error (503)");
  });
});
