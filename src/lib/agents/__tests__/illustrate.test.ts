import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock content-generator
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionJSON: vi.fn(),
  parseJSON: vi.fn(),
}));

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import {
  generateIllustrationPrompts,
  generateIllustrations,
} from "../illustrate";

const mockConfig = { apiUrl: "https://api.test.com/v1", apiKey: "test-key", modelName: "test-model" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ============ generateIllustrationPrompts ============

describe("generateIllustrationPrompts", () => {
  it("generates illustration prompts from topic and content", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      coverPrompt: "A beautiful landscape",
      coverNegativePrompt: "blurry, low quality",
      illustrationPrompts: [
        { label: "Diagram 1", prompt: "Technical diagram", negativePrompt: "blurry" },
        { label: "Diagram 2", prompt: "Flow chart", negativePrompt: "ugly" },
      ],
    });

    const result = await generateIllustrationPrompts(mockConfig, "AI Topic", "Article content");
    expect(result.coverPrompt).toBe("A beautiful landscape");
    expect(result.coverNegativePrompt).toBe("blurry, low quality");
    expect(result.illustrationPrompts).toHaveLength(2);
    expect(result.illustrationPrompts[0].label).toBe("Diagram 1");
  });

  it("handles 'illustrations' key as alias for 'illustrationPrompts'", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      coverPrompt: "Cover",
      coverNegativePrompt: "",
      illustrations: [
        { label: "Label", prompt: "Prompt", negativePrompt: "" },
      ],
    });

    const result = await generateIllustrationPrompts(mockConfig, "Topic", "Content");
    expect(result.illustrationPrompts).toHaveLength(1);
    expect(result.illustrationPrompts[0].label).toBe("Label");
  });

  it("defaults empty values when LLM returns partial data", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const result = await generateIllustrationPrompts(mockConfig, "Topic", "Content");
    expect(result.coverPrompt).toBe("");
    expect(result.coverNegativePrompt).toBe("");
    expect(result.illustrationPrompts).toEqual([]);
  });

  it("truncates long content to 3000 chars", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    const longContent = "X".repeat(5000);
    await generateIllustrationPrompts(mockConfig, "Topic", longContent);

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const userMessage = messages[1].content;
    // Should contain truncated content (3000 + "..." + topic text)
    expect(userMessage).toContain("...");
    expect(userMessage.length).toBeLessThan(longContent.length);
  });

  it("calls AI with correct system prompt", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({});

    await generateIllustrationPrompts(mockConfig, "My Topic", "Content");

    const messages = (createChatCompletionJSON as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("AI绘图");
    expect(messages[1].content).toContain("My Topic");
  });
});

// ============ generateIllustrations ============

describe("generateIllustrations", () => {
  it("returns full result without images when FAL_KEY is not set", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      coverPrompt: "Cover prompt",
      coverNegativePrompt: "bad",
      illustrationPrompts: [
        { label: "Ill 1", prompt: "Ill prompt 1", negativePrompt: "bad" },
      ],
    });

    // Ensure FAL_KEY is not set
    delete process.env.FAL_KEY;

    const result = await generateIllustrations(mockConfig, "Topic", "Content");
    expect(result.coverPrompt).toBe("Cover prompt");
    expect(result.coverUrl).toBeUndefined();
    expect(result.illustrations).toHaveLength(1);
    expect(result.illustrations[0].url).toBeUndefined();
    expect(result.illustrations[0].label).toBe("Ill 1");
  });

  it("generates images via FAL API when FAL_KEY is set", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      coverPrompt: "Cover",
      coverNegativePrompt: "",
      illustrationPrompts: [],
    });

    process.env.FAL_KEY = "test-fal-key";

    // Mock fetch for FAL queue submit + status poll + result
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ request_id: "req-123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "COMPLETED" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: "https://fal.img/cover.png" }] }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await generateIllustrations(mockConfig, "Topic", "Content");
    expect(result.coverUrl).toBe("https://fal.img/cover.png");

    delete process.env.FAL_KEY;
    vi.unstubAllGlobals();
  });

  it("handles FAL API submission failure gracefully", async () => {
    (createChatCompletionJSON as ReturnType<typeof vi.fn>).mockResolvedValue("raw");
    (parseJSON as ReturnType<typeof vi.fn>).mockReturnValue({
      coverPrompt: "Cover",
      coverNegativePrompt: "",
      illustrationPrompts: [],
    });

    process.env.FAL_KEY = "test-fal-key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateIllustrations(mockConfig, "Topic", "Content");
    expect(result.coverUrl).toBeUndefined();

    delete process.env.FAL_KEY;
    vi.unstubAllGlobals();
  });
});
