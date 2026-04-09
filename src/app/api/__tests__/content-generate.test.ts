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

// Mock styles to avoid import issues
vi.mock(import("@/lib/styles"), () => ({
  getStyle: vi.fn().mockReturnValue({
    id: "tech",
    name: "科技",
    icon: "💻",
    systemPrompt: "You are a tech writer.",
  }),
  buildUserPrompt: vi.fn().mockReturnValue("Write about test topic"),
}));

// Mock content-generator
vi.mock(import("@/lib/content-generator"), () => ({
  createChatCompletionStream: vi.fn().mockImplementation(
    (_config: any, _messages: any, onChunk: (chunk: string) => void) => {
      onChunk("Hello ");
      onChunk("World");
      return Promise.resolve();
    }
  ),
  parseJSON: vi.fn(),
}));

import { POST } from "../content/generate/route";
import { _testResetDB, createApiConfig } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("POST /api/content/generate", () => {
  it("returns 400 when topic is missing", async () => {
    const request = new Request("http://localhost/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("缺少主题");
  });

  it("returns 400 when no API config is available", async () => {
    const request = new Request("http://localhost/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "AI Trends" }),
    });
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("API 配置");
  });

  it("returns SSE stream for valid request with style parameter", async () => {
    await createApiConfig({
      name: "Test API",
      apiUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      modelName: "gpt-4",
      isDefault: true,
    });

    const request = new Request("http://localhost/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "AI Trends", style: "tech" }),
    });
    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    // Read the stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
    }

    expect(fullText).toContain("content");
    expect(fullText).toContain("done");
  });

  it("returns SSE stream when using explicit API config in request body", async () => {
    // No DB config needed — passing config in body
    const request = new Request("http://localhost/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "AI",
        style: "tech",
        apiUrl: "https://api.test.com/v1",
        apiKey: "test-key",
        modelName: "gpt-4",
      }),
    });
    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
