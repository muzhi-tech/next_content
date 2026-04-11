/**
 * 数据库操作层 — better-sqlite3 实现
 *
 * 10 张表，37 个导出函数，签名与 JSON 版本完全一致。
 * 复杂嵌套字段（platforms, extra, topics, steps）以 JSON text 存储。
 * 所有函数保持 async 签名以确保向后兼容。
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Keyword, Article, Platform, ApiConfig, Persona, Style, KnowledgeBase, WxTemplate, Category, Report, PipelineRun, PipelineStepResult, GeneratedContent, ContentStatus, ContentSourceType, CollectionLog, CollectionLogStatus, StickerContentRecord, StickerSlide } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "content.db");

// ============ 单例连接 & 建表 ============

let _db: Database.Database | null = null;

function getDB(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scheduleEnabled INTEGER DEFAULT 0,
      scheduleInterval TEXT DEFAULT '1h',
      autoIngest INTEGER DEFAULT 0,
      ingestTopN INTEGER DEFAULT 5,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platforms TEXT NOT NULL DEFAULT '[]',
      categoryId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      keywordId TEXT,
      keywordName TEXT,
      platform TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      author TEXT DEFAULT '',
      authorAvatar TEXT DEFAULT '',
      url TEXT DEFAULT '',
      coverImage TEXT DEFAULT '',
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      collectedAt INTEGER NOT NULL,
      publishedAt INTEGER,
      isOriginal INTEGER DEFAULT 0,
      extra TEXT DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_articles_keywordId ON articles(keywordId);
    CREATE INDEX IF NOT EXISTS idx_articles_platform ON articles(platform);

    CREATE TABLE IF NOT EXISTS api_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      apiUrl TEXT NOT NULL,
      apiKey TEXT NOT NULL,
      modelName TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      isDefault INTEGER DEFAULT 0,
      isDefaultImage INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      systemPrompt TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS styles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      systemPrompt TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      content TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      titleTemplate TEXT DEFAULT '',
      contentTemplate TEXT DEFAULT '',
      coverPromptTemplate TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      categoryId TEXT,
      createdAt TEXT NOT NULL,
      summary TEXT DEFAULT '',
      topics TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'long-article',
      status TEXT NOT NULL,
      steps TEXT NOT NULL DEFAULT '[]',
      currentStepIndex INTEGER DEFAULT 0,
      result TEXT,
      error TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_category ON pipeline_runs(categoryId);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);

    CREATE TABLE IF NOT EXISTS generated_contents (
      id TEXT PRIMARY KEY,
      categoryId TEXT,
      topic TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      style TEXT DEFAULT '',
      personaId TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      wikiContext TEXT DEFAULT '',
      titles TEXT DEFAULT '',
      coverPrompt TEXT DEFAULT '',
      sourceType TEXT NOT NULL DEFAULT 'manual',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gc_category ON generated_contents(categoryId);
    CREATE INDEX IF NOT EXISTS idx_gc_status ON generated_contents(status);

    CREATE TABLE IF NOT EXISTS collection_logs (
      id TEXT PRIMARY KEY,
      categoryId TEXT,
      keywordId TEXT,
      keywordName TEXT,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      articleCount INTEGER DEFAULT 0,
      errorMsg TEXT DEFAULT '',
      startedAt INTEGER NOT NULL,
      completedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_cl_category ON collection_logs(categoryId);
    CREATE INDEX IF NOT EXISTS idx_cl_startedAt ON collection_logs(startedAt);

    CREATE TABLE IF NOT EXISTS sticker_contents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slides TEXT NOT NULL DEFAULT '[]',
      caption TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      wxMediaId TEXT DEFAULT '',
      wxUrl TEXT DEFAULT '',
      categoryId TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sc_category ON sticker_contents(categoryId);
    CREATE INDEX IF NOT EXISTS idx_sc_status ON sticker_contents(status);
  `);

  // Seed: ensure at least one default category exists
  const catCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as any).c;
  if (catCount === 0) {
    const now = Date.now();
    db.prepare(
      "INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)"
    ).run("default", "默认分类", now, now);
  }

  // Migrate: add new columns to existing categories table
  const catCols = (db.prepare("PRAGMA table_info(categories)").all() as any[]).map(c => c.name);
  if (!catCols.includes('scheduleEnabled')) {
    db.exec("ALTER TABLE categories ADD COLUMN scheduleEnabled INTEGER DEFAULT 0");
  }
  if (!catCols.includes('scheduleInterval')) {
    db.exec("ALTER TABLE categories ADD COLUMN scheduleInterval TEXT DEFAULT '1h'");
  }
  if (!catCols.includes('autoIngest')) {
    db.exec("ALTER TABLE categories ADD COLUMN autoIngest INTEGER DEFAULT 0");
  }
  if (!catCols.includes('ingestTopN')) {
    db.exec("ALTER TABLE categories ADD COLUMN ingestTopN INTEGER DEFAULT 5");
  }

  // Migrate: add new columns to existing api_configs table
  const cfgCols = (db.prepare("PRAGMA table_info(api_configs)").all() as any[]).map(c => c.name);
  if (!cfgCols.includes('type')) {
    db.exec("ALTER TABLE api_configs ADD COLUMN type TEXT DEFAULT 'text'");
  }
  if (!cfgCols.includes('isDefaultImage')) {
    db.exec("ALTER TABLE api_configs ADD COLUMN isDefaultImage INTEGER DEFAULT 0");
  }

  // Migrate: add type column to existing pipeline_runs table
  const prCols = (db.prepare("PRAGMA table_info(pipeline_runs)").all() as any[]).map(c => c.name);
  if (!prCols.includes('type')) {
    db.exec("ALTER TABLE pipeline_runs ADD COLUMN type TEXT DEFAULT 'long-article'");
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Row → Object helpers (parse JSON columns)
function rowToKeyword(row: any): Keyword {
  return { ...row, platforms: JSON.parse(row.platforms || '[]') };
}
function rowToArticle(row: any): Article {
  const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
  return { ...row, extra, isOriginal: !!row.isOriginal };
}
function rowToReport(row: any): Report {
  return { ...row, topics: JSON.parse(row.topics || '[]') };
}
function rowToPipelineRun(row: any): PipelineRun {
  return { ...row, type: row.type || 'long-article', steps: JSON.parse(row.steps || '[]') };
}
function rowToCategory(row: any): Category {
  return {
    ...row,
    scheduleEnabled: !!row.scheduleEnabled,
    autoIngest: !!row.autoIngest,
    ingestTopN: row.ingestTopN || 5,
    scheduleInterval: row.scheduleInterval || '1h',
  };
}
function rowToGeneratedContent(row: any): GeneratedContent {
  return { ...row };
}
function rowToCollectionLog(row: any): CollectionLog {
  return { ...row };
}
function rowToStickerContent(row: any): StickerContentRecord {
  return { ...row, slides: JSON.parse(row.slides || '[]') };
}

// Test-only: reset singleton for fresh database per test
export function _testResetDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ============ 关键词操作 ============

export async function getKeywords(categoryId?: string): Promise<Keyword[]> {
  const db = getDB();
  if (categoryId) {
    return db.prepare("SELECT * FROM keywords WHERE categoryId = ?").all(categoryId).map(rowToKeyword);
  }
  return db.prepare("SELECT * FROM keywords").all().map(rowToKeyword);
}

export async function getKeyword(id: string): Promise<Keyword | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM keywords WHERE id = ?").get(id);
  return row ? rowToKeyword(row) : null;
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
  const existing = db.prepare("SELECT * FROM keywords WHERE id = ?").get(id) as any;
  if (!existing) return null;

  const name = data.name !== undefined ? data.name : existing.name;
  const platforms = data.platforms !== undefined ? data.platforms : JSON.parse(existing.platforms);
  const updatedAt = Date.now();

  db.prepare(
    "UPDATE keywords SET name = ?, platforms = ?, updatedAt = ? WHERE id = ?"
  ).run(name, JSON.stringify(platforms), updatedAt, id);

  return { id, name, platforms, categoryId: existing.categoryId, createdAt: existing.createdAt, updatedAt };
}

export async function deleteKeyword(id: string): Promise<boolean> {
  const db = getDB();
  const result = db.prepare("DELETE FROM keywords WHERE id = ?").run(id);
  return result.changes > 0;
}

// ============ 文章操作 ============

export async function getArticles(options: {
  keywordId?: string;
  platform?: Platform;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ articles: Article[]; total: number }> {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

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

  const total = (db.prepare(`SELECT COUNT(*) as count FROM articles a ${where}`).get(params) as any).count;

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT a.* FROM articles a ${where} ORDER BY a.collectedAt DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { articles: rows.map(rowToArticle), total };
}

export async function saveArticle(article: Omit<Article, "id">): Promise<Article> {
  const db = getDB();
  const existing = db.prepare(
    "SELECT * FROM articles WHERE platform = ? AND url = ?"
  ).get(article.platform, article.url) as any;

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

// ============ API 配置操作 ============

export async function getApiConfigs(): Promise<ApiConfig[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM api_configs").all().map((r: any) => ({
    ...r,
    isDefault: !!r.isDefault,
    isDefaultImage: !!r.isDefaultImage,
    type: r.type || 'text',
  }));
}

export async function getDefaultApiConfig(type?: 'text' | 'image'): Promise<ApiConfig | null> {
  const db = getDB();
  let row: any;

  if (type === 'image') {
    // Look for default image config first
    row = db.prepare("SELECT * FROM api_configs WHERE isDefaultImage = 1 LIMIT 1").get();
    if (row) return { ...row, isDefault: !!row.isDefault, isDefaultImage: true, type: row.type || 'image' };
    // Fallback to first image config
    row = db.prepare("SELECT * FROM api_configs WHERE type = 'image' LIMIT 1").get();
    if (row) return { ...row, isDefault: !!row.isDefault, isDefaultImage: !!row.isDefaultImage, type: 'image' };
    // Last resort: first config of any type
    row = db.prepare("SELECT * FROM api_configs LIMIT 1").get();
    return row ? { ...row, isDefault: !!row.isDefault, isDefaultImage: !!row.isDefaultImage, type: row.type || 'text' } : null;
  }

  // Default behavior for text or undefined
  row = db.prepare("SELECT * FROM api_configs WHERE isDefault = 1 LIMIT 1").get() as any;
  if (row) return { ...row, isDefault: true, isDefaultImage: !!row.isDefaultImage, type: row.type || 'text' };
  const first = db.prepare("SELECT * FROM api_configs LIMIT 1").get() as any;
  return first ? { ...first, isDefault: !!first.isDefault, isDefaultImage: !!first.isDefaultImage, type: first.type || 'text' } : null;
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
  const existing = db.prepare("SELECT * FROM api_configs WHERE id = ?").get(id) as any;
  if (!existing) return null;

  if (data.isDefault) {
    db.prepare("UPDATE api_configs SET isDefault = 0").run();
  }
  if (data.isDefaultImage) {
    db.prepare("UPDATE api_configs SET isDefaultImage = 0").run();
  }

  const name = data.name !== undefined ? data.name : existing.name;
  const apiUrl = data.apiUrl !== undefined ? data.apiUrl : existing.apiUrl;
  const apiKey = data.apiKey !== undefined ? data.apiKey : existing.apiKey;
  const modelName = data.modelName !== undefined ? data.modelName : existing.modelName;
  const isDefault = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : existing.isDefault;
  const isDefaultImage = data.isDefaultImage !== undefined ? (data.isDefaultImage ? 1 : 0) : existing.isDefaultImage;
  const type = data.type !== undefined ? data.type : (existing.type || 'text');
  const updatedAt = Date.now();

  db.prepare(
    "UPDATE api_configs SET name=?, apiUrl=?, apiKey=?, modelName=?, type=?, isDefault=?, isDefaultImage=?, updatedAt=? WHERE id=?"
  ).run(name, apiUrl, apiKey, modelName, type, isDefault, isDefaultImage, updatedAt, id);

  return { id, name, apiUrl, apiKey, modelName, type, isDefault: !!isDefault, isDefaultImage: !!isDefaultImage, createdAt: existing.createdAt, updatedAt };
}

export async function deleteApiConfig(id: string): Promise<boolean> {
  const db = getDB();
  const result = db.prepare("DELETE FROM api_configs WHERE id = ?").run(id);
  return result.changes > 0;
}

// ============ 人设（Persona）操作 ============

export async function getPersonas(): Promise<Persona[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM personas").all() as Persona[];
}

export async function getPersona(id: string): Promise<Persona | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM personas WHERE id = ?").get(id) as Persona) || null;
}

export async function createPersona(data: {
  name: string; description: string; avatar?: string; systemPrompt: string;
}): Promise<Persona> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO personas (id, name, description, avatar, systemPrompt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.name, data.description, data.avatar || '', data.systemPrompt, now, now);
  return { id, name: data.name, description: data.description, avatar: data.avatar, systemPrompt: data.systemPrompt, createdAt: now, updatedAt: now };
}

export async function updatePersona(
  id: string, data: Partial<{ name: string; description: string; avatar: string; systemPrompt: string }>
): Promise<Persona | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM personas WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : existing.name;
  const description = data.description !== undefined ? data.description : existing.description;
  const avatar = data.avatar !== undefined ? data.avatar : existing.avatar;
  const systemPrompt = data.systemPrompt !== undefined ? data.systemPrompt : existing.systemPrompt;
  db.prepare("UPDATE personas SET name=?, description=?, avatar=?, systemPrompt=?, updatedAt=? WHERE id=?")
    .run(name, description, avatar, systemPrompt, updatedAt, id);
  return { id, name, description, avatar, systemPrompt, createdAt: existing.createdAt, updatedAt };
}

export async function deletePersona(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM personas WHERE id = ?").run(id).changes > 0;
}

// ============ 风格（Style）操作 ============

export async function getStyles(): Promise<Style[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM styles").all() as Style[];
}

export async function getStyle(id: string): Promise<Style | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM styles WHERE id = ?").get(id) as Style) || null;
}

export async function createStyle(data: { name: string; icon: string; systemPrompt: string }): Promise<Style> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare("INSERT INTO styles (id, name, icon, systemPrompt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.name, data.icon, data.systemPrompt, now, now);
  return { id, name: data.name, icon: data.icon, systemPrompt: data.systemPrompt, createdAt: now, updatedAt: now };
}

export async function updateStyle(
  id: string, data: Partial<{ name: string; icon: string; systemPrompt: string }>
): Promise<Style | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM styles WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : existing.name;
  const icon = data.icon !== undefined ? data.icon : existing.icon;
  const systemPrompt = data.systemPrompt !== undefined ? data.systemPrompt : existing.systemPrompt;
  db.prepare("UPDATE styles SET name=?, icon=?, systemPrompt=?, updatedAt=? WHERE id=?")
    .run(name, icon, systemPrompt, updatedAt, id);
  return { id, name, icon, systemPrompt, createdAt: existing.createdAt, updatedAt };
}

export async function deleteStyle(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM styles WHERE id = ?").run(id).changes > 0;
}

// ============ 知识库（KnowledgeBase）操作 ============

export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM knowledge_bases").all() as KnowledgeBase[];
}

export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM knowledge_bases WHERE id = ?").get(id) as KnowledgeBase) || null;
}

export async function createKnowledgeBase(data: { name: string; description: string; content: string }): Promise<KnowledgeBase> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare("INSERT INTO knowledge_bases (id, name, description, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.name, data.description, data.content, now, now);
  return { id, name: data.name, description: data.description, content: data.content, createdAt: now, updatedAt: now };
}

export async function updateKnowledgeBase(
  id: string, data: Partial<{ name: string; description: string; content: string }>
): Promise<KnowledgeBase | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM knowledge_bases WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : existing.name;
  const description = data.description !== undefined ? data.description : existing.description;
  const content = data.content !== undefined ? data.content : existing.content;
  db.prepare("UPDATE knowledge_bases SET name=?, description=?, content=?, updatedAt=? WHERE id=?")
    .run(name, description, content, updatedAt, id);
  return { id, name, description, content, createdAt: existing.createdAt, updatedAt };
}

export async function deleteKnowledgeBase(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM knowledge_bases WHERE id = ?").run(id).changes > 0;
}

// ============ 公众号模板（WxTemplate）操作 ============

export async function getTemplates(): Promise<WxTemplate[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM templates").all() as WxTemplate[];
}

export async function getTemplate(id: string): Promise<WxTemplate | null> {
  const db = getDB();
  return (db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as WxTemplate) || null;
}

export async function createTemplate(data: {
  name: string; titleTemplate: string; contentTemplate: string; coverPromptTemplate?: string;
}): Promise<WxTemplate> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO templates (id, name, titleTemplate, contentTemplate, coverPromptTemplate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.name, data.titleTemplate, data.contentTemplate, data.coverPromptTemplate || '', now, now);
  return { id, name: data.name, titleTemplate: data.titleTemplate, contentTemplate: data.contentTemplate, coverPromptTemplate: data.coverPromptTemplate, createdAt: now, updatedAt: now };
}

export async function updateTemplate(
  id: string, data: Partial<{ name: string; titleTemplate: string; contentTemplate: string; coverPromptTemplate: string }>
): Promise<WxTemplate | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const updatedAt = Date.now();
  const name = data.name !== undefined ? data.name : existing.name;
  const titleTemplate = data.titleTemplate !== undefined ? data.titleTemplate : existing.titleTemplate;
  const contentTemplate = data.contentTemplate !== undefined ? data.contentTemplate : existing.contentTemplate;
  const coverPromptTemplate = data.coverPromptTemplate !== undefined ? data.coverPromptTemplate : existing.coverPromptTemplate;
  db.prepare("UPDATE templates SET name=?, titleTemplate=?, contentTemplate=?, coverPromptTemplate=?, updatedAt=? WHERE id=?")
    .run(name, titleTemplate, contentTemplate, coverPromptTemplate, updatedAt, id);
  return { id, name, titleTemplate, contentTemplate, coverPromptTemplate, createdAt: existing.createdAt, updatedAt };
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const db = getDB();
  return db.prepare("DELETE FROM templates WHERE id = ?").run(id).changes > 0;
}

// ============ 分类（Category）操作 ============

export async function getCategories(): Promise<Category[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM categories").all().map(rowToCategory);
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
  // Cascade: delete keywords and their articles
  const keywordIds = db.prepare("SELECT id FROM keywords WHERE categoryId = ?").all(id).map((r: any) => r.id);
  db.prepare("DELETE FROM articles WHERE keywordId IN (SELECT id FROM keywords WHERE categoryId = ?)").run(id);
  db.prepare("DELETE FROM keywords WHERE categoryId = ?").run(id);
  return true;
}

// ============ 报告（Report）操作 ============

export async function getReports(categoryId?: string): Promise<Report[]> {
  const db = getDB();
  if (categoryId) {
    return db.prepare("SELECT * FROM reports WHERE categoryId = ?").all(categoryId).map(rowToReport);
  }
  return db.prepare("SELECT * FROM reports").all().map(rowToReport);
}

export async function addReport(report: Report): Promise<Report> {
  const db = getDB();
  db.prepare(
    "INSERT INTO reports (id, categoryId, createdAt, summary, topics) VALUES (?, ?, ?, ?, ?)"
  ).run(report.id, report.categoryId, report.createdAt, report.summary, JSON.stringify(report.topics));
  return report;
}

export async function getReportById(id: string): Promise<Report | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  return row ? rowToReport(row) : null;
}

// ============ AI 创作辅助函数 ============

export async function buildAIContext(params: {
  personaId?: string;
  styleId?: string;
  knowledgeIds?: string[];
  templateId?: string;
}): Promise<{
  systemPrompt: string;
  contextData: {
    persona?: Persona;
    style?: Style;
    knowledgeBases: KnowledgeBase[];
    template?: WxTemplate;
  };
}> {
  const { personaId, styleId, knowledgeIds, templateId } = params;

  const [persona, style, knowledgeBases, template] = await Promise.all([
    personaId ? getPersona(personaId) : Promise.resolve(null),
    styleId ? getStyle(styleId) : Promise.resolve(null),
    knowledgeIds?.length ? Promise.all(knowledgeIds.map((id) => getKnowledgeBase(id))) : Promise.resolve([]),
    templateId ? getTemplate(templateId) : Promise.resolve(null),
  ]);

  const systemPromptParts: string[] = [];

  if (persona) {
    systemPromptParts.push(`【人设】\n${persona.systemPrompt}`);
  }
  if (style) {
    systemPromptParts.push(`【风格】\n${style.systemPrompt}`);
  }
  if (knowledgeBases.length > 0) {
    const validKnowledgeBases = knowledgeBases.filter((kb): kb is KnowledgeBase => kb !== null);
    if (validKnowledgeBases.length > 0) {
      const knowledgeContent = validKnowledgeBases.map((kb) => `【${kb.name}】\n${kb.content}`).join("\n\n");
      systemPromptParts.push(`【知识库】\n${knowledgeContent}`);
    }
  }
  if (template) {
    systemPromptParts.push(`【内容模板】\n标题模板：${template.titleTemplate}\n内容模板：${template.contentTemplate}`);
  }

  return {
    systemPrompt: systemPromptParts.join("\n\n"),
    contextData: {
      persona: persona || undefined,
      style: style || undefined,
      knowledgeBases: knowledgeBases.filter((kb): kb is KnowledgeBase => kb !== null),
      template: template || undefined,
    },
  };
}

// ============ 管道运行（PipelineRun）操作 ============

export async function getPipelineRun(id: string): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id);
  return row ? rowToPipelineRun(row) : null;
}

export async function createPipelineRun(run: PipelineRun): Promise<PipelineRun> {
  const db = getDB();
  db.prepare(
    "INSERT INTO pipeline_runs (id, categoryId, type, status, steps, currentStepIndex, result, error, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(run.id, run.categoryId, run.type || 'long-article', run.status, JSON.stringify(run.steps), run.currentStepIndex, run.result || null, run.error || null, run.createdAt, run.updatedAt);
  return run;
}

export async function updatePipelineStep(
  id: string, stepIndex: number, update: Partial<PipelineStepResult>
): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id) as any;
  if (!row) return null;
  const steps = JSON.parse(row.steps);
  if (stepIndex < 0 || stepIndex >= steps.length) return null;
  steps[stepIndex] = { ...steps[stepIndex], ...update };
  const updatedAt = new Date().toISOString();
  db.prepare("UPDATE pipeline_runs SET steps = ?, updatedAt = ? WHERE id = ?")
    .run(JSON.stringify(steps), updatedAt, id);
  return rowToPipelineRun({ ...row, steps, updatedAt });
}

export async function updatePipelineStatus(
  id: string, status: PipelineRun['status'], result?: string, error?: string
): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id) as any;
  if (!row) return null;
  const updatedAt = new Date().toISOString();
  const resultVal = result !== undefined ? result : row.result;
  const errorVal = error !== undefined ? error : row.error;
  db.prepare("UPDATE pipeline_runs SET status = ?, result = ?, error = ?, updatedAt = ? WHERE id = ?")
    .run(status, resultVal, errorVal, updatedAt, id);
  return rowToPipelineRun({ ...row, status, result: resultVal, error: errorVal, updatedAt });
}

export async function updatePipelineRun(id: string, updates: Partial<PipelineRun>): Promise<PipelineRun | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(id) as any;
  if (!row) return null;

  const steps = updates.steps !== undefined ? JSON.stringify(updates.steps) : row.steps;
  const currentStepIndex = updates.currentStepIndex !== undefined ? updates.currentStepIndex : row.currentStepIndex;
  const status = updates.status !== undefined ? updates.status : row.status;
  const result = updates.result !== undefined ? updates.result : row.result;
  const error = updates.error !== undefined ? updates.error : row.error;
  const updatedAt = new Date().toISOString();

  db.prepare("UPDATE pipeline_runs SET steps=?, currentStepIndex=?, status=?, result=?, error=?, updatedAt=? WHERE id=?")
    .run(steps, currentStepIndex, status, result, error, updatedAt, id);

  return rowToPipelineRun({ ...row, steps: JSON.parse(steps), currentStepIndex, status, result, error, updatedAt });
}

export async function listPipelineRuns(options?: {
  categoryId?: string; limit?: number;
}): Promise<PipelineRun[]> {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.categoryId) {
    conditions.push("categoryId = ?");
    params.push(options.categoryId);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const limit = options?.limit ? "LIMIT ?" : "";
  if (options?.limit) params.push(options.limit);

  return db.prepare(
    `SELECT * FROM pipeline_runs ${where} ORDER BY createdAt DESC ${limit}`
  ).all(...params).map(rowToPipelineRun);
}

export async function deleteOldPipelineRuns(keepCount: number): Promise<number> {
  const db = getDB();
  const total = (db.prepare("SELECT COUNT(*) as count FROM pipeline_runs").get() as any).count;
  if (total <= keepCount) return 0;
  const toDelete = total - keepCount;
  db.prepare(
    `DELETE FROM pipeline_runs WHERE id NOT IN (
      SELECT id FROM pipeline_runs ORDER BY createdAt DESC LIMIT ?
    )`
  ).run(keepCount);
  return toDelete;
}

// ============ 分类调度配置 ============

export async function updateCategorySchedule(
  id: string, data: {
    scheduleEnabled?: boolean;
    scheduleInterval?: string;
    autoIngest?: boolean;
    ingestTopN?: number;
  }
): Promise<Category | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const updatedAt = Date.now();
  const scheduleEnabled = data.scheduleEnabled !== undefined ? (data.scheduleEnabled ? 1 : 0) : existing.scheduleEnabled;
  const scheduleInterval = data.scheduleInterval !== undefined ? data.scheduleInterval : existing.scheduleInterval;
  const autoIngest = data.autoIngest !== undefined ? (data.autoIngest ? 1 : 0) : existing.autoIngest;
  const ingestTopN = data.ingestTopN !== undefined ? data.ingestTopN : existing.ingestTopN;
  db.prepare("UPDATE categories SET scheduleEnabled=?, scheduleInterval=?, autoIngest=?, ingestTopN=?, updatedAt=? WHERE id=?")
    .run(scheduleEnabled, scheduleInterval, autoIngest, ingestTopN, updatedAt, id);
  return rowToCategory({ ...existing, scheduleEnabled, scheduleInterval, autoIngest, ingestTopN, updatedAt });
}

export async function getScheduledCategories(): Promise<Category[]> {
  const db = getDB();
  return db.prepare("SELECT * FROM categories WHERE scheduleEnabled = 1").all().map(rowToCategory);
}

// ============ 生成内容（GeneratedContent）操作 ============

export async function getGeneratedContents(options: {
  categoryId?: string;
  status?: ContentStatus;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ items: GeneratedContent[]; total: number }> {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

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
  const total = (db.prepare(`SELECT COUNT(*) as count FROM generated_contents ${where}`).get(params) as any).count;

  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT * FROM generated_contents ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { items: rows.map(rowToGeneratedContent), total };
}

export async function getGeneratedContent(id: string): Promise<GeneratedContent | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM generated_contents WHERE id = ?").get(id);
  return row ? rowToGeneratedContent(row) : null;
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
  const existing = db.prepare("SELECT * FROM generated_contents WHERE id = ?").get(id) as any;
  if (!existing) return null;
  const updatedAt = Date.now();
  const fields = { ...existing };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) (fields as any)[k] = v;
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

// ============ 采集日志（CollectionLog）操作 ============

export async function getCollectionLogs(options: {
  categoryId?: string;
  limit?: number;
}): Promise<CollectionLog[]> {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.categoryId) {
    conditions.push("categoryId = ?");
    params.push(options.categoryId);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const limit = options.limit || 50;
  params.push(limit);

  return db.prepare(
    `SELECT * FROM collection_logs ${where} ORDER BY startedAt DESC LIMIT ?`
  ).all(...params).map(rowToCollectionLog);
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

// ============ 数据分析查询 ============

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
  return row ? rowToPipelineRun(row) : null;
}

// ============ 贴图内容（StickerContent）操作 ============

export async function getStickerContents(options?: {
  categoryId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: StickerContentRecord[]; total: number }> {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.categoryId) {
    conditions.push("categoryId = ?");
    params.push(options.categoryId);
  }
  if (options?.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const total = (db.prepare(`SELECT COUNT(*) as count FROM sticker_contents ${where}`).get(params) as any).count;

  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT * FROM sticker_contents ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return { items: rows.map(rowToStickerContent), total };
}

export async function getStickerContent(id: string): Promise<StickerContentRecord | null> {
  const db = getDB();
  const row = db.prepare("SELECT * FROM sticker_contents WHERE id = ?").get(id);
  return row ? rowToStickerContent(row) : null;
}

export async function createStickerContent(data: {
  title: string;
  slides: StickerSlide[];
  caption?: string;
  status?: string;
  categoryId?: string;
}): Promise<StickerContentRecord> {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO sticker_contents (id, title, slides, caption, status, categoryId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.title, JSON.stringify(data.slides), data.caption || '', data.status || 'draft', data.categoryId || '', now, now);
  return { id, title: data.title, slides: data.slides, caption: data.caption || '', status: (data.status || 'draft') as StickerContentRecord['status'], categoryId: data.categoryId, createdAt: now, updatedAt: now };
}

export async function updateStickerContent(
  id: string,
  data: Partial<{
    title: string;
    slides: StickerSlide[];
    caption: string;
    status: string;
    wxMediaId: string;
    wxUrl: string;
  }>
): Promise<StickerContentRecord | null> {
  const db = getDB();
  const existing = db.prepare("SELECT * FROM sticker_contents WHERE id = ?").get(id) as any;
  if (!existing) return null;

  const updatedAt = Date.now();
  const title = data.title !== undefined ? data.title : existing.title;
  const slides = data.slides !== undefined ? JSON.stringify(data.slides) : existing.slides;
  const caption = data.caption !== undefined ? data.caption : existing.caption;
  const status = data.status !== undefined ? data.status : existing.status;
  const wxMediaId = data.wxMediaId !== undefined ? data.wxMediaId : existing.wxMediaId;
  const wxUrl = data.wxUrl !== undefined ? data.wxUrl : existing.wxUrl;

  db.prepare(
    "UPDATE sticker_contents SET title=?, slides=?, caption=?, status=?, wxMediaId=?, wxUrl=?, updatedAt=? WHERE id=?"
  ).run(title, slides, caption, status, wxMediaId, wxUrl, updatedAt, id);

  return rowToStickerContent({ ...existing, title, slides, caption, status, wxMediaId, wxUrl, updatedAt });
}

export async function deleteStickerContent(id: string): Promise<boolean> {
  const db = getDB();
  const result = db.prepare("DELETE FROM sticker_contents WHERE id = ?").run(id);
  return result.changes > 0;
}
