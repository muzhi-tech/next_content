/**
 * POST /api/platforms/xhs-search
 * 小红书搜索（契约别名路由，默认值：sort="popularity", note_time="7d"）
 */

import { NextRequest, NextResponse } from "next/server";
import { requireXhsKey } from "@/lib/config-check";

const XHS_API_URL = "https://cn8n.com/p2/xhs/search_note_web";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      keyword,
      page = "1",
      sort = "popularity",
      note_time = "7d",
    } = body;

    if (!keyword) {
      return NextResponse.json(
        { code: 400, msg: "缺少关键词" },
        { status: 400 }
      );
    }

    const keyCheck = requireXhsKey();
    if (!keyCheck.ok) return keyCheck.response;

    const response = await fetch(XHS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyCheck.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: 9,
        keyword,
        page: page.toString(),
        sort,
        note_type: "note",
        note_time,
        searchId: "",
        sessionId: "",
      }),
    });

    const data = await response.json();
    return NextResponse.json({ code: 0, data });
  } catch (error) {
    console.error("Error searching xhs:", error);
    return NextResponse.json(
      { code: 500, msg: "小红书搜索失败" },
      { status: 500 }
    );
  }
}
