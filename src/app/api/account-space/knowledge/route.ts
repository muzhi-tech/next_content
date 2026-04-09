import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBases, createKnowledgeBase } from "@/lib/db";

export async function GET() {
  try {
    const knowledgeBases = await getKnowledgeBases();
    return NextResponse.json({ code: 0, data: knowledgeBases });
  } catch (error) {
    console.error("Error getting knowledge bases:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, content } = body;

    if (!name || !content) {
      return NextResponse.json({ code: 400, msg: "缺少必填字段" }, { status: 400 });
    }

    const knowledgeBase = await createKnowledgeBase({
      name,
      description: description || "",
      content,
    });

    return NextResponse.json({ code: 0, data: knowledgeBase });
  } catch (error) {
    console.error("Error creating knowledge base:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
