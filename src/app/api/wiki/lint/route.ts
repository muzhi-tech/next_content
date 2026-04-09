import { NextRequest, NextResponse } from "next/server";
import { lintWiki } from "@/lib/wiki-lint";

/**
 * POST /api/wiki/lint
 * Body: { categoryId: string }
 * 返回 Wiki 健康检查结果
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId } = body;

    if (!categoryId) {
      return NextResponse.json(
        { code: 400, msg: "categoryId required" },
        { status: 400 }
      );
    }

    const issues = await lintWiki(categoryId);
    return NextResponse.json({ code: 0, data: { issues } });
  } catch (error) {
    console.error("Wiki lint error:", error);
    return NextResponse.json(
      { code: 500, msg: "Wiki 健康检查失败" },
      { status: 500 }
    );
  }
}
