import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/db";
import type { Platform } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId") || undefined;
    const platform = searchParams.get("platform") as Platform | null || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const date = searchParams.get("date") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const result = await getArticles({
      keywordId,
      platform,
      categoryId,
      page,
      pageSize,
    });

    // Filter by date if provided
    let filteredArticles = result.articles;
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).getTime();

      filteredArticles = filteredArticles.filter((article) => {
        const timestamp = article.collectedAt || article.publishedAt;
        return timestamp >= startOfDay && timestamp <= endOfDay;
      });
    }

    return NextResponse.json({
      code: 0,
      data: filteredArticles,
      total: date ? filteredArticles.length : result.total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error getting articles:", error);
    return NextResponse.json(
      { code: 500, msg: "获取文章失败" },
      { status: 500 }
    );
  }
}
