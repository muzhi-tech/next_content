import { NextRequest, NextResponse } from "next/server";
import { getWikiIndex, getWikiLog } from "@/lib/wiki";

export async function GET(
  _request: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  try {
    const { categoryId } = params;

    const [index, log] = await Promise.all([
      getWikiIndex(categoryId),
      getWikiLog(categoryId),
    ]);

    return NextResponse.json({
      code: 0,
      data: { index, log },
    });
  } catch (error) {
    console.error("Error getting wiki:", error);
    return NextResponse.json(
      { code: 500, msg: "获取 Wiki 失败" },
      { status: 500 }
    );
  }
}
