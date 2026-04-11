/**
 * 风格基因提取 Agent
 * 分析采集文章的共性写作风格特征，生成 StyleProfile
 */

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";

interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface StyleProfile {
  guidelines: string;   // 写作风格指导原则
  samples: string;      // 风格样本（从原文章中提取的典型表达）
  constraints: string;  // 风格约束（应避免的模式）
}

const STYLE_EXTRACTOR_PROMPT = `你是一位专业的写作风格分析师。你需要从一组采集的文章中提取共性的写作风格特征。

请分析以下文章列表中展现出的共同风格模式，包括：
1. 语言风格（口语化程度、专业术语使用、流行语使用）
2. 叙事模式（如何引入话题、如何过渡、如何收尾）
3. 情感表达（是否有情绪化表达、自嘲、反问等）
4. 结构偏好（段落长度、是否使用列表、是否使用小标题）
5. 高频词汇和表达模式
6. 需要避免的风格特征（从文章中发现的反面模式）

请严格按以下 JSON 格式返回：
{
  "guidelines": "总结出的3-5条写作风格指导原则，每条一句话，用逗号分隔",
  "samples": "从文章中提取的3-5个最具代表性的风格表达片段，用 | 分隔",
  "constraints": "2-3条风格约束（应避免什么），每条一句话，用逗号分隔"
}

不要返回 JSON 以外的内容。`;

export async function extractStyleProfile(
  config: AIConfig,
  articles: Array<{ title: string; content: string; platform: string }>
): Promise<StyleProfile> {
  if (articles.length === 0) {
    return { guidelines: "", samples: "", constraints: "" };
  }

  const articlesText = articles
    .slice(0, 10)
    .map((a, i) => `[文章${i + 1}] 标题：${a.title}\n内容：${a.content.substring(0, 1500)}`)
    .join("\n\n");

  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: STYLE_EXTRACTOR_PROMPT },
    { role: "user", content: `请分析以下文章的共性写作风格：\n\n${articlesText}` },
  ]);

  const result = parseJSON(raw) as StyleProfile;
  return {
    guidelines: result.guidelines || "",
    samples: result.samples || "",
    constraints: result.constraints || "",
  };
}
