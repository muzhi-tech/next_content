/**
 * POST /api/content/titles
 * 生成标题和摘要
 *
 * 支持账号空间配置（人设、风格）
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAIContext } from "@/lib/db";
import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import { requireAIConfig } from "@/lib/config-check";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      article,
      topic,
      count,
      personaId,
      styleId,
      apiUrl,
      apiKey,
      modelName,
    } = body;

    // article 或 topic 二选一
    if (!article && !topic) {
      return NextResponse.json(
        { code: 400, msg: "缺少文章内容或主题" },
        { status: 400 }
      );
    }

    // 获取 API 配置
    const configCheck = await requireAIConfig({ apiUrl, apiKey, modelName });
    if (!configCheck.ok) return configCheck.response;
    const { apiUrl: effectiveApiUrl, apiKey: effectiveApiKey, modelName: effectiveModelName } = configCheck;

    // 构建 AI 上下文
    let systemPrompt = "";
    if (personaId || styleId) {
      const { systemPrompt: ctxPrompt, contextData } = await buildAIContext({
        personaId,
        styleId,
      });
      if (ctxPrompt) {
        systemPrompt = ctxPrompt + "\n\n";
      }
    }

    const finalSystemPrompt = systemPrompt + `你是一位资深的新媒体编辑，擅长写出吸引眼球的标题和精炼的摘要。
请根据用户提供的文章内容或主题，生成 ${count || 5} 组标题和摘要。

要求：
1. 标题要有吸引力，适合公众号、头条等新媒体平台发布，风格多样（可包含疑问句、数字型、反差型等）
2. 摘要要在1-2句话内概括文章核心观点，语言精炼有力
3. 标题和摘要必须严格对应

请严格按以下 JSON 格式返回，不要返回任何其他内容：
[
  {"title": "标题1", "summary": "摘要1"},
  {"title": "标题2", "summary": "摘要2"},
  {"title": "标题3", "summary": "摘要3"},
  {"title": "标题4", "summary": "摘要4"},
  {"title": "标题5", "summary": "摘要5"}
]`;

    const userContent = article || `主题：${topic}`;

    const messages = [
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: userContent },
    ];

    const raw = await createChatCompletionJSON(
      { apiUrl: effectiveApiUrl, apiKey: effectiveApiKey, modelName: effectiveModelName },
      messages
    );

    const titles = parseJSON(raw);
    if (!Array.isArray(titles)) {
      return NextResponse.json(
        { code: 500, msg: "AI 返回格式异常，期望数组", raw: raw.substring(0, 200) },
        { status: 500 }
      );
    }

    return NextResponse.json({ code: 0, data: { titles } });
  } catch (error) {
    console.error("Titles generation error:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    );
  }
}
