import { NextRequest, NextResponse } from "next/server";
import { getStyle, updateStyle, deleteStyle } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const style = await getStyle(id);

    if (!style) {
      return NextResponse.json({ code: 404, msg: "风格不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: style });
  } catch (error) {
    console.error("Error getting style:", error);
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
    const { name, icon, systemPrompt } = body;

    const style = await updateStyle(id, { name, icon, systemPrompt });

    if (!style) {
      return NextResponse.json({ code: 404, msg: "风格不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: style });
  } catch (error) {
    console.error("Error updating style:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteStyle(id);

    if (!success) {
      return NextResponse.json({ code: 404, msg: "风格不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, msg: "deleted" });
  } catch (error) {
    console.error("Error deleting style:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
