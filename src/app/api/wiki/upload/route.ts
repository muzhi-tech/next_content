import { NextRequest, NextResponse } from "next/server";
import { getDefaultApiConfig } from "@/lib/db";
import { ingestArticleToWiki } from "@/lib/wiki-ingest";
import { WikiIngestInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const categoryId = formData.get("categoryId") as string;

    if (!file || !categoryId) {
      return NextResponse.json(
        { code: 400, msg: "缺少 file 或 categoryId" },
        { status: 400 }
      );
    }

    const content = await file.text();
    // 移除扩展名作为标题
    const title = file.name.replace(/\.md$/i, "");

    // 检查 AI 配置
    const apiConfig = await getDefaultApiConfig();
    if (!apiConfig) {
      return NextResponse.json(
        { code: 400, msg: "未配置 AI API，请先在设置中添加 API 配置" },
        { status: 400 }
      );
    }

    // 组装成 Wiki Ingest 引擎需要的结构
    const input: WikiIngestInput = {
      articleId: `upload-${Date.now()}`,
      categoryId,
      title,
      content,
      platform: "local",
      publishedAt: new Date().toISOString(),
    };

    // 调用现有的知识库入库逻辑
    const result = await ingestArticleToWiki(input, apiConfig);

    return NextResponse.json({ code: 0, data: result });
  } catch (error) {
    console.error("Error uploading to wiki:", error);
    return NextResponse.json(
      { code: 500, msg: "Wiki 导入失败: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}