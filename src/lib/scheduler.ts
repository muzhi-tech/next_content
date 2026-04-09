/**
 * 定时采集调度器
 *
 * 基于 node-cron 的内存调度，随 Next.js 进程启动而初始化。
 * 调度触发时：获取分类下所有关键词 -> 逐平台采集 -> 记录日志 -> 可选 autoIngest。
 */

import cron, { type ScheduledTask } from "node-cron";
import {
  getScheduledCategories,
  getKeywords,
  saveArticles,
  createCollectionLog,
} from "./db";
import { requireXhsKey, requireWxKey } from "./config-check";
import { autoIngestTopArticles } from "./wiki-ingest";
import type { Article, Platform } from "./types";

// ─── interval → cron 表达式映射 ───

const INTERVAL_TO_CRON: Record<string, string> = {
  "30m": "*/30 * * * *",
  "1h": "0 * * * *",
  "2h": "0 */2 * * *",
  "6h": "0 */6 * * *",
  "12h": "0 */12 * * *",
  "24h": "0 0 * * *",
};

function toCronExpr(interval: string): string {
  return INTERVAL_TO_CRON[interval] || "0 * * * *";
}

// ─── 调度任务管理 ───

const activeTasks = new Map<string, ScheduledTask>();

/**
 * 初始化调度器：从 DB 加载所有已启用调度的分类，注册 cron 任务。
 */
export async function initScheduler(): Promise<void> {
  const categories = await getScheduledCategories();
  for (const cat of categories) {
    try {
      addSchedule(cat.id, cat.scheduleInterval || "1h", cat.autoIngest, cat.ingestTopN);
      console.log(`[scheduler] Registered category "${cat.name}" (${cat.id}) interval=${cat.scheduleInterval}`);
    } catch (err) {
      console.error(`[scheduler] Failed to register category "${cat.name}":`, err);
    }
  }
  console.log(`[scheduler] Initialized with ${activeTasks.size} active tasks`);
}

/**
 * 为一个分类添加调度任务。
 * 如果该分类已有任务，先移除旧的。
 */
export function addSchedule(
  categoryId: string,
  interval: string,
  autoIngest?: boolean,
  ingestTopN?: number,
): void {
  removeSchedule(categoryId);

  const cronExpr = toCronExpr(interval);

  if (!cron.validate(cronExpr)) {
    console.error(`[scheduler] Invalid cron expression "${cronExpr}" for interval "${interval}"`);
    return;
  }

  const task = cron.schedule(cronExpr, () => {
    runCollection(categoryId, autoIngest, ingestTopN).catch((err) => {
      console.error(`[scheduler] runCollection error for category ${categoryId}:`, err);
    });
  });

  activeTasks.set(categoryId, task);
}

/**
 * 移除一个分类的调度任务。
 */
export function removeSchedule(categoryId: string): void {
  const existing = activeTasks.get(categoryId);
  if (existing) {
    existing.stop();
    activeTasks.delete(categoryId);
  }
}

/**
 * 重新加载所有调度：停止全部任务，重新从 DB 读取。
 */
export async function reloadSchedules(): Promise<void> {
  // 停止所有现有任务
  activeTasks.forEach((task) => task.stop());
  activeTasks.clear();

  // 重新加载
  await initScheduler();
}

/**
 * 获取当前活跃任务数（用于调试/状态查询）。
 */
export function getActiveTaskCount(): number {
  return activeTasks.size;
}

/**
 * 测试专用：重置所有调度任务（清除模块级 singleton 状态）。
 */
export function _testResetScheduler(): void {
  activeTasks.forEach((task) => task.stop());
  activeTasks.clear();
}

// ─── 采集核心逻辑 ───

/**
 * 执行一个分类下所有关键词的平台采集。
 * 逻辑提取自 refresh/route.ts，使其可被 scheduler 复用。
 */
