/**
 * API 配置操作
 */

import type { ApiConfig } from "../types";
import { generateId } from "../utils";
import { getDB } from "./shared";

export async function getApiConfigs(): Promise<ApiConfig[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM api_configs").all().map((r: Record<string, unknown>) => ({
    ...r,
    isDefault: !!r.isDefault,
    isDefaultImage: !!r.isDefaultImage,
    type: r.type || 'text',
  })) as unknown as ApiConfig[];
}

export async function getDefaultApiConfig(type?: 'text' | 'image'): Promise<ApiConfig | null> {
  const db = getDB();
  let row: Record<string, unknown> | undefined;

  if (type === 'image') {
    row = db.prepare("SELECT * FROM api_configs WHERE isDefaultImage = 1 LIMIT 1").get() as Record<string, unknown> | undefined;
    if (row) return { ...row, isDefault: !!row.isDefault, isDefaultImage: true, type: (row.type as string) || 'image' } as unknown as ApiConfig;
    row = db.prepare("SELECT * FROM api_configs WHERE type = 'image' LIMIT 1").get() as Record<string, unknown> | undefined;
    if (row) return { ...row, isDefault: !!row.isDefault, isDefaultImage: !!row.isDefaultImage, type: 'image' } as unknown as ApiConfig;
    row = db.prepare("SELECT * FROM api_configs LIMIT 1").get() as Record<string, unknown> | undefined;
    return row ? { ...row, isDefault: !!row.isDefault, isDefaultImage: !!row.isDefaultImage, type: (row.type as string) || 'text' } as unknown as ApiConfig : null;
  }

  row = db.prepare("SELECT * FROM api_configs WHERE isDefault = 1 LIMIT 1").get() as Record<string, unknown> | undefined;
  if (row) return { ...row, isDefault: true, isDefaultImage: !!row.isDefaultImage, type: (row.type as string) || 'text' } as unknown as ApiConfig;
  const first = db.prepare("SELECT * FROM api_configs LIMIT 1").get() as Record<string, unknown> | undefined;
  return first ? { ...first, isDefault: !!first.isDefault, isDefaultImage: !!first.isDefaultImage, type: (first.type as string) || 'text' } as unknown as ApiConfig : null;
}

export async function createApiConfig(data: {
  name: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  isDefault?: boolean;
  type?: 'text' | 'image';
  isDefaultImage?: boolean;
}): Promise<ApiConfig> {
  const db = getDB();
  if (data.isDefault) {
    db.prepare("UPDATE api_configs SET isDefault = 0").run();
  }
  if (data.isDefaultImage) {
    db.prepare("UPDATE api_configs SET isDefaultImage = 0").run();
  }
  const id = generateId();
  const now = Date.now();
  const isDef = data.isDefault ? 1 : 0;
  const isDefImg = data.isDefaultImage ? 1 : 0;
  const cfgType = data.type || 'text';
  db.prepare(
    "INSERT INTO api_configs (id, name, apiUrl, apiKey, modelName, type, isDefault, isDefaultImage, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.name, data.apiUrl, data.apiKey, data.modelName, cfgType, isDef, isDefImg, now, now);
  return { id, name: data.name, apiUrl: data.apiUrl, apiKey: data.apiKey, modelName: data.modelName, type: cfgType, isDefault: !!isDef, isDefaultImage: !!isDefImg, createdAt: now, updatedAt: now };
}

export async function updateApiConfig(
  id: string,
  data: Partial<{ name: string; apiUrl: string; apiKey: string; modelName: string; isDefault: boolean; type: 'text' | 'image'; isDefaultImage: boolean }>
): Promise<ApiConfig | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM api_configs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;

  if (data.isDefault) {
    db.prepare("UPDATE api_configs SET isDefault = 0").run();
  }
  if (data.isDefaultImage) {
    db.prepare("UPDATE api_configs SET isDefaultImage = 0").run();
  }

  const name = data.name !== undefined ? data.name : (existing.name as string);
  const apiUrl = data.apiUrl !== undefined ? data.apiUrl : (existing.apiUrl as string);
  const apiKey = data.apiKey !== undefined ? data.apiKey : (existing.apiKey as string);
  const modelName = data.modelName !== undefined ? data.modelName : (existing.modelName as string);
  const isDefault = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : (existing.isDefault as number);
  const isDefaultImage = data.isDefaultImage !== undefined ? (data.isDefaultImage ? 1 : 0) : (existing.isDefaultImage as number);
  const type = data.type !== undefined ? data.type : ((existing.type as string) || 'text');
  const updatedAt = Date.now();

  db.prepare(
    "UPDATE api_configs SET name=?, apiUrl=?, apiKey=?, modelName=?, type=?, isDefault=?, isDefaultImage=?, updatedAt=? WHERE id=?"
  ).run(name, apiUrl, apiKey, modelName, type, isDefault, isDefaultImage, updatedAt, id);

  return { id, name, apiUrl, apiKey, modelName, type, isDefault: !!isDefault, isDefaultImage: !!isDefaultImage, createdAt: existing.createdAt as number, updatedAt };
}

export async function deleteApiConfig(id: string): Promise<boolean> {
  const db = getDB();
  const result = db.prepare("DELETE FROM api_configs WHERE id = ?").run(id);
  return result.changes > 0;
}
