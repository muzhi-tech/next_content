/**
 * GET   /api/pipeline/:id  — 查询管道执行状态
 * PATCH /api/pipeline/:id  — 选题确认后恢复管道
 */

import { NextRequest, NextResponse } from "next/server";
import { getPipelineRun } from "@/lib/db";
import { resumePipeline, type PipelineEvent } from "@/lib/pipeline";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = await getPipelineRun(params.id);

    if (!run) {
      return NextResponse.json(
        { code: 404, msg: "管道不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: 0,
      data: {
        id: run.id,
        categoryId: run.categoryId,
        status: run.status,
        steps: run.steps,
        currentStepIndex: run.currentStepIndex,
        result: run.result,
        error: run.error,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get pipeline error:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "查询管道失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let body: { action?: string; topic?: string; stream?: boolean; targetPlatforms?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: 400, msg: "无效请求体" },
        { status: 400 }
      );
    }

    const { action, topic, stream: useSSE, targetPlatforms } = body;

    if (action === "approve-topic") {
      const run = await getPipelineRun(params.id);
      if (!run) {
        return NextResponse.json({ code: 404, msg: "管道不存在" }, { status: 404 });
      }
      if (run.status !== "paused") {
        return NextResponse.json({ code: 400, msg: "管道不在暂停状态" }, { status: 400 });
      }

      if (!useSSE) {
        // Synchronous mode
        const ctx = await resumePipeline({
          pipelineId: params.id,
          approvedTopic: topic,
          targetPlatforms,
        });

        return NextResponse.json({
          code: 0,
          msg: "管道恢复执行",
          data: {
            id: ctx.id,
            status: ctx.status,
            currentStep: ctx.currentStep,
            topic: ctx.topic,
          },
        });
      }

      // SSE streaming mode
      const encoder = new TextEncoder();

      const responseStream = new ReadableStream({
        start(controller) {
          function sendSSE(event: string, data: unknown): void {
            try {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            } catch { /* closed */ }
          }

          const onEvent = (event: PipelineEvent): void => {
            switch (event.type) {
              case "pipeline_start":
                sendSSE("pipeline_start", { type: "pipeline_resumed", pipelineId: event.pipelineId, status: "running" });
                break;
              case "step_start":
                sendSSE("step_start", { type: "step_started", pipelineId: event.pipelineId, step: event.step, stepIndex: event.stepIndex });
                break;
              case "step_complete":
                sendSSE("step_complete", { type: "step_completed", pipelineId: event.pipelineId, step: event.step, stepIndex: event.stepIndex, data: event.data });
                break;
              case "step_failed":
                sendSSE("step_failed", { type: "step_failed", pipelineId: event.pipelineId, step: event.step, stepIndex: event.stepIndex, error: event.error });
                break;
              case "pipeline_complete":
                sendSSE("pipeline_complete", { type: "pipeline_completed", pipelineId: event.pipelineId, status: "completed", data: event.data });
                break;
              case "pipeline_failed":
                sendSSE("pipeline_failed", { type: "pipeline_failed", pipelineId: event.pipelineId, status: "failed", error: event.error });
                break;
            }
          };

          resumePipeline({
            pipelineId: params.id,
            approvedTopic: topic,
            targetPlatforms,
            onEvent,
          })
            .catch((error) => {
              sendSSE("pipeline_failed", { status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
            })
            .finally(() => {
              try { controller.close(); } catch { /* */ }
            });
        },
      });

      return new Response(responseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    return NextResponse.json({ code: 400, msg: `未知操作: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("Patch pipeline error:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "操作失败" },
      { status: 500 }
    );
  }
}
