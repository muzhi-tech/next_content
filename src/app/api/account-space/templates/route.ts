import { NextRequest, NextResponse } from "next/server";
import { getTemplates, createTemplate } from "@/lib/db";

export async function GET() {
  try {
    const templates = await getTemplates();
    return NextResponse.json({ code: 0, data: templates });
  } catch (error) {
    console.error("Error getting templates:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, titleTemplate, contentTemplate, coverPromptTemplate } = body;

    if (!name || !titleTemplate || !contentTemplate) {
      return NextResponse.json({ code: 400, msg: "缺少必填字段" }, { status: 400 });
    }

    const template = await createTemplate({
      name,
      titleTemplate,
      contentTemplate,
      coverPromptTemplate,
    });

    return NextResponse.json({ code: 0, data: template });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
