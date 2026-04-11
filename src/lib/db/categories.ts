/**
 * 分类操作 + 调度配置
 */

import type { Category } from "../types";
import { generateId } from "../utils";
import { getDB, rowToCategory } from "./shared";

export async function getCategories(): Promise<Category[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM categories").all().map((r) => rowToCategory(r as Record<string, unknown>));
}

export async function createCategory(name: string): Promise<Category> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare("INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(id, name, now, now);
  return { id, name, scheduleEnabled: false, scheduleInterval: '1h', autoIngest: false, ingestTopN: 5, createdAt: now, updatedAt: now };
}

export async function deleteCategory(id: string): Promise<boolean> {
  const db = getDB();
  const catResult = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (catResult.changes === 0) return false;
  db.prepare("DELETE FROM articles WHERE keywordId IN (SELECT id FROM keywords WHERE categoryId = ?)").run(id);
  db.prepare("DELETE FROM keywords WHERE categoryId = ?").run(id);
  return true;
}

export async function updateCategorySchedule(
  id: string, data: {
    scheduleEnabled?: boolean;
    scheduleInterval?: string;
    autoIngest?: boolean;
    ingestTopN?: number;
  }
): Promise<Category | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;
  const updatedAt = Date.now();
  const scheduleEnabled = data.scheduleEnabled !== undefined ? (data.scheduleEnabled ? 1 : 0) : (existing.scheduleEnabled as number);
  const scheduleInterval = data.scheduleInterval !== undefined ? data.scheduleInterval : (existing.scheduleInterval as string);
  const autoIngest = data.autoIngest !== undefined ? (data.autoIngest ? 1 : 0) : (existing.autoIngest as number);
  const ingestTopN = data.ingestTopN !== undefined ? data.ingestTopN : (existing.ingestTopN as number);
  db.prepare("UPDATE categories SET scheduleEnabled=?, scheduleInterval=?, autoIngest=?, ingestTopN=?, updatedAt=? WHERE id=?")
    .run(scheduleEnabled, scheduleInterval, autoIngest, ingestTopN, updatedAt, id);
  return rowToCategory({ ...existing, scheduleEnabled, scheduleInterval, autoIngest, ingestTopN, updatedAt });
}

export async function getScheduledCategories(): Promise<Category[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM categories WHERE scheduleEnabled = 1").all().map((r) => rowToCategory(r as Record<string, unknown>));
}
