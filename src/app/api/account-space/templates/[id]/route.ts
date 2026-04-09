import { NextRequest, NextResponse } from "next/server";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await getTemplate(id);

    if (!template) {
      return NextResponse.json({ code: 404, msg: "模板不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: template });
  } catch (error) {
    console.error("Error getting template:", error);
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
    const { name, titleTemplate, contentTemplate, coverPromptTemplate } = body;

    const template = await updateTemplate(id, {
      name,
      titleTemplate,
      contentTemplate,
      coverPromptTemplate,
    });

    if (!template) {
      return NextResponse.json({ code: 404, msg: "模板不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: template });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteTemplate(id);

    if (!success) {
      return NextResponse.json({ code: 404, msg: "模板不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, msg: "deleted" });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
