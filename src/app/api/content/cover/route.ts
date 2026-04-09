/**
 * POST /api/content/cover
 * 生成封面图提示词
 */

import { NextRequest, NextResponse } from "next/server";
import { generateCoverPrompt } from "@/lib/content-generator";
import { requireAIConfig } from "@/lib/config-check";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, style, apiUrl, apiKey, modelName } = body;

    if (!topic) {
      return NextResponse.json(
        { code: 400, msg: "缺少主题" },
        { status: 400 }
      );
    }

    // 获取 API 配置
    const configCheck = await requireAIConfig({ apiUrl, apiKey, modelName });
    if (!configCheck.ok) return configCheck.response;

    const result = await generateCoverPrompt(
      { apiUrl: configCheck.apiUrl, apiKey: configCheck.apiKey, modelName: configCheck.modelName },
      topic,
      style
    );

    return NextResponse.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    console.error("Cover prompt generation error:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    );
  }
}
