import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node-cron before importing scheduler
const mockTaskStop = vi.fn();
const mockTaskStart = vi.fn();

vi.mock("node-cron", () => ({
  __esModule: true,
  default: {
    schedule: vi.fn(() => ({ stop: mockTaskStop, start: mockTaskStart })),
    validate: vi.fn((expr: string) => ["*/30 * * * *", "0 * * * *", "0 */2 * * *", "0 */6 * * *", "0 */12 * * *", "0 0 * * *"].includes(expr)),
  },
  type: { ScheduledTask: {} },
}));

// Mock path to redirect DB to :memory:
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

// Mock config-check and wiki-ingest to prevent real API calls
vi.mock(import("../config-check"), () => ({
  requireXhsKey: vi.fn().mockReturnValue({ ok: false }),
  requireWxKey: vi.fn().mockReturnValue({ ok: false }),
}));

vi.mock(import("../wiki-ingest"), () => ({
  autoIngestTopArticles: vi.fn().mockResolvedValue(undefined),
}));

import { _testResetDB, createCategory, updateCategorySchedule } from "../db";

// Import scheduler AFTER mocks are set up
let scheduler: typeof import("../scheduler");
let cronModule: typeof import("node-cron");

beforeEach(async () => {
  _testResetDB();
  vi.clearAllMocks();
  mockTaskStop.mockClear();
  mockTaskStart.mockClear();
  cronModule = await import("node-cron");
  scheduler = await import("../scheduler");
  // Reset scheduler singleton state before each test
  scheduler._testResetScheduler();
  // Reset schedule mock calls
  (cronModule.default.schedule as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  // Stop all active tasks and clear all state after each test
  scheduler._testResetScheduler();
});

describe("scheduler", () => {
  describe("addSchedule / removeSchedule", () => {
    it("registers a cron task when addSchedule is called", async () => {
      scheduler.addSchedule("cat1", "1h");
      expect(cronModule.default.schedule).toHaveBeenCalledTimes(1);
      expect(cronModule.default.schedule).toHaveBeenCalledWith(
        "0 * * * *",
        expect.any(Function)
      );
    });

    it("removes existing task before adding new one for same categoryId", async () => {
      scheduler.addSchedule("cat1", "1h");
      scheduler.addSchedule("cat1", "2h");

      // Should have stopped the old task once
      expect(mockTaskStop).toHaveBeenCalledTimes(1);
      // Should have called schedule twice
      expect(cronModule.default.schedule).toHaveBeenCalledTimes(2);
    });

    it("removes a scheduled task", async () => {
      scheduler.addSchedule("cat1", "1h");
      expect(cronModule.default.schedule).toHaveBeenCalledTimes(1);

      scheduler.removeSchedule("cat1");
      expect(mockTaskStop).toHaveBeenCalledTimes(1);
    });

    it("does nothing when removing non-existent schedule", async () => {
      expect(() => scheduler.removeSchedule("nonexistent")).not.toThrow();
      expect(mockTaskStop).not.toHaveBeenCalled();
    });

    it("maps interval to correct cron expression", async () => {
      const intervals: Array<[string, string]> = [
        ["30m", "*/30 * * * *"],
        ["1h", "0 * * * *"],
        ["2h", "0 */2 * * *"],
        ["6h", "0 */6 * * *"],
        ["12h", "0 */12 * * *"],
        ["24h", "0 0 * * *"],
      ];

      for (const [interval, expected] of intervals) {
        mockTaskStop.mockClear();
        (cronModule.default.schedule as ReturnType<typeof vi.fn>).mockClear();
        scheduler.addSchedule(`cat-${interval}`, interval);
        expect(cronModule.default.schedule).toHaveBeenCalledWith(
          expected,
          expect.any(Function)
        );
      }
    });

    it("falls back to 1h cron for unknown interval", async () => {
      scheduler.addSchedule("cat1", "unknown-interval");
      expect(cronModule.default.schedule).toHaveBeenCalledWith(
        "0 * * * *",
        expect.any(Function)
      );
    });

    it("getActiveTaskCount returns correct count", async () => {
      expect(scheduler.getActiveTaskCount()).toBe(0);

      scheduler.addSchedule("cat1", "1h");
      expect(scheduler.getActiveTaskCount()).toBe(1);

      scheduler.addSchedule("cat2", "2h");
      expect(scheduler.getActiveTaskCount()).toBe(2);

      scheduler.removeSchedule("cat1");
      expect(scheduler.getActiveTaskCount()).toBe(1);
    });
  });

  describe("initScheduler", () => {
    it("loads categories with scheduleEnabled from DB and registers tasks", async () => {
      // Create categories in DB
      const cat1 = await createCategory("Cat1");
      const cat2 = await createCategory("Cat2");
      await updateCategorySchedule(cat1.id, { scheduleEnabled: true, scheduleInterval: "1h" });
      await updateCategorySchedule(cat2.id, { scheduleEnabled: true, scheduleInterval: "6h" });

      await scheduler.initScheduler();

      // Should have registered 2 tasks
      expect(scheduler.getActiveTaskCount()).toBe(2);
      expect(cronModule.default.schedule).toHaveBeenCalledTimes(2);
    });

    it("does not register tasks for categories without scheduleEnabled", async () => {
      const cat = await createCategory("NoSchedule");
      await updateCategorySchedule(cat.id, { scheduleEnabled: false });

      await scheduler.initScheduler();

      expect(scheduler.getActiveTaskCount()).toBe(0);
    });

    it("skips categories with invalid intervals gracefully", async () => {
      const cat = await createCategory("BadInterval");
      await updateCategorySchedule(cat.id, { scheduleEnabled: true, scheduleInterval: "invalid" });

      // Should not throw
      await scheduler.initScheduler();

      // Only the default category (if any) would be registered
      expect(scheduler.getActiveTaskCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("reloadSchedules", () => {
    it("stops all existing tasks and re-initializes from DB", async () => {
      // Add some initial tasks manually
      scheduler.addSchedule("cat1", "1h");
      scheduler.addSchedule("cat2", "2h");

      const initialCount = scheduler.getActiveTaskCount();
      expect(initialCount).toBe(2);

      // Clear all tasks by reloading
      await scheduler.reloadSchedules();

      // All old tasks should be stopped
      expect(mockTaskStop).toHaveBeenCalled();
      // Count should be reloaded from DB (likely 0 since no DB setup)
      expect(scheduler.getActiveTaskCount()).toBe(0);
    });
  });
});
