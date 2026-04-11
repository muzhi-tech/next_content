/**
 * 文章操作
 */

import type { Article, Platform } from "../types";
import { generateId } from "../utils";
import { getDB, rowToArticle } from "./shared";

export async function getArticles(options: {
  keywordId?: string;
  platform?: Platform;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ articles: Article[]; total: number }> {
  const db = getDB();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.keywordId) {
    conditions.push("a.keywordId = ?");
    params.push(options.keywordId);
  }
  if (options.platform) {
    conditions.push("a.platform = ?");
    params.push(options.platform);
  }
  if (options.categoryId) {
    conditions.push("a.keywordId IN (SELECT id FROM keywords WHERE categoryId = ?)");
    params.push(options.categoryId);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const total = (db.prepare(`SELECT COUNT(*) as count FROM articles a ${where}`).get(params) as { count: number }).count;

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT a.* FROM articles a ${where} ORDER BY a.collectedAt DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { articles: rows.map((r) => rowToArticle(r as Record<string, unknown>)), total };
}

export async function saveArticle(article: Omit<Article, "id">): Promise<Article> {
  const db = getDB();
  const existing = db.prepare(
    "SELECT * FROM articles WHERE platform = ? AND url = ?"
  ).get(article.platform, article.url) as Record<string, unknown> | undefined;

  if (existing) {
    db.prepare(
      `UPDATE articles SET keywordId=?, keywordName=?, title=?, content=?, author=?, authorAvatar=?,
       coverImage=?, likes=?, comments=?, shares=?, collectedAt=?, publishedAt=?, isOriginal=?, extra=?
       WHERE id=?`
    ).run(
      article.keywordId, article.keywordName, article.title, article.content, article.author, article.authorAvatar,
      article.coverImage, article.likes, article.comments, article.shares, article.collectedAt, article.publishedAt,
      article.isOriginal ? 1 : 0, JSON.stringify(article.extra || {}), existing.id
    );
    return rowToArticle({ ...existing, ...article, id: existing.id });
  }

  const id = generateId();
  db.prepare(
    `INSERT INTO articles (id, keywordId, keywordName, platform, title, content, author, authorAvatar, url, coverImage, likes, comments, shares, collectedAt, publishedAt, isOriginal, extra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, article.keywordId, article.keywordName, article.platform, article.title, article.content, article.author,
    article.authorAvatar, article.url, article.coverImage, article.likes, article.comments, article.shares,
    article.collectedAt, article.publishedAt, article.isOriginal ? 1 : 0, JSON.stringify(article.extra || {})
  );
  return { ...article, id };
}

export async function saveArticles(
  articles: Omit<Article, "id">[]
): Promise<{ added: number; updated: number }> {
  let added = 0;
  for (const article of articles) {
    await saveArticle(article);
    added++;
  }
  return { added, updated: 0 };
}

export async function deleteArticlesByKeyword(keywordId: string): Promise<void> {
  const db = getDB();
  db.prepare("DELETE FROM articles WHERE keywordId = ?").run(keywordId);
}
