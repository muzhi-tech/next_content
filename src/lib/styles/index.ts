/**
 * 写作风格模板导出
 */

import { techStyle } from "./tech";
import { businessStyle } from "./business";
import { lifestyleStyle } from "./lifestyle";
import { newsStyle } from "./news";

export interface WritingStyle {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export const STYLES: Record<string, WritingStyle> = {
  tech: techStyle,
  business: businessStyle,
  lifestyle: lifestyleStyle,
  news: newsStyle,
};

export const STYLE_LIST = Object.values(STYLES);

export function getStyle(id: string): WritingStyle | null {
  return STYLES[id] || null;
}

export function buildUserPrompt(
  style: WritingStyle,
  topic: string,
  keywords?: string[],
  length?: "short" | "medium" | "long"
): string {
  let prompt = style.userPromptTemplate
    .replace("{topic}", topic);

  // 添加长度说明
  if (length) {
    const lengthMap = {
      short: "（短文，500-800字）",
      medium: "（中等长度，1000-1500字）",
      long: "（长文，2000-2500字）",
    };
    prompt = prompt.replace("{length_section}", lengthMap[length] || "");
  } else {
    prompt = prompt.replace("{length_section}", "（中等长度）");
  }

  // 添加关键词
  if (keywords && keywords.length > 0) {
    prompt = prompt.replace(
      "{keywords_section}",
      `\n\n参考关键词：${keywords.join("、")}`
    );
  } else {
    prompt = prompt.replace("{keywords_section}", "");
  }

  return prompt;
}

export { techStyle, businessStyle, lifestyleStyle, newsStyle };
