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

// Mock wiki module
const mockGetWikiIndex = vi.fn();
vi.mock(import("@/lib/wiki"), () => ({
  getWikiIndex: (...args: unknown[]) => mockGetWikiIndex(...args),
}));

import { GET } from "../wiki/index/route";

describe("GET /api/wiki/index", () => {
  it("returns 400 when categoryId is missing", async () => {
    const request = new Request("http://localhost/api/wiki/index");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("categoryId");
  });

  it("returns empty entities and topics when wiki index is empty", async () => {
    mockGetWikiIndex.mockResolvedValue("");

    const request = new Request("http://localhost/api/wiki/index?categoryId=cat1");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.entities).toEqual([]);
    expect(body.data.topics).toEqual([]);
  });

  it("returns parsed entities and topics from wiki index", async () => {
    const indexContent = `# Wiki Index

## Entities

- [OpenAI](entities/openai.md) - AI research company | 更新: 2025-01-01 | 来源: 5
- [Google](entities/google.md) - Tech giant | 更新: 2025-01-02 | 来源: 3

## Topics

- [GPT-5](topics/gpt-5.md) - Next-gen language model | 更新: 2025-01-03 | 来源: 8
`;

    mockGetWikiIndex.mockResolvedValue(indexContent);

    const request = new Request("http://localhost/api/wiki/index?categoryId=cat1");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.entities).toHaveLength(2);
    expect(body.data.topics).toHaveLength(1);

    expect(body.data.entities[0].title).toBe("OpenAI");
    expect(body.data.entities[0].slug).toBe("openai");
    expect(body.data.entities[0].type).toBe("entity");
    expect(body.data.entities[0].sourceCount).toBe(5);

    expect(body.data.topics[0].title).toBe("GPT-5");
    expect(body.data.topics[0].slug).toBe("gpt-5");
    expect(body.data.topics[0].type).toBe("topic");
    expect(body.data.topics[0].sourceCount).toBe(8);
  });

  it("returns 500 when wiki module throws", async () => {
    mockGetWikiIndex.mockRejectedValue(new Error("disk error"));

    const request = new Request("http://localhost/api/wiki/index?categoryId=cat1");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe(500);
  });
});
