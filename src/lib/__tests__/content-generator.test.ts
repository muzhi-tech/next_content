import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to access the non-exported buildEndpoint and parseJSON.
// parseJSON is exported; buildEndpoint is not, so we test it indirectly
// through the exported functions, or we re-implement the logic for unit testing.
// Since buildEndpoint is not exported, we test parseJSON and mock-fetch functions.

import { parseJSON, createChatCompletionJSON, createChatCompletionStream } from "../content-generator";

// ---------- parseJSON ----------

describe("parseJSON", () => {
  it("parses plain JSON object", () => {
    const input = '{"title": "hello", "count": 3}';
    const result = parseJSON(input);
    expect(result).toEqual({ title: "hello", count: 3 });
  });

  it("parses plain JSON array", () => {
    const input = '[{"a":1},{"b":2}]';
    const result = parseJSON(input);
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("strips markdown code fence with json label", () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = parseJSON(input);
    expect(result).toEqual({ key: "value" });
  });

  it("strips markdown code fence without label", () => {
    const input = '```\n{"key": "value"}\n```';
    const result = parseJSON(input);
    expect(result).toEqual({ key: "value" });
  });

  it("removes trailing commas before } and ]", () => {
    const input = '{"a": 1, "b": 2,}';
    const result = parseJSON(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("removes trailing commas in nested arrays", () => {
    const input = '{"items": [1, 2, 3,],}';
    const result = parseJSON(input);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("handles unescaped newlines inside string values", () => {
    const input = '{"text": "line1\nline2"}';
    const result = parseJSON(input) as { text: string };
    expect(result.text).toBe("line1\nline2");
  });

  it("handles unescaped tabs inside string values", () => {
    const input = '{"text": "col1\tcol2"}';
    const result = parseJSON(input) as { text: string };
    expect(result.text).toBe("col1\tcol2");
  });

  it("throws when no JSON structure found", () => {
    expect(() => parseJSON("just plain text")).toThrow("未找到有效的 JSON 结构");
  });

  it("handles JSON surrounded by extra text", () => {
    const input = 'Here is the result:\n{"status": "ok"}\nEnd of response.';
    const result = parseJSON(input);
    expect(result).toEqual({ status: "ok" });
  });

  it("handles already properly escaped strings", () => {
    const input = '{"text": "line1\\nline2"}';
    const result = parseJSON(input) as { text: string };
    expect(result.text).toBe("line1\nline2");
  });
});

// ---------- createChatCompletionJSON (mocked fetch) ----------

describe("createChatCompletionJSON", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns content from API response", async () => {
    const mockResponse = {
      choices: [{ message: { content: "AI response text" } }],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));

    const result = await createChatCompletionJSON(
      { apiUrl: "https://api.test.com/v1", apiKey: "test-key", modelName: "test-model" },
      [{ role: "user", content: "hello" }]
    );

    expect(result).toBe("AI response text");

    // Verify fetch was called with correct args
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("test-model");
    expect(body.stream).toBe(false);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("rate limited"),
    }));

    await expect(
      createChatCompletionJSON(
        { apiUrl: "https://api.test.com/v1", apiKey: "k" },
        [{ role: "user", content: "hi" }]
      )
    ).rejects.toThrow("AI API Error (429)");
  });

  it("returns empty string when choices is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    }));

    const result = await createChatCompletionJSON(
      { apiUrl: "https://api.test.com/v1", apiKey: "k" },
      [{ role: "user", content: "hi" }]
    );

    expect(result).toBe("");
  });
});

// ---------- createChatCompletionStream (mocked fetch) ----------

describe("createChatCompletionStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onChunk for each content delta", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      'data: [DONE]\n',
    ];

    // Create a mock ReadableStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }));

    const received: string[] = [];
    await createChatCompletionStream(
      { apiUrl: "https://api.test.com/v1", apiKey: "k" },
      [{ role: "user", content: "hi" }],
      (content) => received.push(content)
    );

    expect(received).toEqual(["Hel", "lo"]);
  });

  it("throws when response body is null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    }));

    await expect(
      createChatCompletionStream(
        { apiUrl: "https://api.test.com/v1", apiKey: "k" },
        [{ role: "user", content: "hi" }],
        () => {}
      )
    ).rejects.toThrow("Response body is null");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("server error"),
    }));

    await expect(
      createChatCompletionStream(
        { apiUrl: "https://api.test.com/v1", apiKey: "k" },
        [{ role: "user", content: "hi" }],
        () => {}
      )
    ).rejects.toThrow("AI API Error (500)");
  });
});
