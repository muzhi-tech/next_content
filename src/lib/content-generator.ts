/**
 * 内容生成核心逻辑
 * 封装 AI API 调用，支持 OpenAI 兼容接口
 */

// 默认配置（可以从环境变量读取）
const DEFAULT_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

/**
 * 构建 API 端点
 */
function buildEndpoint(apiUrl: string, defaultPath: string): string {
  const base = apiUrl.replace(/\/+$/, "");

  // Already a known full endpoint path
  if (base.includes("/chat/completions") || base.includes("/images/generations")) {
    return base;
  }

  // Ends with a version prefix like /v1, /v4, /v1beta etc.
  if (/\/v\d+(?:beta|alpha)?$/.test(base)) {
    return `${base}${defaultPath}`;
  }

  // Bare domain
  if (!base.includes("/") || /^https?:\/\/[^/]+$/.test(base)) {
    return `${base}/v1${defaultPath}`;
  }

  // Has a path but doesn't match known pattern
  return base;
}

/**
 * 流式聊天完成
 */
export async function createChatCompletionStream(
  config: AIConfig,
  messages: { role: string; content: string }[],
  onChunk: (content: string) => void
): Promise<void> {
  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
  const modelName = config.modelName || DEFAULT_MODEL;

  const url = buildEndpoint(apiUrl, "/chat/completions");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API Error (${response.status}) [${url}]: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch (_) {
          // Ignore parse errors for incomplete chunks
        }
      }
    }
  }
}

/**
 * 非流式聊天完成（返回完整内容）
 */
export async function createChatCompletionJSON(
  config: AIConfig,
  messages: { role: string; content: string }[]
): Promise<string> {
  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
  const modelName = config.modelName || DEFAULT_MODEL;

  const url = buildEndpoint(apiUrl, "/chat/completions");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API Error (${response.status}) [${url}]: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 解析 JSON（处理 Markdown 代码块和尾部逗号）
 */
export function parseJSON(raw: string): unknown {
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  // Extract the JSON structure
  const match = text.match(/[\[{][\s\S]*[\]}]/);
  if (!match) throw new Error("未找到有效的 JSON 结构");
  let jsonStr = match[0];

  // Remove trailing commas
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");

  // Quick try
  try {
    return JSON.parse(jsonStr);
  } catch (_) {
    // Continue to fix unescaped chars
  }

  // State-machine: fix unescaped chars inside strings
  let fixed = "";
  let inStr = false;
  let esc = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];

    if (esc) {
      fixed += ch;
      esc = false;
      continue;
    }

    if (ch === "\\" && inStr) {
      fixed += ch;
      esc = true;
      continue;
    }

    if (ch === '"') {
      inStr = !inStr;
      fixed += ch;
      continue;
    }

    if (inStr) {
      if (ch === "\n") {
        fixed += "\\n";
      } else if (ch === "\r") {
        fixed += "\\r";
      } else if (ch === "\t") {
        fixed += "\\t";
      } else {
        fixed += ch;
      }
    } else {
      fixed += ch;
    }
  }

  try {
    return JSON.parse(fixed);
  } catch (_) {
    throw new Error(`JSON 解析失败。原始返回前200字符: ${text.substring(0, 200)}`);
  }
}

/**
 * 封面图提示词生成
 */
export async function generateCoverPrompt(
  config: AIConfig,
  topic: string,
  style?: string
): Promise<{ prompt: string; negativePrompt: string }> {
  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
  const modelName = config.modelName || DEFAULT_MODEL;

  const systemPrompt = `你是一位专业的AI绘图提示词工程师，擅长为文章封面生成吸引人的AI绘图提示词。

请根据主题生成适合的AI绘图提示词。

要求：
1. 正面提示词要具体、吸引人，包含主体、场景、风格等元素
2. 负面提示词要避免常见的AI绘图问题
3. 使用英文提示词（AI绘图模型更支持英文）

请严格按以下JSON格式返回，不要返回任何其他内容：
{
  "prompt": "正面提示词（英文）",
  "negativePrompt": "负面提示词（英文）"
}`;

  const userPrompt = `文章主题：${topic}${style ? `\n风格：${style}` : ""}`;

  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const result = parseJSON(raw) as { prompt: string; negativePrompt: string };
  return {
    prompt: result.prompt || "",
    negativePrompt: result.negativePrompt || "",
  };
}
