import { NextRequest, NextResponse } from "next/server";
import { getArticles, getDefaultApiConfig } from "@/lib/db";
import { ingestArticleToWiki } from "@/lib/wiki-ingest";
import { WikiIngestInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleId, categoryId } = body;

    if (!articleId || !categoryId) {
      return NextResponse.json(
        { code: 400, msg: "缺少 articleId 或 categoryId" },
        { status: 400 }
      );
    }

    // 1. 从 db 获取文章内容
    const { articles: allArticles } = await getArticles({ pageSize: 10000 });
    const article = allArticles.find((a) => a.id === articleId);
    if (!article) {
      return NextResponse.json(
        { code: 404, msg: "文章不存在" },
        { status: 404 }
      );
    }

    // 2. 从 db 获取 apiConfig
    const apiConfig = await getDefaultApiConfig();
    if (!apiConfig) {
      return NextResponse.json(
        { code: 400, msg: "未配置 AI API，请先在设置中添加 API 配置" },
        { status: 400 }
      );
    }

    // 3. 构造 WikiIngestInput
    const input: WikiIngestInput = {
      articleId,
      categoryId,
      title: article.title,
      content: article.content,
      url: article.url,
      platform: article.platform,
      publishedAt: article.publishedAt
        ? new Date(article.publishedAt).toISOString()
        : undefined,
    };

    // 4. 调用 ingest
    const result = await ingestArticleToWiki(input, apiConfig);

    return NextResponse.json({ code: 0, data: result });
  } catch (error) {
    console.error("Error ingesting to wiki:", error);
    return NextResponse.json(
      { code: 500, msg: "Wiki 采集失败: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
