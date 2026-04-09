import { NextRequest, NextResponse } from "next/server";
import { listPipelineRuns } from "@/lib/db";

const STEP_KEYS = ["collection", "topic", "writing", "score", "humanize", "review", "image", "publish"];
const STEP_NAMES: Record<string, string> = {
  collection: "采集",
  topic: "选题",
  writing: "写作",
  score: "打分",
  humanize: "去AI化",
  review: "审核",
  image: "配图",
  publish: "发布",
};

/**
 * GET /api/analytics/agent-stats
 * Agent 执行统计 - 从 pipeline_runs 表聚合计算各 Agent 的执行指标
 */
export async function GET(request: NextRequest) {
  try {
    // 获取最新 100 条 pipeline runs
    const runs = await listPipelineRuns({ limit: 100 });

    // 初始化各 Agent 统计
    const agentStats: Record<string, {
      name: string;
      triggered: number;
      success: number;
      failed: number;
      totalDuration: number;
    }> = {};

    for (const key of STEP_KEYS) {
      agentStats[key] = {
        name: STEP_NAMES[key],
        triggered: 0,
        success: 0,
        failed: 0,
        totalDuration: 0,
      };
    }

    // 遍历所有 runs，聚合每个 step 的统计
    for (const run of runs) {
      for (const step of run.steps) {
        if (!STEP_KEYS.includes(step.step)) continue;

        const stats = agentStats[step.step];
        stats.triggered++;

        if (step.status === "completed") {
          stats.success++;
          // 计算耗时
          if (step.startedAt && step.completedAt) {
            const duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
            stats.totalDuration += duration;
          }
        } else if (step.status === "failed") {
          stats.failed++;
        }
      }
    }

    // 计算最终指标
    const result = STEP_KEYS.map((key) => {
      const stats = agentStats[key];
      const successRate = stats.triggered > 0
        ? Math.round((stats.success / stats.triggered) * 100)
        : 0;
      const avgDuration = stats.success > 0
        ? Math.round(stats.totalDuration / stats.success / 100) / 10  // 转换为秒，保留1位小数
        : 0;

      return {
        key,
        name: stats.name,
        triggered: stats.triggered,
        success: stats.success,
        failed: stats.failed,
        successRate,
        avgDuration,
      };
    });

    return NextResponse.json({ code: 0, data: result });
  } catch (error) {
    console.error("Error fetching agent stats:", error);
    return NextResponse.json(
      { code: 500, msg: "获取 Agent 统计失败" },
      { status: 500 }
    );
  }
}
