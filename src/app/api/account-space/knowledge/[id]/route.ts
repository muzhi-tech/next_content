import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const knowledgeBase = await getKnowledgeBase(id);

    if (!knowledgeBase) {
      return NextResponse.json({ code: 404, msg: "知识库不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: knowledgeBase });
  } catch (error) {
    console.error("Error getting knowledge base:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, content } = body;

    const knowledgeBase = await updateKnowledgeBase(id, {
      name,
      description,
      content,
    });

    if (!knowledgeBase) {
      return NextResponse.json({ code: 404, msg: "知识库不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: knowledgeBase });
  } catch (error) {
    console.error("Error updating knowledge base:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteKnowledgeBase(id);

    if (!success) {
      return NextResponse.json({ code: 404, msg: "知识库不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, msg: "deleted" });
  } catch (error) {
    console.error("Error deleting knowledge base:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
