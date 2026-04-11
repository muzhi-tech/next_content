/**
 * 数据库共享层 — 连接管理、Schema 初始化、Row Helpers
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Keyword, Article, Category, Report, PipelineRun, GeneratedContent, CollectionLog, StickerContentRecord } from "../types";

const DB_PATH = path.join(process.cwd(), "data", "content.db");

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
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
  const catCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;
  if (catCount === 0) {
    const now = Date.now();
    db.prepare(
      "INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)"
    ).run("default", "默认分类", now, now);
  }

  // Migrate: add new columns to existing categories table
  const catCols = (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map(c => c.name);
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
  const cfgCols = (db.prepare("PRAGMA table_info(api_configs)").all() as { name: string }[]).map(c => c.name);
  if (!cfgCols.includes('type')) {
    db.exec("ALTER TABLE api_configs ADD COLUMN type TEXT DEFAULT 'text'");
  }
  if (!cfgCols.includes('isDefaultImage')) {
    db.exec("ALTER TABLE api_configs ADD COLUMN isDefaultImage INTEGER DEFAULT 0");
  }
}

// Row -> Object helpers (parse JSON columns)
export function rowToKeyword(row: Record<string, unknown>): Keyword {
  return { ...row, platforms: JSON.parse((row.platforms as string) || '[]') } as unknown as Keyword;
}

export function rowToArticle(row: Record<string, unknown>): Article {
  const extra = typeof row.extra === 'string' ? JSON.parse((row.extra as string) || '{}') : (row.extra || {});
  return { ...row, extra, isOriginal: !!row.isOriginal } as unknown as Article;
}

export function rowToReport(row: Record<string, unknown>): Report {
  return { ...row, topics: JSON.parse((row.topics as string) || '[]') } as unknown as Report;
}

export function rowToPipelineRun(row: Record<string, unknown>): PipelineRun {
  return { ...row, steps: JSON.parse((row.steps as string) || '[]') } as unknown as PipelineRun;
}

export function rowToCategory(row: Record<string, unknown>): Category {
  return {
    ...row,
    scheduleEnabled: !!row.scheduleEnabled,
    autoIngest: !!row.autoIngest,
    ingestTopN: (row.ingestTopN as number) || 5,
    scheduleInterval: (row.scheduleInterval as string) || '1h',
  } as unknown as Category;
}

export function rowToGeneratedContent(row: Record<string, unknown>): GeneratedContent {
  return { ...row } as unknown as GeneratedContent;
}

export function rowToCollectionLog(row: Record<string, unknown>): CollectionLog {
  return { ...row } as unknown as CollectionLog;
}

export function rowToStickerContent(row: Record<string, unknown>): StickerContentRecord {
  return { ...row, slides: JSON.parse((row.slides as string) || '[]') } as unknown as StickerContentRecord;
}

// Test-only: reset singleton for fresh database per test
export function _testResetDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
