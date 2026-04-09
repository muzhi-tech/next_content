/**
 * GET /api/health — 系统健康检查
 */

import { NextResponse } from "next/server";
import { getDefaultApiConfig, getCategories } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [apiConfig, categories] = await Promise.all([
      getDefaultApiConfig(),
      getCategories(),
    ]);

    return NextResponse.json({
      code: 0,
      data: {
        db: "ok",
        apiConfig: !!apiConfig,
        hasCategories: categories.length > 0,
        xhsKey: !!process.env.XHS_API_KEY,
        wxKey: !!process.env.WX_API_KEY,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { code: 500, msg: "健康检查失败" },
      { status: 500 }
    );
  }
}
