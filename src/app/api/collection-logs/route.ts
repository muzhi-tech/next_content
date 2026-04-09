import { NextRequest, NextResponse } from "next/server";
import { getCollectionLogs } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");

    const logs = await getCollectionLogs({ categoryId, limit });
    return NextResponse.json({ code: 0, data: logs });
  } catch (err) {
    return NextResponse.json({ code: 500, msg: "获取采集日志失败" }, { status: 500 });
  }
}
