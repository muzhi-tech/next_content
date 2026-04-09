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

// Mock scheduler to prevent actual cron registration during tests
vi.mock(import("@/lib/scheduler"), () => ({
  reloadSchedules: vi.fn().mockResolvedValue(undefined),
}));

import { GET as getSchedule, POST as postSchedule } from "../schedule/route";
import { _testResetDB, createCategory, updateCategorySchedule } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/schedule", () => {
  it("returns empty list when no scheduled categories", async () => {
    const response = await getSchedule();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data).toEqual([]);
  });

  it("returns categories with schedule enabled", async () => {
    const cat = await createCategory("Tech");
    await updateCategorySchedule(cat.id, { scheduleEnabled: true, scheduleInterval: "2h" });

    const response = await getSchedule();
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Tech");
    expect(body.data[0].scheduleEnabled).toBe(true);
    expect(body.data[0].scheduleInterval).toBe("2h");
  });

  it("does not return categories without schedule enabled", async () => {
    await createCategory("NoSchedule");

    const response = await getSchedule();
    const body = await response.json();

    expect(body.data).toHaveLength(0);
  });
});

describe("POST /api/schedule", () => {
  it("updates schedule config for a category", async () => {
    const cat = await createCategory("AI");

    const request = new Request("http://localhost/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: cat.id,
        scheduleEnabled: true,
        scheduleInterval: "1h",
        autoIngest: true,
        ingestTopN: 10,
      }),
    });
    const response = await postSchedule(request as any);
    const body = await response.json();

    expect(body.code).toBe(0);
    expect(body.data.scheduleEnabled).toBe(true);
    expect(body.data.scheduleInterval).toBe("1h");
    expect(body.data.autoIngest).toBe(true);
    expect(body.data.ingestTopN).toBe(10);
  });

  it("updates only subset of fields", async () => {
    const cat = await createCategory("Partial");
    await updateCategorySchedule(cat.id, { scheduleEnabled: true, scheduleInterval: "2h" });

    const request = new Request("http://localhost/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: cat.id, scheduleInterval: "6h" }),
    });
    const response = await postSchedule(request as any);
    const body = await response.json();

    expect(body.data.scheduleEnabled).toBe(true);
    expect(body.data.scheduleInterval).toBe("6h");
  });

  it("returns 400 when categoryId missing", async () => {
    const request = new Request("http://localhost/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleEnabled: true }),
    });
    const response = await postSchedule(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(400);
    expect(body.msg).toContain("categoryId");
  });

  it("returns 404 for non-existent category", async () => {
    const request = new Request("http://localhost/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: "nonexistent", scheduleEnabled: true }),
    });
    const response = await postSchedule(request as any);
    const body = await response.json();

    expect(response.status).toBe(404);
  });
});
