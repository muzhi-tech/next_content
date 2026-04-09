/**
 * POST /api/platforms/wx-search
 * 公众号搜索（契约别名路由，默认值：sort_type=1, period=30）
 */

import { NextRequest, NextResponse } from "next/server";
import { requireWxKey } from "@/lib/config-check";

const WX_API_URL = "http://cn8n.com/p4/fbmain/monitor/v3/kw_search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      keyword,
      page = 1,
      period = 30,
      sort_type = 1,
    } = body;

    if (!keyword) {
      return NextResponse.json(
        { code: 400, msg: "缺少关键词" },
        { status: 400 }
      );
    }

    const keyCheck = requireWxKey();
    if (!keyCheck.ok) return keyCheck.response;

    const response = await fetch(WX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyCheck.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kw: keyword,
        sort_type,
        mode: 1,
        period,
        page,
        any_kw: "",
        ex_kw: "",
        verifycode: "",
        type: 1,
      }),
    });

    const data = await response.json();
    return NextResponse.json({ code: 0, data });
  } catch (error) {
    console.error("Error searching wx:", error);
    return NextResponse.json(
      { code: 500, msg: "公众号搜索失败" },
      { status: 500 }
    );
  }
}
