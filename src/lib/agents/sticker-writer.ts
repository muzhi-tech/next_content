/**
 * 贴图短文案 Agent
 * 将采集到的爆款长笔记提炼为结构化 JSON，用于图文帖子的分项展示
 */

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import type { StickerSlide } from "@/lib/types";

interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface StickerOutput {
  title: string;     // 封面大标题（极具吸引力）
  slides: StickerSlide[];  // 3-8 个分项
  caption: string;   // 底部配套短文案（含吐槽/钩子问题）
}

const STICKER_SYSTEM_PROMPT = `你是一位精通「数字生命卡兹克（Khazix）」风格的图文创作者。你的任务是将爆款长文/笔记提炼成适合图文帖（小红书风格）的结构化短文案。

【核心原则】
1. 口语化：像跟朋友聊天，拒绝教科书腔
2. 极具吸引力：标题要让人"哇"一声、忍不住想看完
3. 互动钩子：结尾要有槽点或问题，让网友忍不住评论
4. 简洁有力：每个分项控制在20字以内

【输出格式 - 必须严格按以下JSON格式返回】
{
  "title": "封面大标题（10-20字，极具冲击力）",
  "slides": [
    {"heading": "副标题1", "content": "一句话核心观点1"},
    {"heading": "副标题2", "content": "一句话核心观点2"},
    {"heading": "副标题3", "content": "一句话核心观点3"}
    // 共3-8个分项
  ],
  "caption": "底部配套短文案（含吐槽/钩子问题，引导互动）"
}

【禁止事项】
- 不要用"首先、其次、最后"这种结构
- 不要用冒号、破折号
- 不要过度煽情或标题党
- slides 的 content 不要超过20字

请严格按JSON格式返回，不要返回任何其他内容。`;

export async function generateStickerContent(
  config: AIConfig,
  sourceContent: string
): Promise<StickerOutput> {
  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: STICKER_SYSTEM_PROMPT },
    {
      role: "user",
      content: `请将以下爆款内容提炼为图文帖短文案：\n\n${sourceContent}`,
    },
  ]);

  let result: StickerOutput;
  try {
    result = parseJSON(raw) as StickerOutput;
  } catch (parseError) {
    // If JSON parsing fails, return a fallback structure
    console.error("[sticker-writer] JSON parse error:", parseError);
    return {
      title: "未知标题",
      slides: [],
      caption: "",
    };
  }

  // Validate and sanitize output
  return {
    title: result.title || "未知标题",
    slides: Array.isArray(result.slides) && result.slides.length >= 3 && result.slides.length <= 8
      ? result.slides.map((s) => ({
          heading: s.heading || "",
          content: s.content || "",
        }))
      : [],
    caption: result.caption || "",
  };
}
