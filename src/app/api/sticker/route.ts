/**
 * POST /api/sticker  — 发布贴图草稿到微信
 *
 * 请求体:
 * {
 *   "title": "封面大标题",
 *   "slides": [{"heading": "副标题", "content": "内容"}],
 *   "caption": "底部短文案",
 *   "imageUrls": ["https://example.com/image1.jpg", ...],  // 可选，前端渲染的图片
 *   "author": "作者名"  // 可选
 * }
 *
 * 响应:
 * {
 *   "code": 0,
 *   "msg": "发布成功",
 *   "data": {
 *     "mediaId": "xxx",
 *     "url": "https://mp.weixin.qq.com/s/xxx"
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchAccessToken, uploadImageMaterial, publishStickerDraft } from "@/lib/wechat";
import { createStickerContent, updateStickerContent } from "@/lib/db";
import type { StickerSlide } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StickerPublishRequest {
  title: string;
  slides: StickerSlide[];
  caption: string;
  imageUrls?: string[];
  author?: string;
}

/**
 * HTML 转义，防止 XSS 攻击
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

function buildStickerHtml(title: string, content: string, imageUrl?: string): string {
  const safeTitle = escapeHtml(title);
  const safeContent = escapeHtml(content);

  let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 675px; margin: 0 auto; padding: 20px 16px; background: #fff; box-sizing: border-box;">`;

  if (imageUrl) {
    // Only add image if it's a valid URL
    const safeUrl = escapeHtml(imageUrl);
    html += `<img src="${safeUrl}" style="width: 100%; max-width: 675px; border-radius: 8px; margin-bottom: 16px; display: block;" />`;
  }

  html += `<h2 style="font-size: 22px; font-weight: bold; color: #1a1a1a; margin: 0 0 12px 0; line-height: 1.4;">${safeTitle}</h2>`;
  html += `<p style="font-size: 16px; color: #333; line-height: 1.8; margin: 0;">${safeContent}</p>`;
  html += `</div>`;

  return html;
}

export async function POST(request: NextRequest) {
  // 检查环境变量
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      {
        code: 400,
        msg: "未配置微信公众号 AppID/AppSecret，请设置环境变量 WECHAT_APP_ID 和 WECHAT_APP_SECRET",
        data: null,
      },
      { status: 400 }
    );
  }

  // 解析请求体
  let body: StickerPublishRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 400, msg: "无效的请求体", data: null },
      { status: 400 }
    );
  }

  const { title, slides, caption, imageUrls, author } = body;

  // 参数验证
  if (!title || typeof title !== "string") {
    return NextResponse.json(
      { code: 400, msg: "缺少标题 title", data: null },
      { status: 400 }
    );
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json(
      { code: 400, msg: "缺少 slides 或 slides 为空数组", data: null },
      { status: 400 }
    );
  }

  if (!caption || typeof caption !== "string") {
    return NextResponse.json(
      { code: 400, msg: "缺少 caption 底部短文案", data: null },
      { status: 400 }
    );
  }

  try {
    // 1. 获取 access_token
    const accessToken = await fetchAccessToken(appId, appSecret);

    // 2. 上传图片素材（如果有 imageUrls）
    const uploadedImageIds: string[] = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        try {
          const uploadResult = await uploadImageMaterial(accessToken, imageUrl);
          if (uploadResult.media_id) {
            uploadedImageIds.push(uploadResult.media_id);
          }
        } catch (uploadError) {
          console.error(`Failed to upload image ${imageUrl}:`, uploadError);
          // 继续处理，不中断流程
        }
      }
    }

    // 3. 构建多图文内容
    const articles = [];

    // 第一篇：封面文章（标题 + 全部 slides 的摘要）
    const coverContent = slides
      .map((s, i) => `<p style="font-size:15px;color:#555;margin:8px 0;">📌 ${s.heading}: ${s.content}</p>`)
      .join("");

    articles.push({
      title,
      content: buildStickerHtml(title, coverContent, imageUrls?.[0]),
      thumbMediaId: uploadedImageIds[0] || undefined,
      author: author || "",
      needOpenComment: 1,
      onlyFansCanComment: 0,
    });

    // 中间文章：每个 slide 一篇
    for (let i = 1; i < slides.length; i++) {
      const slide = slides[i - 1];
      const slideContent = `<p style="font-size:16px;color:#333;line-height:1.8;">${slide.content}</p>`;
      articles.push({
        title: slide.heading,
        content: buildStickerHtml(slide.heading, slideContent, imageUrls?.[i]),
        thumbMediaId: uploadedImageIds[i] || undefined,
        author: author || "",
        needOpenComment: 1,
        onlyFansCanComment: 0,
      });
    }

    // 最后一篇：底部 caption
    articles.push({
      title: "👇 点击查看更多",
      content: buildStickerHtml("互动话题", `<p style="font-size:16px;color:#333;line-height:1.8;">${caption}</p>`),
      thumbMediaId: uploadedImageIds[slides.length] || undefined,
      author: author || "",
      needOpenComment: 1,
      onlyFansCanComment: 0,
    });

    // 4. 发布贴图草稿
    const result = await publishStickerDraft(accessToken, articles);

    if (result.errcode && result.errcode !== 0) {
      throw new Error(`发布失败: ${result.errmsg}`);
    }

    const mediaId = result.media_id || "";
    const wxUrl = mediaId ? `https://mp.weixin.qq.com/s/${mediaId}` : undefined;

    // 5. 保存贴图内容到数据库
    let stickerId = "";
    try {
      const sticker = await createStickerContent({
        title,
        slides,
        caption,
        status: "published",
        categoryId: "", // 前端可以通过 query 参数传入
      });
      stickerId = sticker.id;

      // 更新 wxMediaId 和 wxUrl
      if (stickerId && mediaId) {
        await updateStickerContent(stickerId, {
          wxMediaId: mediaId,
          wxUrl,
        });
      }
    } catch (dbError) {
      console.error("Failed to save sticker content to database:", dbError);
      // 不阻断发布流程，仅记录错误
    }

    return NextResponse.json({
      code: 0,
      msg: "贴图草稿发布成功",
      data: {
        mediaId,
        url: wxUrl,
        stickerId,
      },
    });
  } catch (error) {
    console.error("Sticker publish error:", error);
    return NextResponse.json(
      {
        code: 500,
        msg: error instanceof Error ? error.message : "贴图草稿发布失败",
        data: null,
      },
      { status: 500 }
    );
  }
}
