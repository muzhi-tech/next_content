/**
 * GET /api/pipeline/:id
 * 查询管道执行状态（从 db.json 读取）
 */

import { NextRequest, NextResponse } from "next/server";
import { getPipelineRun } from "@/lib/db";

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
