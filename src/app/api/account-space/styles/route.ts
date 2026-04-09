import { NextRequest, NextResponse } from "next/server";
import { getStyles, createStyle } from "@/lib/db";

export async function GET() {
  try {
    const styles = await getStyles();
    return NextResponse.json({ code: 0, data: styles });
  } catch (error) {
    console.error("Error getting styles:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, icon, systemPrompt } = body;

    if (!name || !icon || !systemPrompt) {
      return NextResponse.json({ code: 400, msg: "缺少必填字段" }, { status: 400 });
    }

    const style = await createStyle({ name, icon, systemPrompt });
    return NextResponse.json({ code: 0, data: style });
  } catch (error) {
    console.error("Error creating style:", error);
    return NextResponse.json({ code: 500, msg: "服务器内部错误" }, { status: 500 });
  }
}
