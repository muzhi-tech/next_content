/**
 * POST /api/content/write
 * 生成文章正文（SSE 流式输出）
 *
 * 支持账号空间配置（人设、风格、知识库）
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAIContext } from "@/lib/db";
import { createChatCompletionStream } from "@/lib/content-generator";
import { requireAIConfig } from "@/lib/config-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      topic,
      style,
      keywords,
      length,
      personaId,
      styleId,
      knowledgeIds,
      templateId,
      apiUrl,
      apiKey,
      modelName,
      categoryId,
      useWiki,
      wikiMode,
    } = body;

    if (!topic) {
      return NextResponse.json(
        { code: 400, msg: "缺少主题" },
        { status: 400 }
      );
    }

    // 获取 API 配置
    const configCheck = await requireAIConfig({ apiUrl, apiKey, modelName });
    if (!configCheck.ok) return configCheck.response;
    const { apiUrl: effectiveApiUrl, apiKey: effectiveApiKey, modelName: effectiveModelName } = configCheck;

    // 构建 AI 上下文
    const { systemPrompt, contextData } = await buildAIContext({
      personaId,
      styleId,
      knowledgeIds,
      templateId,
    });

    // 构建 Wiki 上下文（如果启用）
    let wikiContext = '';
    let matchedPages: string[] = [];
    if (useWiki && categoryId) {
      try {
        const { buildWikiContext } = await import('@/lib/wiki-query');
        const config = { apiUrl: effectiveApiUrl, apiKey: effectiveApiKey, modelName: effectiveModelName } as any;
        wikiContext = await buildWikiContext(categoryId, topic, config, keywords);
      } catch (e) {
        console.error('Wiki context not available:', e);
      }
    }

    const messages: { role: string; content: string }[] = [];

    if (systemPrompt) {
      let finalSystemPrompt = systemPrompt;
      if (wikiContext) {
        finalSystemPrompt += `\n\n## 参考资料\n以下是从知识库中检索到的相关背景信息，请充分参考但不直接复制：\n\n${wikiContext}`;
      }
      messages.push({ role: "system", content: finalSystemPrompt });
    } else if (style) {
      const { getStyle, buildUserPrompt } = await import("@/lib/styles");
      const styleTemplate = getStyle(style) || getStyle("tech");
      if (styleTemplate) {
        let styleSystemPrompt = styleTemplate.systemPrompt;
        if (wikiContext) {
          styleSystemPrompt += `\n\n## 参考资料\n以下是从知识库中检索到的相关背景信息，请充分参考但不直接复制：\n\n${wikiContext}`;
        }
        messages.push({ role: "system", content: styleSystemPrompt });
        messages.push({ role: "user", content: buildUserPrompt(styleTemplate, topic, keywords, length) });
      }
    }

    if (messages.length === 0 && !personaId && !styleId && !knowledgeIds) {
      const { getStyle, buildUserPrompt } = await import("@/lib/styles");
      const styleTemplate = getStyle(style) || getStyle("tech");
      if (styleTemplate) {
        messages.push({ role: "system", content: styleTemplate.systemPrompt });
        messages.push({ role: "user", content: buildUserPrompt(styleTemplate, topic, keywords, length) });
      }
    } else if (messages.length > 0) {
      const userPrompt = buildUserPromptWithContext(
        topic,
        keywords,
        length,
        contextData.template?.contentTemplate
      );
      messages.push({ role: "user", content: userPrompt });
    } else {
      return NextResponse.json(
        { code: 400, msg: "缺少风格配置" },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送 meta 帧（包含 Wiki 匹配页面信息）
          if (matchedPages.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ meta: { matchedPages } })}\n\n`)
            );
          }
          await createChatCompletionStream(
            { apiUrl: effectiveApiUrl, apiKey: effectiveApiKey, modelName: effectiveModelName },
            messages,
            (chunk) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "content", content: chunk })}\n\n`)
              );
            }
          );
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "生成失败";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Article generation error:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    );
  }
}

function buildUserPromptWithContext(
  topic: string,
  keywords?: string[],
  length?: string,
  contentTemplate?: string
): string {
  let prompt = `请围绕以下主题写一篇文章：\n\n主题：${topic}`;

  if (contentTemplate) {
    prompt += `\n\n内容模板：${contentTemplate}`;
  }

  if (keywords && keywords.length > 0) {
    prompt += `\n\n关键词：${keywords.join("、")}`;
  }

  if (length) {
    prompt += `\n\n字数要求：${length}`;
  }

  prompt += `\n\n请确保文章：\n1. 标题吸引人\n2. 内容有价值、有深度\n3. 结构清晰\n4. 语言流畅`;

  return prompt;
}
