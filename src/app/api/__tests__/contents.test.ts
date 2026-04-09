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

import { GET as getContents, POST as postContent } from "../contents/route";
import { GET as getContent, PUT as putContent, DELETE as deleteContent } from "../contents/[id]/route";
import { _testResetDB } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/contents", () => {
  it("returns empty list when no contents exist", async () => {
    const request = new Request("http://localhost/api/contents");
    const response = await getContents(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns paginated contents", async () => {
    for (let i = 0; i < 5; i++) {
      const req = new Request("http://localhost/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: `Topic ${i}`, content: `Content ${i}` }),
      });
      await postContent(req as any);
    }

    const req = new Request("http://localhost/api/contents?page=1&pageSize=3");
    const response = await getContents(req as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.total).toBe(5);
    expect(body.data).toHaveLength(3);
  });

  it("filters by status", async () => {
    for (const [topic, status] of [["Draft1", "draft"], ["Published1", "published"], ["Draft2", "draft"]] as const) {
      const req = new Request("http://localhost/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content: "c", status }),
      });
      await postContent(req as any);
    }

    const req = new Request("http://localhost/api/contents?status=draft");
    const response = await getContents(req as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.total).toBe(2);
    expect(body.data.every((c: any) => c.status === "draft")).toBe(true);
  });

  it("filters by categoryId", async () => {
    for (const [topic, catId] of [["InCat", "cat1"], ["Other", "other"]]) {
      const req = new Request("http://localhost/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content: "c", categoryId: catId }),
      });
      await postContent(req as any);
    }

    const req = new Request("http://localhost/api/contents?categoryId=cat1");
    const response = await getContents(req as any);
    const body = await response.json();

    expect(body.total).toBe(1);
    expect(body.data[0].topic).toBe("InCat");
  });

  it("searches by topic", async () => {
    for (const topic of ["深度学习入门", "React进阶", "深度学习实战"]) {
      const req = new Request("http://localhost/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, content: "c" }),
      });
      await postContent(req as any);
    }

    const req = new Request("http://localhost/api/contents?search=深度学习");
    const response = await getContents(req as any);
    const body = await response.json();

    expect(body.total).toBe(2);
  });
});

describe("POST /api/contents", () => {
  it("creates content successfully", async () => {
    const request = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "AI未来趋势",
        content: "这是一篇关于AI趋势的文章",
        style: "casual",
        status: "draft",
        sourceType: "manual",
      }),
    });
    const response = await postContent(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.topic).toBe("AI未来趋势");
    expect(body.data.status).toBe("draft");
    expect(body.data.sourceType).toBe("manual");
  });

  it("creates content with sourceType pipeline", async () => {
    const request = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Pipeline Topic", content: "c", sourceType: "pipeline" }),
    });
    const response = await postContent(request as any);
    const body = await response.json();

    expect(body.data.sourceType).toBe("pipeline");
  });

  it("returns 400 when required fields missing", async () => {
    const request = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "No Content" }),
    });
    const response = await postContent(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("缺少必填字段");
  });

  it("saves optional fields wikiContext, titles, coverPrompt", async () => {
    const request = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "Topic",
        content: "c",
        wikiContext: '{"entities": []}',
        titles: '[{"title": "Opt1"}]',
        coverPrompt: '{"prompt": "cover"}',
      }),
    });
    const response = await postContent(request as any);
    const body = await response.json();

    expect(body.data.wikiContext).toBe('{"entities": []}');
    expect(body.data.titles).toBe('[{"title": "Opt1"}]');
    expect(body.data.coverPrompt).toBe('{"prompt": "cover"}');
  });
});

describe("GET /api/contents/[id]", () => {
  it("returns content by id", async () => {
    const createReq = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "FindMe", content: "c" }),
    });
    const createRes = await postContent(createReq as any);
    const createBody = await createRes.json();
    const id = createBody.data.id;

    const response = await getContent({} as any, { params: { id } });
    const getBody = await response.json();

    expect(createBody.code).toBe(0);
    expect(getBody.code).toBe(0);
    expect(getBody.data.topic).toBe("FindMe");
  });

  it("returns 404 for non-existent id", async () => {
    const response = await getContent({} as any, { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe(404);
  });
});

describe("PUT /api/contents/[id]", () => {
  it("updates topic and status", async () => {
    const createReq = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Original", content: "c", status: "draft" }),
    });
    const createRes = await postContent(createReq as any);
    const body = await createRes.json();
    const id = body.data.id;

    const updateReq = new Request(`http://localhost/api/contents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Updated", status: "published" }),
    });
    const response = await putContent(updateReq as any, { params: { id } });
    const updateBody = await response.json();

    expect(updateBody.code).toBe(0);
    expect(updateBody.data.topic).toBe("Updated");
    expect(updateBody.data.status).toBe("published");
  });

  it("returns 404 when updating non-existent content", async () => {
    const updateReq = new Request("http://localhost/api/contents/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "x" }),
    });
    const response = await putContent(updateReq as any, { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/contents/[id]", () => {
  it("deletes existing content", async () => {
    const createReq = new Request("http://localhost/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "ToDelete", content: "c" }),
    });
    const createRes = await postContent(createReq as any);
    const createBody = await createRes.json();
    const id = createBody.data.id;

    const response = await deleteContent({} as any, { params: { id } });
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data.deleted).toBe(true);
  });

  it("returns 404 when deleting non-existent content", async () => {
    const response = await deleteContent({} as any, { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
  });
});
