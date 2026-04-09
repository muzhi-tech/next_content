/**
 * 写作风格管理
 * 提供内置风格和用户自定义风格的统一接口
 */

interface StyleTemplate {
  name: string;
  icon: string;
  systemPrompt: string;
}

/**
 * 内置风格模板
 */
const BUILTIN_STYLES: Record<string, StyleTemplate> = {
  tech: {
    name: "科技评论",
    icon: "💻",
    systemPrompt: `你是一位资深的科技评论员，擅长深度分析科技产品和技术趋势。
写作特点：
1. 专业但不晦涩，善于用通俗语言解释复杂技术
2. 结构清晰，逻辑严密，论证充分
3. 观点鲜明，有自己独到的见解
4. 注重数据和事实支撑
5. 语言简洁有力，避免冗余`,
  },
  news: {
    name: "新闻报道",
    icon: "📰",
    systemPrompt: `你是一位专业的新媒体编辑，擅长写出吸引眼球的新闻报道。
写作特点：
1. 标题党但不标题党，善于用悬念和冲突吸引读者
2. 内容精炼，信息密度高
3. 善于使用小标题和列表提升可读性
4. 注重时效性和话题性`,
  },
  essay: {
    name: "随笔散文",
    icon: "📝",
    systemPrompt: `你是一位文笔优美的作家，擅长写随笔和散文。
写作特点：
1. 语言优美，情感细腻
2. 善于借景抒情，情景交融
3. 观点含蓄但深刻
4. 节奏舒缓，娓娓道来`,
  },
};

/**
 * 获取风格模板
 */
export function getStyle(nameOrId: string): StyleTemplate | null {
  // 先尝试内置风格
  if (BUILTIN_STYLES[nameOrId]) {
    return BUILTIN_STYLES[nameOrId];
  }
  // 预留：未来可以从账号空间的 Style 表查询
  return null;
}

/**
 * 构建用户提示词
 */
export function buildUserPrompt(
  style: StyleTemplate,
  topic: string,
  keywords?: string[],
  length?: string
): string {
  let prompt = `请以"${style.name}"的风格，围绕以下主题写一篇文章：\n\n主题：${topic}`;

  if (keywords && keywords.length > 0) {
    prompt += `\n\n关键词：${keywords.join("、")}`;
  }

  if (length) {
    prompt += `\n\n字数要求：${length}`;
  }

  prompt += `\n\n请确保文章：\n1. 标题吸引人\n2. 内容有价值、有深度\n3. 结构清晰\n4. 语言流畅`;

  return prompt;
}
