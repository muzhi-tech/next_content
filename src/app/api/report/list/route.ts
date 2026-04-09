import { NextRequest, NextResponse } from "next/server";
import { getReports } from "@/lib/db";

/**
 * GET /api/report/list
 * 获取历史报告列表，支持按 categoryId 筛选
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const reports = await getReports(categoryId);
    return NextResponse.json({ code: 0, data: reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { code: 500, msg: "获取报告列表失败" },
      { status: 500 }
    );
  }
}
