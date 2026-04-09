/**
 * 环境配置校验工具
 *
 * 统一检查外部服务依赖的配置项，返回清晰的错误信息，
 * 引导用户前往正确的配置页面。
 */

import { NextResponse } from "next/server";
import { getDefaultApiConfig } from "./db";

// ─── 配置项清单（也用于生成文档） ───

export interface ConfigRequirement {
  key: string;
  label: string;
  category: "ai" | "platform";
  description: string;
  storage: "database" | "env";
  envVar?: string;
  setupPath: string;
}

export const CONFIG_REQUIREMENTS: ConfigRequirement[] = [
  {
    key: "ai_api",
    label: "AI API 配置",
    category: "ai",
    description: "OpenAI 兼容接口的 URL、Key 和模型名称，用于内容生成、标题生成、封面提示词等 AI 功能",
    storage: "database",
    setupPath: "/#settings",
  },
  {
    key: "xhs_api",
    label: "小红书采集 API Key",
    category: "platform",
    description: "小红书内容搜索与采集接口的密钥",
    storage: "env",
    envVar: "XHS_API_KEY",
    setupPath: "在 .env.local 中设置 XHS_API_KEY",
  },
  {
    key: "wx_api",
    label: "公众号采集 API Key",
    category: "platform",
    description: "微信公众号文章搜索与采集接口的密钥",
    storage: "env",
    envVar: "WX_API_KEY",
    setupPath: "在 .env.local 中设置 WX_API_KEY",
  },
];

// ─── 校验函数 ───

/**
 * 校验 AI API 配置（database 中的 api_configs 表）
 * 返回有效的配置，或包含清晰错误信息的 NextResponse
 */
export async function requireAIConfig(
  override?: { apiUrl?: string; apiKey?: string; modelName?: string }
): Promise<
  | { ok: true; apiUrl: string; apiKey: string; modelName?: string }
  | { ok: false; response: NextResponse }
> {
  // 优先使用请求级别的覆盖配置
  if (override?.apiUrl && override?.apiKey) {
    return { ok: true, apiUrl: override.apiUrl, apiKey: override.apiKey, modelName: override.modelName };
  }

  const dbConfig = await getDefaultApiConfig();
  const apiUrl = override?.apiUrl || dbConfig?.apiUrl;
  const apiKey = override?.apiKey || dbConfig?.apiKey;
  const modelName = override?.modelName || dbConfig?.modelName;

  if (!apiUrl || !apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 400,
          msg: "未配置 AI API。请在「监控设置」页面添加 API 配置（URL 和 Key），或设置环境变量 OPENAI_API_URL / OPENAI_API_KEY。",
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, apiUrl, apiKey, modelName };
}

/**
 * 校验小红书 API Key（环境变量）
 */
export function requireXhsKey(): { ok: true; key: string } | { ok: false; response: NextResponse } {
  const key = process.env.XHS_API_KEY;
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 400,
          msg: "未配置小红书 API Key。请在项目根目录的 .env.local 文件中设置 XHS_API_KEY。",
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, key };
}

/**
 * 校验公众号 API Key（环境变量）
 */
export function requireWxKey(): { ok: true; key: string } | { ok: false; response: NextResponse } {
  const key = process.env.WX_API_KEY;
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 400,
          msg: "未配置公众号 API Key。请在项目根目录的 .env.local 文件中设置 WX_API_KEY。",
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, key };
}
