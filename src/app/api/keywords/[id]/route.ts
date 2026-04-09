import { NextRequest, NextResponse } from "next/server";
import { updateKeyword, deleteKeyword, deleteArticlesByKeyword } from "@/lib/db";
import type { Platform } from "@/lib/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, platforms } = body;

    const keyword = await updateKeyword(params.id, {
      name,
      platforms: platforms as Platform[],
    });

    if (!keyword) {
      return NextResponse.json(
        { code: 404, msg: "关键词不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ code: 0, data: keyword });
  } catch (error) {
    console.error("Error updating keyword:", error);
    return NextResponse.json(
      { code: 500, msg: "更新关键词失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 先删除关联的文章
    await deleteArticlesByKeyword(params.id);
    // 再删除关键词
    const deleted = await deleteKeyword(params.id);

    if (!deleted) {
      return NextResponse.json(
        { code: 404, msg: "关键词不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ code: 0, msg: "deleted" });
  } catch (error) {
    console.error("Error deleting keyword:", error);
    return NextResponse.json(
      { code: 500, msg: "删除关键词失败" },
      { status: 500 }
    );
  }
}
