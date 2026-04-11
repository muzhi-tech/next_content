/**
 * 生成内容（GeneratedContent）操作
 */

import type { GeneratedContent, ContentStatus, ContentSourceType } from "../types";
import { generateId } from "../utils";
import { getDB, rowToGeneratedContent } from "./shared";

export async function getGeneratedContents(options: {
  categoryId?: string;
  status?: ContentStatus;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ items: GeneratedContent[]; total: number }> {
  const db = getDB();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.categoryId) {
    conditions.push("categoryId = ?");
    params.push(options.categoryId);
  }
  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }
  if (options.search) {
    conditions.push("topic LIKE ?");
    params.push(`%${options.search}%`);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const total = (db.prepare(`SELECT COUNT(*) as count FROM generated_contents ${where}`).get(params) as { count: number }).count;

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT * FROM generated_contents ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { items: rows.map((r) => rowToGeneratedContent(r as Record<string, unknown>)), total };
}

export async function getGeneratedContent(id: string): Promise<GeneratedContent | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM generated_contents WHERE id = ?").get(id);
  return row ? rowToGeneratedContent(row as Record<string, unknown>) : null;
}

export async function createGeneratedContent(data: {
  categoryId?: string;
  topic: string;
  content: string;
  style?: string;
  personaId?: string;
  status?: ContentStatus;
  wikiContext?: string;
  titles?: string;
  coverPrompt?: string;
  sourceType?: ContentSourceType;
}): Promise<GeneratedContent> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO generated_contents (id, categoryId, topic, content, style, personaId, status, wikiContext, titles, coverPrompt, sourceType, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.categoryId || '', data.topic, data.content, data.style || '', data.personaId || '',
    data.status || 'draft', data.wikiContext || '', data.titles || '', data.coverPrompt || '',
    data.sourceType || 'manual', now, now);
  return { id, categoryId: data.categoryId, topic: data.topic, content: data.content, style: data.style, personaId: data.personaId, status: data.status || 'draft', wikiContext: data.wikiContext, titles: data.titles, coverPrompt: data.coverPrompt, sourceType: data.sourceType || 'manual', createdAt: now, updatedAt: now };
}

export async function updateGeneratedContent(
  id: string, data: Partial<{
    topic: string; content: string; style: string; personaId: string;
    status: ContentStatus; wikiContext: string; titles: string; coverPrompt: string;
  }>
): Promise<GeneratedContent | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM generated_contents WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const updatedAt = Date.now();
  const fields: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = v;
  }
  db.prepare(
    "UPDATE generated_contents SET topic=?, content=?, style=?, personaId=?, status=?, wikiContext=?, titles=?, coverPrompt=?, updatedAt=? WHERE id=?"
  ).run(fields.topic, fields.content, fields.style, fields.personaId, fields.status,
    fields.wikiContext, fields.titles, fields.coverPrompt, updatedAt, id);
  return rowToGeneratedContent({ ...fields, updatedAt });
}

export async function deleteGeneratedContent(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM generated_contents WHERE id = ?").run(id).changes > 0;
}
