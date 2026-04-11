/**
 * 采集日志 + 数据分析查询
 */

import type { CollectionLog, CollectionLogStatus, PipelineRun } from "../types";
import { generateId } from "../utils";
import { getDB, rowToCollectionLog, rowToPipelineRun } from "./shared";

// ============ Collection Logs ============

export async function getCollectionLogs(options: {
  categoryId?: string;
  limit?: number;
}): Promise<CollectionLog[]> {
  const db = getDB();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.categoryId) {
    conditions.push("categoryId = ?");
    params.push(options.categoryId);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const limit = options.limit || 50;
  params.push(limit);

  return db.prepare(
    `SELECT * FROM collection_logs ${where} ORDER BY startedAt DESC LIMIT ?`
  ).all(...params).map((r) => rowToCollectionLog(r as Record<string, unknown>));
}

export async function createCollectionLog(data: {
  categoryId?: string;
  keywordId?: string;
  keywordName?: string;
  platform: string;
  status: CollectionLogStatus;
  articleCount: number;
  errorMsg?: string;
  startedAt: number;
  completedAt?: number;
}): Promise<CollectionLog> {
  const db = getDB();
  const id = generateId();
  db.prepare(
    `INSERT INTO collection_logs (id, categoryId, keywordId, keywordName, platform, status, articleCount, errorMsg, startedAt, completedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.categoryId || '', data.keywordId || '', data.keywordName || '', data.platform,
    data.status, data.articleCount, data.errorMsg || '', data.startedAt, data.completedAt || null);
  return { id, ...data };
}

// ============ Analytics ============

export async function getDashboardArticleStats(): Promise<{ total: number; weekly: number }> {
  const db = getDB();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const result = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN collectedAt > ? THEN 1 ELSE 0 END), 0) as weekly
    FROM articles
  `).get(sevenDaysAgo) as { total: number; weekly: number };
  return { total: result.total, weekly: result.weekly };
}

export async function getPlatformDistribution(): Promise<{ platform: string; count: number }[]> {
  const db = getDB();
  return db.prepare(`
    SELECT platform, COUNT(*) as count
    FROM articles
    GROUP BY platform
    ORDER BY count DESC
  `).all() as { platform: string; count: number }[];
}

export async function getCollectionTrend(): Promise<{ date: string; count: number }[]> {
  const db = getDB();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return db.prepare(`
    SELECT
      date(startedAt / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM collection_logs
    WHERE startedAt > ?
    GROUP BY date
    ORDER BY date ASC
  `).all(sevenDaysAgo) as { date: string; count: number }[];
}

export async function getGeneratedContentStats(): Promise<{
  total: number;
  byStatus: { status: string; count: number }[];
}> {
  const db = getDB();
  const total = (db.prepare(`SELECT COUNT(*) as total FROM generated_contents`).get() as { total: number }).total;
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM generated_contents
    GROUP BY status
  `).all() as { status: string; count: number }[];
  return { total, byStatus };
}

export async function getTopKeywords(limit: number = 10): Promise<{
  keywordId: string;
  keywordName: string;
  articleCount: number;
}[]> {
  const db = getDB();
  return db.prepare(`
    SELECT k.id as keywordId, k.name as keywordName, COUNT(a.id) as articleCount
    FROM keywords k
    LEFT JOIN articles a ON a.keywordId = k.id
    GROUP BY k.id
    ORDER BY articleCount DESC
    LIMIT ?
  `).all(limit) as { keywordId: string; keywordName: string; articleCount: number }[];
}

export async function getActivePipelineRun(): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare(`
    SELECT * FROM pipeline_runs
    WHERE status = 'running'
    ORDER BY createdAt DESC
    LIMIT 1
  `).get();
  return row ? rowToPipelineRun(row as Record<string, unknown>) : null;
}
