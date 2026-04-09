import { NextRequest, NextResponse } from "next/server";
import { getGeneratedContents, createGeneratedContent } from "@/lib/db";
import type { ContentStatus, ContentSourceType } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const status = (searchParams.get("status") as ContentStatus) || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const result = await getGeneratedContents({ categoryId, status, search, page, pageSize });
    return NextResponse.json({ code: 0, data: result.items, total: result.total });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "获取内容列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.topic || !body.content) {
      return NextResponse.json({ code: 400, msg: "缺少必填字段: topic, content" }, { status: 400 });
    }

    const item = await createGeneratedContent({
      categoryId: body.categoryId,
      topic: body.topic,
      content: body.content,
      style: body.style,
      personaId: body.personaId,
      status: body.status,
      wikiContext: body.wikiContext,
      titles: body.titles,
      coverPrompt: body.coverPrompt,
      sourceType: body.sourceType as ContentSourceType,
    });

    return NextResponse.json({ code: 0, data: item });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "创建内容失败" }, { status: 500 });
  }
}
