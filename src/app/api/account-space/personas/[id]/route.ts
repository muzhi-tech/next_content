import { NextRequest, NextResponse } from "next/server";
import { getPersona, updatePersona, deletePersona } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const persona = await getPersona(id);

    if (!persona) {
      return NextResponse.json({ code: 404, msg: "人设不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: persona });
  } catch (error) {
    console.error("Error getting persona:", error);
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
    const { name, description, avatar, systemPrompt } = body;

    const persona = await updatePersona(id, {
      name,
      description,
      avatar,
      systemPrompt,
    });

    if (!persona) {
      return NextResponse.json({ code: 404, msg: "人设不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, data: persona });
  } catch (error) {
    console.error("Error updating persona:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deletePersona(id);

    if (!success) {
      return NextResponse.json({ code: 404, msg: "人设不存在" }, { status: 404 });
    }

    return NextResponse.json({ code: 0, msg: "deleted" });
  } catch (error) {
    console.error("Error deleting persona:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
