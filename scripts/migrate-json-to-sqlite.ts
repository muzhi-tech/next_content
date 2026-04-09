/**
 * JSON → SQLite 迁移脚本
 *
 * 读取 data/db.json，写入 data/content.db
 * 使用 better-sqlite3（与 db.ts 一致）
 *
 * 用法：npx tsx scripts/migrate-json-to-sqlite.ts
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync, renameSync } from "fs";
import { join } from "path";

const JSON_PATH = join(process.cwd(), "data", "db.json");
const DB_PATH = join(process.cwd(), "data", "content.db");

interface JsonDB {
  keywords: any[];
  articles: any[];
  categories: any[];
  personas: any[];
  styles: any[];
  knowledgeBases: any[];
  templates: any[];
  apiConfigs: any[];
  reports: any[];
  pipelineRuns: any[];
}

function main() {
  // 1. 检查 db.json
  if (!existsSync(JSON_PATH)) {
    console.log("db.json not found — nothing to migrate.");
    process.exit(0);
  }

  const json: JsonDB = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
  console.log("Loaded db.json:", {
    keywords: json.keywords?.length || 0,
    articles: json.articles?.length || 0,
    categories: json.categories?.length || 0,
    personas: json.personas?.length || 0,
    styles: json.styles?.length || 0,
    knowledgeBases: json.knowledgeBases?.length || 0,
    templates: json.templates?.length || 0,
    apiConfigs: json.apiConfigs?.length || 0,
    reports: json.reports?.length || 0,
    pipelineRuns: json.pipelineRuns?.length || 0,
  });

  // 2. 如果 content.db 已存在，先备份
  if (existsSync(DB_PATH)) {
    const backup = DB_PATH + ".bak";
    renameSync(DB_PATH, backup);
    console.log(`Existing content.db renamed to ${backup}`);
  }

  // 3. 创建数据库（与 db.ts 相同的 schema）
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, platforms TEXT NOT NULL DEFAULT '[]',
      categoryId TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY, keywordId TEXT, keywordName TEXT, platform TEXT NOT NULL,
      title TEXT NOT NULL, content TEXT DEFAULT '', author TEXT DEFAULT '',
      authorAvatar TEXT DEFAULT '', url TEXT DEFAULT '', coverImage TEXT DEFAULT '',
      likes INTEGER DEFAULT 0, comments INTEGER DEFAULT 0, shares INTEGER DEFAULT 0,
      collectedAt INTEGER NOT NULL, publishedAt INTEGER, isOriginal INTEGER DEFAULT 0,
      extra TEXT DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_articles_keywordId ON articles(keywordId);
    CREATE INDEX IF NOT EXISTS idx_articles_platform ON articles(platform);
    CREATE TABLE IF NOT EXISTS api_configs (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, apiUrl TEXT NOT NULL, apiKey TEXT NOT NULL,
      modelName TEXT NOT NULL, isDefault INTEGER DEFAULT 0, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      avatar TEXT DEFAULT '', systemPrompt TEXT DEFAULT '', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS styles (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT DEFAULT '',
      systemPrompt TEXT DEFAULT '', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      content TEXT DEFAULT '', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, titleTemplate TEXT DEFAULT '',
      contentTemplate TEXT DEFAULT '', coverPromptTemplate TEXT DEFAULT '', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, categoryId TEXT, createdAt TEXT NOT NULL,
      summary TEXT DEFAULT '', topics TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY, categoryId TEXT NOT NULL, status TEXT NOT NULL,
      steps TEXT NOT NULL DEFAULT '[]', currentStepIndex INTEGER DEFAULT 0,
      result TEXT, error TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_category ON pipeline_runs(categoryId);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
  `);

  // 4. 迁移数据（事务）
  const insert = (sql: string, params: any[]) => db.prepare(sql).run(...params);

  const migrate = db.transaction(() => {
    // Categories
    for (const r of json.categories || []) {
      insert("INSERT OR IGNORE INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
        [r.id, r.name, r.createdAt, r.updatedAt]);
    }

    // Keywords
    for (const r of json.keywords || []) {
      insert("INSERT OR IGNORE INTO keywords (id, name, platforms, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [r.id, r.name, JSON.stringify(r.platforms || []), r.categoryId, r.createdAt, r.updatedAt]);
    }

    // Articles
    for (const r of json.articles || []) {
      insert(`INSERT OR IGNORE INTO articles (id, keywordId, keywordName, platform, title, content, author, authorAvatar, url, coverImage, likes, comments, shares, collectedAt, publishedAt, isOriginal, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.keywordId, r.keywordName || "", r.platform, r.title, r.content || "", r.author || "", r.authorAvatar || "", r.url || "", r.coverImage || "", r.likes || 0, r.comments || 0, r.shares || 0, r.collectedAt, r.publishedAt, r.isOriginal ? 1 : 0, JSON.stringify(r.extra || {})]);
    }

    // API Configs
    for (const r of json.apiConfigs || []) {
      insert("INSERT OR IGNORE INTO api_configs (id, name, apiUrl, apiKey, modelName, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [r.id, r.name, r.apiUrl, r.apiKey, r.modelName, r.isDefault ? 1 : 0, r.createdAt, r.updatedAt]);
    }

    // Personas
    for (const r of json.personas || []) {
      insert("INSERT OR IGNORE INTO personas (id, name, description, avatar, systemPrompt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [r.id, r.name, r.description || "", r.avatar || "", r.systemPrompt || "", r.createdAt, r.updatedAt]);
    }

    // Styles
    for (const r of json.styles || []) {
      insert("INSERT OR IGNORE INTO styles (id, name, icon, systemPrompt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [r.id, r.name, r.icon || "", r.systemPrompt || "", r.createdAt, r.updatedAt]);
    }

    // Knowledge Bases
    for (const r of json.knowledgeBases || []) {
      insert("INSERT OR IGNORE INTO knowledge_bases (id, name, description, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [r.id, r.name, r.description || "", r.content || "", r.createdAt, r.updatedAt]);
    }

    // Templates
    for (const r of json.templates || []) {
      insert("INSERT OR IGNORE INTO templates (id, name, titleTemplate, contentTemplate, coverPromptTemplate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [r.id, r.name, r.titleTemplate || "", r.contentTemplate || "", r.coverPromptTemplate || "", r.createdAt, r.updatedAt]);
    }

    // Reports
    for (const r of json.reports || []) {
      insert("INSERT OR IGNORE INTO reports (id, categoryId, createdAt, summary, topics) VALUES (?, ?, ?, ?, ?)",
        [r.id, r.categoryId, r.createdAt, r.summary || "", JSON.stringify(r.topics || [])]);
    }

    // Pipeline Runs
    for (const r of json.pipelineRuns || []) {
      insert("INSERT OR IGNORE INTO pipeline_runs (id, categoryId, status, steps, currentStepIndex, result, error, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [r.id, r.categoryId, r.status, JSON.stringify(r.steps || []), r.currentStepIndex || 0, r.result || null, r.error || null, r.createdAt, r.updatedAt]);
    }
  });

  migrate();
  console.log("\nData migrated successfully.");

  // 5. 验证
  console.log("\nVerification:");
  for (const table of ["categories", "keywords", "articles", "api_configs", "personas", "styles", "knowledge_bases", "templates", "reports", "pipeline_runs"]) {
    const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any).c;
    console.log(`  ${table}: ${count} rows`);
  }

  db.close();

  // 6. 重命名 db.json 为备份
  const jsonBackup = JSON_PATH + ".bak";
  renameSync(JSON_PATH, jsonBackup);
  console.log(`\ndb.json renamed to db.json.bak`);
  console.log("Migration complete. Database saved to:", DB_PATH);
}

main();
