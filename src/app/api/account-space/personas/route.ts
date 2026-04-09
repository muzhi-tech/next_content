import { NextRequest, NextResponse } from "next/server";
import { getPersonas, createPersona } from "@/lib/db";

export async function GET() {
  try {
    const personas = await getPersonas();
    return NextResponse.json({ code: 0, data: personas });
  } catch (error) {
    console.error("Error getting personas:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, avatar, systemPrompt } = body;

    if (!name || !systemPrompt) {
      return NextResponse.json({ code: 400, msg: "缺少必填字段" }, { status: 400 });
    }

    const persona = await createPersona({
      name,
      description: description || "",
      avatar,
      systemPrompt,
    });

    return NextResponse.json({ code: 0, data: persona });
  } catch (error) {
    console.error("Error creating persona:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
