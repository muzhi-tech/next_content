import { NextRequest, NextResponse } from "next/server";
import { getKeywords, createKeyword } from "@/lib/db";
import type { Platform } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const keywords = await getKeywords(categoryId);
    return NextResponse.json({ code: 0, data: keywords });
  } catch (error) {
    console.error("Error getting keywords:", error);
    return NextResponse.json(
      { code: 500, msg: "获取关键词失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, platforms, categoryId } = body;

    if (!name || !platforms || !categoryId) {
      return NextResponse.json(
        { code: 400, msg: "缺少必要参数" },
        { status: 400 }
      );
    }

    const keyword = await createKeyword({
      name,
      platforms: platforms as Platform[],
      categoryId,
    });

    return NextResponse.json({ code: 0, data: keyword });
  } catch (error) {
    console.error("Error creating keyword:", error);
    return NextResponse.json(
      { code: 500, msg: "创建关键词失败" },
      { status: 500 }
    );
  }
}
