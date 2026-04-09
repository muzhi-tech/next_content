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
