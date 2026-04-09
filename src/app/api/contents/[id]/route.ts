import { NextRequest, NextResponse } from "next/server";
import { getGeneratedContent, updateGeneratedContent, deleteGeneratedContent } from "@/lib/db";
import type { ContentStatus } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const item = await getGeneratedContent(params.id);
    if (!item) {
      return NextResponse.json({ code: 404, msg: "内容不存在" }, { status: 404 });
    }
    return NextResponse.json({ code: 0, data: item });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "获取内容失败" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateGeneratedContent(params.id, {
      topic: body.topic,
      content: body.content,
      style: body.style,
      personaId: body.personaId,
      status: body.status as ContentStatus,
      wikiContext: body.wikiContext,
      titles: body.titles,
      coverPrompt: body.coverPrompt,
    });
    if (!updated) {
      return NextResponse.json({ code: 404, msg: "内容不存在" }, { status: 404 });
    }
    return NextResponse.json({ code: 0, data: updated });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "更新内容失败" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ok = await deleteGeneratedContent(params.id);
    if (!ok) {
      return NextResponse.json({ code: 404, msg: "内容不存在" }, { status: 404 });
    }
    return NextResponse.json({ code: 0, data: { deleted: true } });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "删除内容失败" }, { status: 500 });
  }
}
