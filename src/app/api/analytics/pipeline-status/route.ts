import { NextRequest, NextResponse } from "next/server";
import { getActivePipelineRun } from "@/lib/db";

/**
 * GET /api/analytics/pipeline-status
 * 当前活跃管道状态 - 返回 status='running' 的最新管道
 */
export async function GET(request: NextRequest) {
  try {
    const pipeline = await getActivePipelineRun();

    if (!pipeline) {
      return NextResponse.json({
        code: 0,
        data: {
          hasActivePipeline: false,
          pipeline: null,
        },
      });
    }

    // 计算每个 step 的时长
    const stepsWithDuration = pipeline.steps.map((step) => {
      let duration: number | undefined;
      if (step.startedAt && step.completedAt) {
        duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
      }
      return {
        step: step.step,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        duration,
      };
    });

    return NextResponse.json({
      code: 0,
      data: {
        hasActivePipeline: true,
        pipeline: {
          id: pipeline.id,
          categoryId: pipeline.categoryId,
          status: pipeline.status,
          currentStepIndex: pipeline.currentStepIndex,
          steps: stepsWithDuration,
          createdAt: pipeline.createdAt,
          updatedAt: pipeline.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching pipeline status:", error);
    return NextResponse.json(
      { code: 500, msg: "获取管道状态失败" },
      { status: 500 }
    );
  }
}
