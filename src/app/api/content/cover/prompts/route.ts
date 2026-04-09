/**
 * POST /api/content/cover/prompts
 * 生成封面图提示词
 *
 * 支持账号空间配置（风格、模板）
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAIContext, getDefaultApiConfig } from "@/lib/db";
import { generateCoverPrompt } from "@/lib/content-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      topic,
      content,
      style,
      personaId,
      styleId,
      templateId,
      apiUrl,
      apiKey,
      modelName,
    } = body;

    if (!topic) {
      return NextResponse.json(
        { code: 400, msg: "缺少必填字段: topic" },
        { status: 400 }
      );
    }

    // 获取 API 配置
    const apiConfig = await getDefaultApiConfig();
    const effectiveApiUrl = apiUrl || apiConfig?.apiUrl;
    const effectiveApiKey = apiKey || apiConfig?.apiKey;
    const effectiveModelName = modelName || apiConfig?.modelName;

    if (!effectiveApiUrl || !effectiveApiKey) {
      return NextResponse.json(
        { code: 400, msg: "缺少 API 配置" },
        { status: 400 }
      );
    }

    // 获取账号空间配置
    let coverPromptTemplate: string | undefined;
    let stylePrompt: string | undefined;

    if (templateId || styleId || personaId) {
      const { contextData } = await buildAIContext({
        personaId,
        styleId,
        templateId,
      });

      // 优先使用模板的封面提示词模板
      if (contextData.template?.coverPromptTemplate) {
        coverPromptTemplate = contextData.template.coverPromptTemplate;
      }

      // 使用风格的系统提示词作为风格偏好
      if (contextData.style?.systemPrompt) {
        stylePrompt = contextData.style.systemPrompt;
      }
    }

    // 构建风格参数
    let styleParam: string | undefined;
    if (style) {
      styleParam = style;
    } else if (coverPromptTemplate) {
      // 如果有模板的风格提示词，使用它
      styleParam = coverPromptTemplate;
    } else if (stylePrompt) {
      // 截取风格提示词的前100字符作为风格描述
      styleParam = stylePrompt.substring(0, 100);
    }

    const result = await generateCoverPrompt(
      {
        apiUrl: effectiveApiUrl,
        apiKey: effectiveApiKey,
        modelName: effectiveModelName,
      },
      topic,
      styleParam
    );

    return NextResponse.json({
      code: 0,
      data: {
        prompt: result.prompt,
        negativePrompt: result.negativePrompt,
      },
    });
  } catch (error) {
    console.error("Error generating cover prompt:", error);
    return NextResponse.json(
      { code: 500, msg: error instanceof Error ? error.message : "服务器内部错误" },
      { status: 500 }
    );
  }
}
