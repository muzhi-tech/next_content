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

import { GET } from "../health/route";
import { _testResetDB, createApiConfig } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/health", () => {
  it("returns healthy status with seed data", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.db).toBe("ok");
    expect(body.data.hasCategories).toBe(true);
    // No API config by default
    expect(body.data.apiConfig).toBe(false);
  });

  it("returns apiConfig true when API config exists", async () => {
    await createApiConfig({
      name: "Test API",
      apiUrl: "https://api.test.com/v1",
      apiKey: "test-key",
      modelName: "gpt-4",
      isDefault: true,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.apiConfig).toBe(true);
  });

  it("returns platform key status based on env vars", async () => {
    // Without env vars set
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    // Env vars are not set in test env
    expect(typeof body.data.xhsKey).toBe("boolean");
    expect(typeof body.data.wxKey).toBe("boolean");
  });
});
