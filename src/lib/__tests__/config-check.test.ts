import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

import { requireAIConfig, requireXhsKey, requireWxKey, CONFIG_REQUIREMENTS } from "../config-check";
import { _testResetDB, createApiConfig } from "../db";

beforeEach(() => {
  _testResetDB();
});

afterEach(() => {
  delete process.env.XHS_API_KEY;
  delete process.env.WX_API_KEY;
});

describe("CONFIG_REQUIREMENTS", () => {
  it("has 3 requirements defined", () => {
    expect(CONFIG_REQUIREMENTS).toHaveLength(3);
  });

  it("includes ai_api requirement", () => {
    const ai = CONFIG_REQUIREMENTS.find((r) => r.key === "ai_api");
    expect(ai).toBeDefined();
    expect(ai?.category).toBe("ai");
    expect(ai?.storage).toBe("database");
  });

  it("includes xhs_api requirement", () => {
    const xhs = CONFIG_REQUIREMENTS.find((r) => r.key === "xhs_api");
    expect(xhs).toBeDefined();
    expect(xhs?.category).toBe("platform");
    expect(xhs?.storage).toBe("env");
    expect(xhs?.envVar).toBe("XHS_API_KEY");
  });

  it("includes wx_api requirement", () => {
    const wx = CONFIG_REQUIREMENTS.find((r) => r.key === "wx_api");
    expect(wx).toBeDefined();
    expect(wx?.category).toBe("platform");
    expect(wx?.storage).toBe("env");
    expect(wx?.envVar).toBe("WX_API_KEY");
  });
});

describe("requireAIConfig", () => {
  it("returns ok with override config", async () => {
    const result = await requireAIConfig({
      apiUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      modelName: "gpt-4",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apiUrl).toBe("https://api.test.com/v1");
      expect(result.apiKey).toBe("test-key");
      expect(result.modelName).toBe("gpt-4");
    }
  });

  it("returns ok with database config when no override", async () => {
    await createApiConfig({
      name: "Test API",
      apiUrl: "https://db-api.test.com/v1",
      apiKey: "db-key",
      modelName: "gpt-4",
      isDefault: true,
    });

    const result = await requireAIConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apiUrl).toBe("https://db-api.test.com/v1");
      expect(result.apiKey).toBe("db-key");
    }
  });

  it("returns error when no config available", async () => {
    const result = await requireAIConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.code).toBe(400);
      expect(body.msg).toContain("未配置 AI API");
    }
  });

  it("returns error when override has no apiKey", async () => {
    const result = await requireAIConfig({
      apiUrl: "https://api.test.com/v1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.code).toBe(400);
    }
  });

  it("prefers override over database config", async () => {
    await createApiConfig({
      name: "DB API",
      apiUrl: "https://db.test.com",
      apiKey: "db-key",
      modelName: "db-model",
      isDefault: true,
    });

    const result = await requireAIConfig({
      apiUrl: "https://override.test.com",
      apiKey: "override-key",
      modelName: "override-model",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.apiUrl).toBe("https://override.test.com");
      expect(result.apiKey).toBe("override-key");
      expect(result.modelName).toBe("override-model");
    }
  });
});

describe("requireXhsKey", () => {
  it("returns error when XHS_API_KEY is not set", () => {
    delete process.env.XHS_API_KEY;
    const result = requireXhsKey();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = result.response.json();
      // response.json() returns a promise in Next.js but the response object is sync-accessible
      expect(result.response.status).toBe(400);
    }
  });

  it("returns ok when XHS_API_KEY is set", () => {
    process.env.XHS_API_KEY = "test-xhs-key";
    const result = requireXhsKey();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toBe("test-xhs-key");
    }
  });
});

describe("requireWxKey", () => {
  it("returns error when WX_API_KEY is not set", () => {
    delete process.env.WX_API_KEY;
    const result = requireWxKey();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("returns ok when WX_API_KEY is set", () => {
    process.env.WX_API_KEY = "test-wx-key";
    const result = requireWxKey();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.key).toBe("test-wx-key");
    }
  });
});
