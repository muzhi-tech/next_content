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

import { GET } from "../analytics/pipeline-status/route";
import { _testResetDB, createPipelineRun } from "@/lib/db";

beforeEach(() => {
  _testResetDB();
});

describe("GET /api/analytics/pipeline-status", () => {
  it("returns hasActivePipeline false when no running pipeline", async () => {
    const request = new Request("http://localhost/api/analytics/pipeline-status");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.hasActivePipeline).toBe(false);
    expect(body.data.pipeline).toBeNull();
  });

  it("returns running pipeline when exists", async () => {
    const now = new Date().toISOString();
    await createPipelineRun({
      id: "pipeline-1",
      categoryId: "cat1",
      status: "running",
      steps: [
        { step: "collection", status: "completed", startedAt: now, completedAt: now },
        { step: "topic", status: "running", startedAt: now },
      ],
      currentStepIndex: 1,
      createdAt: now,
      updatedAt: now,
    });

    const request = new Request("http://localhost/api/analytics/pipeline-status");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.hasActivePipeline).toBe(true);
    expect(body.data.pipeline.id).toBe("pipeline-1");
    expect(body.data.pipeline.categoryId).toBe("cat1");
    expect(body.data.pipeline.status).toBe("running");
    expect(body.data.pipeline.currentStepIndex).toBe(1);
    expect(body.data.pipeline.steps).toHaveLength(2);
    expect(body.data.pipeline.steps[0].step).toBe("collection");
    expect(body.data.pipeline.steps[0].status).toBe("completed");
    expect(body.data.pipeline.steps[1].step).toBe("topic");
    expect(body.data.pipeline.steps[1].status).toBe("running");
  });

  it("calculates duration for completed steps", async () => {
    const startTime = new Date("2026-01-01T10:00:00Z").toISOString();
    const endTime = new Date("2026-01-01T10:00:05Z").toISOString(); // 5 seconds later
    await createPipelineRun({
      id: "pipeline-2",
      categoryId: "cat1",
      status: "running",
      steps: [
        { step: "collection", status: "completed", startedAt: startTime, completedAt: endTime },
        { step: "topic", status: "running", startedAt: endTime },
      ],
      currentStepIndex: 1,
      createdAt: startTime,
      updatedAt: endTime,
    });

    const request = new Request("http://localhost/api/analytics/pipeline-status");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.pipeline.steps[0].duration).toBe(5000); // 5 seconds in ms
    expect(body.data.pipeline.steps[1].duration).toBeUndefined(); // running step has no duration
  });

  it("returns only the most recent running pipeline", async () => {
    const now = new Date().toISOString();
    const earlier = new Date(Date.now() - 60000).toISOString();

    await createPipelineRun({
      id: "pipeline-old",
      categoryId: "cat1",
      status: "running",
      steps: [],
      currentStepIndex: 0,
      createdAt: earlier,
      updatedAt: earlier,
    });
    await createPipelineRun({
      id: "pipeline-new",
      categoryId: "cat2",
      status: "running",
      steps: [{ step: "collection", status: "running", startedAt: now }],
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    const request = new Request("http://localhost/api/analytics/pipeline-status");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hasActivePipeline).toBe(true);
    expect(body.data.pipeline.id).toBe("pipeline-new");
  });

  it("ignores completed/failed pipelines and returns no active pipeline", async () => {
    const now = new Date().toISOString();

    await createPipelineRun({
      id: "pipeline-completed",
      categoryId: "cat1",
      status: "completed",
      steps: [],
      currentStepIndex: 7,
      createdAt: now,
      updatedAt: now,
    });
    await createPipelineRun({
      id: "pipeline-failed",
      categoryId: "cat2",
      status: "failed",
      steps: [],
      currentStepIndex: 3,
      error: "Some error",
      createdAt: now,
      updatedAt: now,
    });

    const request = new Request("http://localhost/api/analytics/pipeline-status");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hasActivePipeline).toBe(false);
    expect(body.data.pipeline).toBeNull();
  });
});
