import { NextRequest, NextResponse } from "next/server";
import { requireWxKey } from "@/lib/config-check";

const API_BASE_URL = "http://cn8n.com/p4/fbmain/monitor/v3/kw_search";

export interface WxArticle {
  avatar: string;
  classify: string;
  content: string;
  ghid: string;
  ip_wording: string;
  is_original: number;
  looking: number;
  praise: number;
  publish_time: number;
  publish_time_str: string;
  read: number;
  short_link: string;
  title: string;
  update_time: number;
  update_time_str: string;
  url: string;
  wx_id: string;
  wx_name: string;
}

export interface WxArticleResponse {
  code: number;
  data: {
    data: WxArticle[];
    data_number: number;
    page: number;
    total: number;
    total_page: number;
  };
  msg: string;
  requestId: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get("keyword") || "AI";
  const page = parseInt(searchParams.get("page") || "1");
  const period = parseInt(searchParams.get("period") || "7");
  const sortType = parseInt(searchParams.get("sort_type") || "1");

  const keyCheck = requireWxKey();
  if (!keyCheck.ok) return keyCheck.response;

  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyCheck.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kw: keyword,
        sort_type: sortType,
        mode: 1,
        period: period,
        page: page,
        any_kw: "",
        ex_kw: "",
        verifycode: "",
        type: 1,
      }),
    });

    const data: WxArticleResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch WeChat articles:", error);
    return NextResponse.json(
      { code: 500, msg: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}
