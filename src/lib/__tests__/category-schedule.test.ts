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

import {
  _testResetDB,
  createCategory,
  updateCategorySchedule,
  getScheduledCategories,
} from "../db";

beforeEach(() => {
  _testResetDB();
});

describe("CategorySchedule", () => {
  it("enables schedule on a category", async () => {
    const cat = await createCategory("Tech");
    const updated = await updateCategorySchedule(cat.id, {
      scheduleEnabled: true,
      scheduleInterval: "2h",
    });

    expect(updated?.scheduleEnabled).toBe(true);
    expect(updated?.scheduleInterval).toBe("2h");
  });

  it("enables autoIngest with ingestTopN", async () => {
    const cat = await createCategory("AI");
    const updated = await updateCategorySchedule(cat.id, {
      autoIngest: true,
      ingestTopN: 10,
    });

    expect(updated?.autoIngest).toBe(true);
    expect(updated?.ingestTopN).toBe(10);
  });

  it("updateCategorySchedule returns null for unknown id", async () => {
    const result = await updateCategorySchedule("nonexistent", {
      scheduleEnabled: true,
    });
    expect(result).toBeNull();
  });

  it("getScheduledCategories returns only enabled ones", async () => {
    const cat1 = await createCategory("Cat1");
    const cat2 = await createCategory("Cat2");

    await updateCategorySchedule(cat1.id, { scheduleEnabled: true });
    // cat2 stays disabled

    const scheduled = await getScheduledCategories();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].id).toBe(cat1.id);
  });

  it("getScheduledCategories returns empty when none enabled", async () => {
    await createCategory("NoSchedule");
    const scheduled = await getScheduledCategories();
    expect(scheduled).toHaveLength(0);
  });

  it("disabling schedule removes from getScheduledCategories", async () => {
    const cat = await createCategory("Temp");
    await updateCategorySchedule(cat.id, { scheduleEnabled: true });
    expect(await getScheduledCategories()).toHaveLength(1);

    await updateCategorySchedule(cat.id, { scheduleEnabled: false });
    expect(await getScheduledCategories()).toHaveLength(0);
  });

  it("preserves other fields when updating partial schedule", async () => {
    const cat = await createCategory("Mixed");
    await updateCategorySchedule(cat.id, {
      scheduleEnabled: true,
      scheduleInterval: "6h",
      autoIngest: true,
      ingestTopN: 8,
    });

    // Update only interval
    const updated = await updateCategorySchedule(cat.id, {
      scheduleInterval: "12h",
    });

    expect(updated?.scheduleEnabled).toBe(true);
    expect(updated?.scheduleInterval).toBe("12h");
    expect(updated?.autoIngest).toBe(true);
    expect(updated?.ingestTopN).toBe(8);
  });
});