async function runCollection(
  categoryId: string,
  autoIngest?: boolean,
  ingestTopN?: number,
): Promise<void> {
  console.log(`[scheduler] Starting collection for category ${categoryId}`);

  const keywords = await getKeywords(categoryId);
  if (keywords.length === 0) {
    console.log(`[scheduler] No keywords in category ${categoryId}, skipping`);
    return;
  }

  for (const keyword of keywords) {
    const platforms = keyword.platforms || [];

    for (const platform of platforms) {
      const startedAt = Date.now();
      try {
        const articles = await collectForPlatform(keyword.name, keyword.id, platform);
        const { added } = await saveArticles(articles);

        await createCollectionLog({
          categoryId,
          keywordId: keyword.id,
          keywordName: keyword.name,
          platform,
          status: "success",
          articleCount: added,
          startedAt,
          completedAt: Date.now(),
        });

        console.log(`[scheduler] ${keyword.name}@${platform}: ${added} articles saved`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await createCollectionLog({
          categoryId,
          keywordId: keyword.id,
          keywordName: keyword.name,
          platform,
          status: "failed",
          articleCount: 0,
          errorMsg,
          startedAt,
          completedAt: Date.now(),
        });
        console.error(`[scheduler] ${keyword.name}@${platform} failed:`, errorMsg);
      }
    }
  }

  // Fire-and-forget auto-ingest
  if (autoIngest) {
    autoIngestTopArticles(categoryId, ingestTopN || 5).catch((err) => {
      console.error(`[scheduler] Auto-ingest error for category ${categoryId}:`, err);
    });
  }

  console.log(`[scheduler] Completed collection for category ${categoryId}`);
}

/**
 * 按平台采集文章（核心逻辑，从 refresh/route.ts 提取）。
 */
async function collectForPlatform(
  keywordName: string,
  keywordId: string,
  platform: string,
): Promise<Omit<Article, "id">[]> {
  if (platform === "xhs") {
    return collectXhs(keywordName, keywordId);
  } else if (platform === "wx") {
    return collectWx(keywordName, keywordId);
  }
  // 其他平台暂不支持
  return [];
}

async function collectXhs(
  keywordName: string,
  keywordId: string,
): Promise<Omit<Article, "id">[]> {
  const xhsKeyCheck = requireXhsKey();
  if (!xhsKeyCheck.ok) {
    throw new Error("未配置小红书 API Key");
  }

  const xhsResponse = await fetch("https://cn8n.com/p2/xhs/search_note_web", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${xhsKeyCheck.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: 9,
      keyword: keywordName,
      page: "1",
      sort: "comment_descending",
      note_type: "note",
      note_time: "day",
      searchId: "",
      sessionId: "",
    }),
  });

  const xhsData = await xhsResponse.json();
  const items = xhsData?.data?.items || [];

  return items
    .filter((item: any) => item.note)
    .map((item: any) => {
      const note = item.note;
      return {
        keywordId,
        keywordName,
        platform: "xhs" as Platform,
        title: note.title || "",
        content: note.desc || note.abstract_show || "",
        author: note.user?.nickname || "",
        authorAvatar: note.user?.images || "",
        url: `https://www.xiaohongshu.com/explore/${note.id}`,
        coverImage: note.images_list?.[0]?.url || "",
        likes: note.liked_count || 0,
        comments: note.comments_count || 0,
        shares: note.shared_count || 0,
        collectedAt: Date.now(),
        publishedAt: note.timestamp || Date.now(),
        isOriginal: note.tag_info?.title?.includes("原创") || false,
        extra: {
          noteId: note.id,
          collectedCount: note.collected_count || 0,
          userId: note.user?.userid || "",
        },
      };
    });
}

async function collectWx(
  keywordName: string,
  keywordId: string,
): Promise<Omit<Article, "id">[]> {
  const wxKeyCheck = requireWxKey();
  if (!wxKeyCheck.ok) {
    throw new Error("未配置公众号 API Key");
  }

  const wxResponse = await fetch("http://cn8n.com/p4/fbmain/monitor/v3/kw_search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${wxKeyCheck.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kw: keywordName,
      sort_type: 1,
      mode: 1,
      period: 7,
      page: 1,
      any_kw: "",
      ex_kw: "",
      verifycode: "",
      type: 1,
    }),
  });

  const wxData = await wxResponse.json();
  const items = wxData?.data?.data || [];

  return items.map((item: any) => ({
    keywordId,
    keywordName,
    platform: "wx" as Platform,
    title: item.title || "",
    content: item.content || "",
    author: item.wx_name || "",
    authorAvatar: item.avatar || "",
    url: item.url || item.short_link || "",
    likes: item.praise || 0,
    comments: item.read || 0,
    collectedAt: Date.now(),
    publishedAt: item.publish_time || Date.now(),
    isOriginal: item.is_original === 1,
    extra: {
      ghid: item.ghid,
      wxId: item.wx_id,
      looking: item.looking || 0,
    },
  }));
}
