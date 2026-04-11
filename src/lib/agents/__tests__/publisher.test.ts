import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock wechat module
vi.mock(import("@/lib/wechat"), () => ({
  fetchAccessToken: vi.fn(),
  publishDraft: vi.fn(),
  uploadImageMaterial: vi.fn(),
}));

import { publishContent } from "../publisher";
import type { PublishContent } from "../publisher";
import { fetchAccessToken, publishDraft, uploadImageMaterial } from "@/lib/wechat";

const mockContent: PublishContent = {
  topic: "Test Topic",
  content: "Test content body",
  coverUrl: "https://example.com/cover.jpg",
  author: "Test Author",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publishContent", () => {
  it("returns empty results for empty platform list", async () => {
    const result = await publishContent([], mockContent);
    expect(result).toEqual([]);
  });

  it("publishes to mock platforms (xhs, dy, bilibili, weibo) successfully", async () => {
    const result = await publishContent(["xhs", "dy", "bilibili", "weibo"], mockContent);
    expect(result).toHaveLength(4);
    expect(result[0].platform).toBe("xhs");
    expect(result[0].success).toBe(true);
    expect(result[1].platform).toBe("dy");
    expect(result[1].success).toBe(true);
    expect(result[2].platform).toBe("bilibili");
    expect(result[2].success).toBe(true);
    expect(result[3].platform).toBe("weibo");
    expect(result[3].success).toBe(true);
  });

  it("publishes to WeChat when credentials are configured", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    (fetchAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("test-token");
    (uploadImageMaterial as ReturnType<typeof vi.fn>).mockResolvedValue({ media_id: "thumb-123" });
    (publishDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
      errcode: 0,
      media_id: "media-456",
    });

    const result = await publishContent(["wx"], mockContent);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("wx");
    expect(result[0].success).toBe(true);
    expect(result[0].mediaId).toBe("media-456");
    expect(result[0].url).toBe("https://mp.weixin.qq.com/s/media-456");

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });

  it("returns failure when WeChat credentials are not configured", async () => {
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;

    const result = await publishContent(["wx"], mockContent);
    expect(result).toHaveLength(1);
    expect(result[0].success).toBe(false);
    expect(result[0].error).toContain("No adapter configured");
  });

  it("handles WeChat publish API error", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    (fetchAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("test-token");
    (publishDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
      errcode: 40001,
      errmsg: "invalid credential",
    });

    const result = await publishContent(["wx"], mockContent);
    expect(result[0].success).toBe(false);
    expect(result[0].error).toContain("WeChat publish failed");

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });

  it("handles WeChat fetchAccessToken exception", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    (fetchAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error")
    );

    const result = await publishContent(["wx"], mockContent);
    expect(result[0].success).toBe(false);
    expect(result[0].error).toBe("Network error");

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });

  it("publishes to multiple platforms independently", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    (fetchAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("token");
    (uploadImageMaterial as ReturnType<typeof vi.fn>).mockResolvedValue({ media_id: "thumb" });
    (publishDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
      errcode: 0,
      media_id: "media-1",
    });

    const result = await publishContent(["wx", "xhs", "dy"], mockContent);
    expect(result).toHaveLength(3);
    expect(result[0].success).toBe(true); // wx
    expect(result[1].success).toBe(true); // xhs
    expect(result[2].success).toBe(true); // dy

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });

  it("partial platform failure does not affect others", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    // WeChat fails, but other platforms succeed
    (fetchAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Auth failed"));

    const result = await publishContent(["wx", "xhs"], mockContent);
    expect(result).toHaveLength(2);
    expect(result[0].success).toBe(false); // wx failed
    expect(result[0].error).toBe("Auth failed");
    expect(result[1].success).toBe(true); // xhs succeeded

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });

  it("returns failure for unknown platform", async () => {
    const result = await publishContent(["unknown" as any], mockContent);
    expect(result).toHaveLength(1);
    expect(result[0].success).toBe(false);
    expect(result[0].error).toContain("No adapter configured");
  });

  it("WeChat publish works without coverUrl", async () => {
    process.env.WECHAT_APP_ID = "test-app-id";
    process.env.WECHAT_APP_SECRET = "test-app-secret";

    (fetchAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("token");
    (publishDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
      errcode: 0,
      media_id: "media-no-cover",
    });

    const contentNoCover = { ...mockContent, coverUrl: undefined };
    const result = await publishContent(["wx"], contentNoCover);
    expect(result[0].success).toBe(true);
    // uploadImageMaterial should not be called since coverUrl is undefined
    expect(uploadImageMaterial).not.toHaveBeenCalled();

    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_APP_SECRET;
  });
});
