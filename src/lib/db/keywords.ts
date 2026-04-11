/**
 * 关键词操作
 */

import type { Keyword, Platform } from "../types";
import { generateId } from "../utils";
import { getDB, rowToKeyword } from "./shared";

export async function getKeywords(categoryId?: string): Promise<Keyword[]> {
  const db = getDB();
  if (categoryId) {
    return db.prepare("SELECT * FROM keywords WHERE categoryId = ?").all(categoryId).map((r) => rowToKeyword(r as Record<string, unknown>));
  }
  return db.prepare("SELECT * FROM keywords").all().map((r) => rowToKeyword(r as Record<string, unknown>));
}

export async function getKeyword(id: string): Promise<Keyword | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM keywords WHERE id = ?").get(id);
  return row ? rowToKeyword(row as Record<string, unknown>) : null;
}

export async function createKeyword(data: {
  name: string;
  platforms: Platform[];
  categoryId: string;
}): Promise<Keyword> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO keywords (id, name, platforms, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, data.name, JSON.stringify(data.platforms), data.categoryId, now, now);
  return { id, name: data.name, platforms: data.platforms, categoryId: data.categoryId, createdAt: now, updatedAt: now };
}

export async function updateKeyword(
  id: string,
  data: Partial<{ name: string; platforms: Platform[] }>
): Promise<Keyword | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM keywords WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const name = data.name !== undefined ? data.name : (existing.name as string);
  const platforms = data.platforms !== undefined ? data.platforms : JSON.parse((existing.platforms as string) || '[]');
  const updatedAt = Date.now();

  db.prepare(
    "UPDATE keywords SET name = ?, platforms = ?, updatedAt = ? WHERE id = ?"
  ).run(name, JSON.stringify(platforms), updatedAt, id);

  return { id, name, platforms, categoryId: existing.categoryId as string, createdAt: existing.createdAt as number, updatedAt };
}

export async function deleteKeyword(id: string): Promise<boolean> {
  const db = getDB();
  const result = db.prepare("DELETE FROM keywords WHERE id = ?").run(id);
  return result.changes > 0;
}
