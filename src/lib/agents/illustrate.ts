/**
 * 配图 Agent
 * 生成封面 prompt + 2~3 个插图 prompts
 * 调用 FAL API 实际生成图片
 */

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";

interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface IllustrationPrompts {
  coverPrompt: string;
  coverNegativePrompt: string;
  illustrationPrompts: Array<{ label: string; prompt: string; negativePrompt: string }>;
}

export interface IllustrationResult {
  coverUrl?: string;
  coverPrompt: string;
  illustrations: Array<{ label: string; url?: string; prompt: string }>;
}

const ILLUSTRATION_PROMPT_SYSTEM = `你是一位专业的AI绘图提示词工程师和内容配图策划师。

根据给定的选题和文章内容，你需要生成：
1. 一个封面图提示词（用于文章头图）
2. 2-3个插图提示词（用于文章中间段落配图）

要求：
- 封面图要醒目、有吸引力、能传达文章核心主题
- 插图要与文章关键段落内容相关，起到视觉补充作用
- 所有提示词用英文（AI绘图模型更好支持）
- 风格统一（同一种插画/摄影/设计风格）

请严格按以下 JSON 格式返回：
{
  "coverPrompt": "封面图正面提示词（英文）",
  "coverNegativePrompt": "封面图负面提示词（英文）",
  "illustrations": [
    { "label": "插图1的中文描述标签", "prompt": "插图1正面提示词（英文）", "negativePrompt": "插图1负面提示词（英文）" },
    { "label": "插图2的中文描述标签", "prompt": "插图2正面提示词（英文）", "negativePrompt": "插图2负面提示词（英文）" },
    { "label": "插图3的中文描述标签", "prompt": "插图3正面提示词（英文）", "negativePrompt": "插图3负面提示词（英文）" }
  ]
}

不要返回 JSON 以外的内容。`;

/**
 * Generate illustration prompts from topic and content
 */
export async function generateIllustrationPrompts(
  config: AIConfig,
  topic: string,
  content: string
): Promise<IllustrationPrompts> {
  const contentSummary = content.length > 3000 ? content.substring(0, 3000) + "..." : content;

  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: ILLUSTRATION_PROMPT_SYSTEM },
    { role: "user", content: `选题：${topic}\n\n文章内容：\n${contentSummary}` },
  ]);

  const result = parseJSON(raw) as IllustrationPrompts & { illustrations?: IllustrationPrompts["illustrationPrompts"] };
  return {
    coverPrompt: result.coverPrompt || "",
    coverNegativePrompt: result.coverNegativePrompt || "",
    illustrationPrompts: result.illustrationPrompts || result.illustrations || [],
  };
}

/**
 * Generate actual images via FAL API
 */
async function generateImageViaFAL(
  prompt: string,
  negativePrompt?: string
): Promise<string | undefined> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.warn("[illustrate] FAL_KEY not configured, skipping image generation");
    return undefined;
  }

  try {
    const response = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt || "",
        image_size: "landscape_16_9",
        num_images: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[illustrate] FAL API error: ${response.status} ${errorText}`);
      return undefined;
    }

    // FAL queue API returns a request_id, then we need to poll for result
    const queueResult = await response.json() as { request_id: string };
    if (!queueResult.request_id) {
      console.error("[illustrate] No request_id from FAL queue");
      return undefined;
    }

    // Poll for result (max 60 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/flux/schnell/requests/${queueResult.request_id}/status`,
        {
          headers: { "Authorization": `Key ${falKey}` },
        }
      );

      if (!statusResponse.ok) continue;
      const status = await statusResponse.json() as { status: string };

      if (status.status === "COMPLETED") {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/flux/schnell/requests/${queueResult.request_id}`,
          {
            headers: { "Authorization": `Key ${falKey}` },
          }
        );

        if (!resultResponse.ok) return undefined;
        const result = await resultResponse.json() as { images?: Array<{ url: string }> };
        return result.images?.[0]?.url;
      }

      if (status.status === "FAILED") {
        console.error("[illustrate] FAL generation failed");
        return undefined;
      }
    }

    console.error("[illustrate] FAL generation timed out");
    return undefined;
  } catch (error) {
    console.error("[illustrate] FAL API call failed:", error);
    return undefined;
  }
}

/**
 * Full illustration pipeline: generate prompts + actual images
 */
export async function generateIllustrations(
  config: AIConfig,
  topic: string,
  content: string
): Promise<IllustrationResult> {
  const prompts = await generateIllustrationPrompts(config, topic, content);

  // Generate cover image
  const coverUrl = await generateImageViaFAL(prompts.coverPrompt, prompts.coverNegativePrompt);

  // Generate illustration images
  const illustrations = await Promise.all(
    prompts.illustrationPrompts.map(async (ill) => {
      const url = await generateImageViaFAL(ill.prompt, ill.negativePrompt);
      return { label: ill.label, url, prompt: ill.prompt };
    })
  );

  return {
    coverUrl,
    coverPrompt: prompts.coverPrompt,
    illustrations,
  };
}
