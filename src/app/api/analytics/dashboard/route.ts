import { NextRequest, NextResponse } from "next/server";
import {
  getDashboardArticleStats,
  getPlatformDistribution,
  getCollectionTrend,
  getGeneratedContentStats,
  getTopKeywords,
} from "@/lib/db";

/**
 * GET /api/analytics/dashboard
 * 数据分析聚合端点 - 返回首页仪表板所需的所有统计数据
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 内容总量 + 本周新增
    const articleStats = await getDashboardArticleStats();

    // 2. 平台分布
    const platformDistribution = await getPlatformDistribution();

    // 3. 近7天采集趋势（从 collection_logs 计算）
    const collectionTrend = await getCollectionTrend();

    // 如果近7天没有采集记录，生成7天的空数据
    const today = new Date();
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const existing = collectionTrend.find((c) => c.date === dateStr);
      last7Days.push({ date: dateStr, count: existing ? existing.count : 0 });
    }

    // 4. AI 产出统计
    const generatedContentStats = await getGeneratedContentStats();

    // 5. 关键词热度 Top 10
    const topKeywords = await getTopKeywords(10);

    const result = {
      totalArticles: articleStats.total,
      weeklyArticles: articleStats.weekly,
      platformDistribution,
      collectionTrend: last7Days,
      generatedContentStats,
      topKeywords,
    };

    return NextResponse.json({ code: 0, data: result });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { code: 500, msg: "获取仪表板数据失败" },
      { status: 500 }
    );
  }
}
