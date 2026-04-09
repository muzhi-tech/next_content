/**
 * POST /api/pipeline  — 启动 8 大 Agent 协同管道（SSE 流式推送）
 * GET  /api/pipeline  — 列出最近管道记录（支持 ?categoryId= 筛选）
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultApiConfig, getPipelineRun } from "@/lib/db";
import { runPipeline, listPipelineRuns, type PipelineEvent } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const runs = await listPipelineRuns({ categoryId, limit });

    return NextResponse.json({
      code: 0,
      msg: "查询成功",
      data: runs,
    });
  } catch (error) {
    console.error("List pipelines error:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "查询管道列表失败", data: null },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { categoryId?: string; keywordId?: string; stream?: boolean; resumeFromPipelineId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 400, msg: "无效请求体", data: null },
      { status: 400 }
    );
  }

  const { categoryId, keywordId, stream: useSSE, resumeFromPipelineId } = body;

  if (!categoryId && !resumeFromPipelineId) {
    return NextResponse.json(
      { code: 400, msg: "缺少 categoryId", data: null },
      { status: 400 }
    );
  }

  // Concurrency check: reject if a pipeline is already running for this category
  let effectiveCategoryId = categoryId || '';
  if (!effectiveCategoryId && resumeFromPipelineId) {
    const prevRun = await getPipelineRun(resumeFromPipelineId);
    if (prevRun) effectiveCategoryId = prevRun.categoryId;
  }
  if (effectiveCategoryId) {
    const running = await listPipelineRuns({ categoryId: effectiveCategoryId, limit: 10 });
    if (running.some((r: any) => r.status === 'running')) {
      return NextResponse.json(
        { code: 409, msg: "该分类已有管道运行中", data: null },
        { status: 409 }
      );
    }
  }

  const apiConfig = await getDefaultApiConfig();
  if (!apiConfig) {
    return NextResponse.json(
      { code: 400, msg: "未配置 AI API，请先在设置中添加 API 配置", data: null },
      { status: 400 }
    );
  }

  // If client does not request SSE, fall back to synchronous response
  if (!useSSE) {
    try {
      const ctx = await runPipeline({
        categoryId: categoryId || '',
        keywordId,
        resumeFromPipelineId,
        apiConfig: {
          apiUrl: apiConfig.apiUrl,
          apiKey: apiConfig.apiKey,
          modelName: apiConfig.modelName,
        },
      });

      return NextResponse.json({
        code: 0,
        msg: "管道执行成功",
        data: {
          id: ctx.id,
          status: ctx.status,
          currentStep: ctx.currentStep,
          history: ctx.history,
          topic: ctx.topic,
          content: ctx.content,
          score: ctx.score,
          coverPrompt: ctx.coverPrompt,
        },
      });
    } catch (error) {
      console.error("Pipeline error:", error);
      return NextResponse.json(
        { code: 500, msg: error instanceof Error ? error.message : "管道执行失败", data: null },
        { status: 500 }
      );
    }
  }

  // SSE streaming mode
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function sendSSE(event: string, data: unknown): void {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may be closed
        }
      }

      const onEvent = (event: PipelineEvent): void => {
        switch (event.type) {
          case "pipeline_start":
            sendSSE("pipeline_start", {
              type: "pipeline_started",
              pipelineId: event.pipelineId,
              status: "running",
            });
            break;
          case "step_start":
            sendSSE("step_start", {
              type: "step_started",
              pipelineId: event.pipelineId,
              step: event.step,
              stepIndex: event.stepIndex,
            });
            break;
          case "step_complete":
            sendSSE("step_complete", {
              type: "step_completed",
              pipelineId: event.pipelineId,
              step: event.step,
              stepIndex: event.stepIndex,
              score: event.data?.score,
              feedback: event.data?.feedback,
              output: event.data?.output ?? event.data?.content,
            });
            break;
          case "step_failed":
            sendSSE("step_failed", {
              type: "step_failed",
              pipelineId: event.pipelineId,
              step: event.step,
              stepIndex: event.stepIndex,
              error: event.error,
            });
            break;
          case "wiki_context":
            sendSSE("wiki_context", {
              type: "wiki_context",
              pipelineId: event.pipelineId,
              pages: event.data?.pages || [],
            });
            break;
          case "pipeline_complete":
            sendSSE("pipeline_complete", {
              type: "pipeline_completed",
              pipelineId: event.pipelineId,
              status: "completed",
              output: event.data?.content ?? event.data?.output,
            });
            break;
          case "pipeline_failed":
            sendSSE("pipeline_failed", {
              type: "pipeline_failed",
              pipelineId: event.pipelineId,
              status: "failed",
              error: event.error,
            });
            break;
        }
      };

      // Run pipeline in background; close stream when done
      runPipeline({
        categoryId: categoryId || '',
        keywordId,
        resumeFromPipelineId,
        apiConfig: {
          apiUrl: apiConfig.apiUrl,
          apiKey: apiConfig.apiKey,
          modelName: apiConfig.modelName,
        },
        onEvent,
      })
        .catch((error) => {
          sendSSE("pipeline_failed", {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
