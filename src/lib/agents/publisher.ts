/**
 * 多平台发布 Agent
 * 统一发布接口，支持微信公众号、小红书、抖音、B站等平台
 * 每个平台有独立适配器，当前仅微信为真实实现，其余为 Mock + 清晰适配器结构
 */

import type { Platform } from "@/lib/types";

export interface PublishContent {
  topic: string;
  content: string;
  coverPrompt?: string;
  coverUrl?: string;
  author?: string;
  extra?: Record<string, unknown>;
}

export interface PlatformPublishResult {
  platform: Platform;
  success: boolean;
  url?: string;
  mediaId?: string;
  error?: string;
}

export type PublishResults = PlatformPublishResult[];

interface WechatPublishParams {
  appId: string;
  appSecret: string;
}

// ==================== 平台适配器 ====================

interface PlatformAdapter {
  publish(content: PublishContent): Promise<PlatformPublishResult>;
}

/**
 * 微信公众号适配器（真实实现）
 */
class WechatAdapter implements PlatformAdapter {
  constructor(private params: WechatPublishParams) {}

  async publish(content: PublishContent): Promise<PlatformPublishResult> {
    try {
      const { fetchAccessToken, publishDraft, uploadImageMaterial } = await import("@/lib/wechat");
      const accessToken = await fetchAccessToken(this.params.appId, this.params.appSecret);

      // Upload cover image if available
      let thumbMediaId = "placeholder";
      if (content.coverUrl) {
        try {
          const uploadResult = await uploadImageMaterial(accessToken, content.coverUrl);
          thumbMediaId = uploadResult.media_id || "placeholder";
        } catch (e) {
          console.warn("[publisher/wechat] Cover upload failed:", e);
        }
      }

      const result = await publishDraft(accessToken, content.topic, content.content, thumbMediaId);
      if (result.errcode && result.errcode !== 0) {
        return {
          platform: "wx",
          success: false,
          error: `WeChat publish failed: ${result.errmsg}`,
        };
      }

      const mediaId = result.media_id || "";
      return {
        platform: "wx",
        success: true,
        url: mediaId ? `https://mp.weixin.qq.com/s/${mediaId}` : undefined,
        mediaId,
      };
    } catch (error) {
      return {
        platform: "wx",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 小红书适配器（Mock - 需要真实 API 后替换）
 */
class XhsAdapter implements PlatformAdapter {
  async publish(content: PublishContent): Promise<PlatformPublishResult> {
    console.log(`[publisher/xhs] Mock publish: topic="${content.topic}"`);
    // TODO: 接入小红书开放平台 API
    // 需要配置: XHS_APP_ID, XHS_APP_SECRET, OAuth 授权流程
    return {
      platform: "xhs",
      success: true,
      url: `https://xiaohongshu.com/mock/${Date.now()}`,
      error: "Mock implementation - not yet connected to XHS API",
    };
  }
}

/**
 * 抖音适配器（Mock - 需要真实 API 后替换）
 */
class DouyinAdapter implements PlatformAdapter {
  async publish(content: PublishContent): Promise<PlatformPublishResult> {
    console.log(`[publisher/douyin] Mock publish: topic="${content.topic}"`);
    // TODO: 接入抖音开放平台 API
    // 需要配置: DOUYIN_CLIENT_KEY, DOUYIN_CLIENT_SECRET, OAuth 授权流程
    return {
      platform: "dy",
      success: true,
      url: `https://douyin.com/mock/${Date.now()}`,
      error: "Mock implementation - not yet connected to Douyin API",
    };
  }
}

/**
 * B站适配器（Mock - 需要真实 API 后替换）
 */
class BilibiliAdapter implements PlatformAdapter {
  async publish(content: PublishContent): Promise<PlatformPublishResult> {
    console.log(`[publisher/bilibili] Mock publish: topic="${content.topic}"`);
    // TODO: 接入 B站创作者服务平台 API
    // 需要配置: BILIBILI_SESSDATA, BILIBILI_CSRF 等
    return {
      platform: "bilibili",
      success: true,
      url: `https://bilibili.com/mock/${Date.now()}`,
      error: "Mock implementation - not yet connected to Bilibili API",
    };
  }
}

/**
 * 微博适配器（Mock - 需要真实 API 后替换）
 */
class WeiboAdapter implements PlatformAdapter {
  async publish(content: PublishContent): Promise<PlatformPublishResult> {
    console.log(`[publisher/weibo] Mock publish: topic="${content.topic}"`);
    // TODO: 接入微博开放平台 API
    // 需要配置: WEIBO_APP_KEY, WEIBO_APP_SECRET, OAuth 授权流程
    return {
      platform: "weibo",
      success: true,
      url: `https://weibo.com/mock/${Date.now()}`,
      error: "Mock implementation - not yet connected to Weibo API",
    };
  }
}

// ==================== 适配器工厂 ====================

function getAdapter(platform: Platform): PlatformAdapter | null {
  switch (platform) {
    case "wx": {
      const appId = process.env.WECHAT_APP_ID;
      const appSecret = process.env.WECHAT_APP_SECRET;
      if (!appId || !appSecret) {
        console.warn("[publisher] WeChat not configured (missing WECHAT_APP_ID/WECHAT_APP_SECRET)");
        return null;
      }
      return new WechatAdapter({ appId, appSecret });
    }
    case "xhs":
      return new XhsAdapter();
    case "dy":
      return new DouyinAdapter();
    case "bilibili":
      return new BilibiliAdapter();
    case "weibo":
      return new WeiboAdapter();
    default:
      return null;
  }
}

// ==================== 统一发布接口 ====================

/**
 * 统一发布接口
 * @param platforms 目标平台列表
 * @param content 待发布内容
 * @returns 每个平台的发布结果
 */
export async function publishContent(
  platforms: Platform[],
  content: PublishContent
): Promise<PublishResults> {
  const results: PublishResults = [];

  for (const platform of platforms) {
    const adapter = getAdapter(platform);
    if (!adapter) {
      results.push({
        platform,
        success: false,
        error: `No adapter configured for platform: ${platform}`,
      });
      continue;
    }

    try {
      const result = await adapter.publish(content);
      results.push(result);
    } catch (error) {
      results.push({
        platform,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
