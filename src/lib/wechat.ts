export interface WechatConfig {
  appId: string;
  appSecret: string;
}

export interface AccessTokenResponse {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
}

export interface UploadResponse {
  media_id: string;
  url: string;
  errcode?: number;
  errmsg?: string;
}

export interface PublishResponse {
  media_id?: string;
  errcode?: number;
  errmsg?: string;
}

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const DRAFT_URL = "https://api.weixin.qq.com/cgi-bin/draft/add";

export async function fetchAccessToken(appId: string, appSecret: string): Promise<string> {
  const url = `${TOKEN_URL}?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch access token: ${res.status}`);
  }
  const data = (await res.json()) as AccessTokenResponse;
  if (data.errcode) {
    throw new Error(`Access token error ${data.errcode}: ${data.errmsg}`);
  }
  if (!data.access_token) {
    throw new Error("No access_token in response");
  }
  return data.access_token;
}

export async function publishDraft(
  accessToken: string,
  title: string,
  content: string,
  thumbMediaId: string = "dummy_media_id" // In a real scenario, you'd upload the cover image first
): Promise<PublishResponse> {
  const payload = {
    articles: [
      {
        title,
        content,
        thumb_media_id: thumbMediaId,
        need_open_comment: 1,
        only_fans_can_comment: 0,
      },
    ],
  };

  const url = `${DRAFT_URL}?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as PublishResponse;
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Publish draft failed ${data.errcode}: ${data.errmsg}`);
  }

  return data;
}

/**
 * 上传永久图片素材（用于图文消息中的图片）
 * 文档: https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/New_Permanent_Materials.html
 */
export async function uploadImageMaterial(
  accessToken: string,
  imageUrl: string
): Promise<{ media_id?: string; url?: string; errcode?: number; errmsg?: string }> {
  // Fetch image from URL
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image from ${imageUrl}: ${imageRes.status}`);
  }
  const imageBuffer = await imageRes.arrayBuffer();

  // Upload to WeChat
  const formData = new FormData();
  formData.append("media", new Blob([imageBuffer]), "image.jpg");

  const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Upload image failed ${data.errcode}: ${data.errmsg}`);
  }

  return data;
}

/**
 * 贴图草稿文章项
 */
export interface StickerArticle {
  title: string;           // 子文章标题
  content: string;         // HTML 内容（可包含多张图片）
  thumbMediaId?: string;   // 封面图 media_id（可选，第一篇必填）
  author?: string;         // 作者
  needOpenComment?: number; // 是否开启留言（默认 1）
  onlyFansCanComment?: number; // 是否仅粉丝留言（默认 0）
}

/**
 * 发布贴图草稿（多图文消息）
 * 将多张图片和文案组装成图文消息草稿
 */
export async function publishStickerDraft(
  accessToken: string,
  articles: StickerArticle[]
): Promise<{ media_id?: string; errcode?: number; errmsg?: string }> {
  const payload = {
    articles: articles.map((article) => ({
      title: article.title,
      content: article.content,
      thumb_media_id: article.thumbMediaId || "",
      author: article.author || "",
      need_open_comment: article.needOpenComment ?? 1,
      only_fans_can_comment: article.onlyFansCanComment ?? 0,
    })),
  };

  const url = `${DRAFT_URL}?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Publish sticker draft failed ${data.errcode}: ${data.errmsg}`);
  }

  return data;
}
