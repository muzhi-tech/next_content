import { NextRequest, NextResponse } from "next/server";
import { getKeyword, saveArticles } from "@/lib/db";
import { autoIngestTopArticles } from "@/lib/wiki-ingest";
import { requireXhsKey, requireWxKey } from "@/lib/config-check";
import type { Article, Platform } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId, platforms, autoIngest = false, ingestTopN = 5 } = body;

    if (!keywordId || !platforms || !Array.isArray(platforms)) {
      return NextResponse.json(
        { code: 400, msg: "缺少必要参数", data: null },
        { status: 400 }
      );
    }

    const keyword = await getKeyword(keywordId);
    if (!keyword) {
      return NextResponse.json(
        { code: 404, msg: "关键词不存在", data: null },
        { status: 404 }
      );
    }

    const results: Record<string, { success: boolean; count: number; error?: string }> = {};

    for (const platform of platforms) {
      try {
        if (platform === "xhs") {
          // 小红书搜索
          const xhsKeyCheck = requireXhsKey();
          if (!xhsKeyCheck.ok) {
            results["xhs"] = { success: false, count: 0, error: "未配置小红书 API Key，请在 .env.local 中设置 XHS_API_KEY" };
            continue;
          }

          const xhsResponse = await fetch("https://cn8n.com/p2/xhs/search_note_web", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${xhsKeyCheck.key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: 9,
              keyword: keyword.name,
              page: "1",
              sort: "comment_descending",
              note_type: "note",
              note_time: "day",
              searchId: "",
              sessionId: "",
            }),
          });

          const xhsData = await xhsResponse.json();
          const items = xhsData?.data?.items || [];

          const articles: Omit<Article, "id">[] = items
            .filter((item: any) => item.note)
            .map((item: any) => {
              const note = item.note;
              return {
                keywordId,
                keywordName: keyword.name,
                platform: "xhs" as Platform,
                title: note.title || "",
                content: note.desc || note.abstract_show || "",
                author: note.user?.nickname || "",
                authorAvatar: note.user?.images || "",
                url: `https://www.xiaohongshu.com/explore/${note.id}`,
                coverImage: note.images_list?.[0]?.url || "",
                likes: note.liked_count || 0,
                comments: note.comments_count || 0,
                shares: note.shared_count || 0,
                collectedAt: Date.now(),
                publishedAt: note.timestamp || Date.now(),
                isOriginal: note.tag_info?.title?.includes("原创") || false,
                extra: {
                  noteId: note.id,
                  collectedCount: note.collected_count || 0,
                  userId: note.user?.userid || "",
                },
              };
            });

          const { added } = await saveArticles(articles);
          results["xhs"] = { success: true, count: added };

        } else if (platform === "wx") {
          // 公众号搜索
          const wxKeyCheck = requireWxKey();
          if (!wxKeyCheck.ok) {
            results["wx"] = { success: false, count: 0, error: "未配置公众号 API Key，请在 .env.local 中设置 WX_API_KEY" };
            continue;
          }

          const wxResponse = await fetch("http://cn8n.com/p4/fbmain/monitor/v3/kw_search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${wxKeyCheck.key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              kw: keyword.name,
              sort_type: 1,
              mode: 1,
              period: 7,
              page: 1,
              any_kw: "",
              ex_kw: "",
              verifycode: "",
              type: 1,
            }),
          });

          const wxData = await wxResponse.json();
          const items = wxData?.data?.data || [];

          const articles: Omit<Article, "id">[] = items.map((item: any) => ({
            keywordId,
            keywordName: keyword.name,
            platform: "wx" as Platform,
            title: item.title || "",
            content: item.content || "",
            author: item.wx_name || "",
            authorAvatar: item.avatar || "",
            url: item.url || item.short_link || "",
            likes: item.praise || 0,
            comments: item.read || 0,
            collectedAt: Date.now(),
            publishedAt: item.publish_time || Date.now(),
            isOriginal: item.is_original === 1,
            extra: {
              ghid: item.ghid,
              wxId: item.wx_id,
              looking: item.looking || 0,
            },
          }));

          const { added } = await saveArticles(articles);
          results["wx"] = { success: true, count: added };
        }
      } catch (err) {
        results[platform] = {
          success: false,
          count: 0,
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    }

    // Fire-and-forget auto-ingest (does not block response)
    if (autoIngest && keyword.categoryId) {
      autoIngestTopArticles(keyword.categoryId, ingestTopN).catch((err) => {
        console.error("[refresh] Auto-ingest background error:", err);
      });
    }

    return NextResponse.json({ code: 0, msg: "刷新成功", data: results });
  } catch (error) {
    console.error("Error refreshing:", error);
    return NextResponse.json(
      { code: 500, msg: "刷新失败", data: null },
      { status: 500 }
    );
  }
}
