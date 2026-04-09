import { promises as fs } from "fs";
import path from "path";
import { WikiPageMeta } from "./types";

export interface WikiConfig {
  baseDir: string;
}

const WIKI_ROOT = path.join(process.cwd(), "data", "wiki");

/**
 * 初始化指定分类的 Wiki 目录结构
 * @param categoryId 分类 ID
 */
export async function initWiki(categoryId: string): Promise<WikiConfig> {
  const dir = path.join(WIKI_ROOT, categoryId);
  const entitiesDir = path.join(dir, "entities");
  const topicsDir = path.join(dir, "topics");
  
  await fs.mkdir(entitiesDir, { recursive: true });
  await fs.mkdir(topicsDir, { recursive: true });

  const indexFile = path.join(dir, "index.md");
  const logFile = path.join(dir, "log.md");

  // 初始化索引文件
  try {
    await fs.access(indexFile);
  } catch {
    await fs.writeFile(indexFile, "# Wiki Index\n\n- [entities](entities/)\n- [topics](topics/)\n");
  }

  // 初始化日志文件
  try {
    await fs.access(logFile);
  } catch {
    await fs.writeFile(logFile, "# Wiki Log\n\n## [" + new Date().toISOString().split('T')[0] + "] Wiki Initialized\n");
  }

  return { baseDir: dir };
}

/**
 * 记录日志 (Append Only)
 * @param categoryId 分类 ID
 * @param message 日志信息 (如：ingest | 采集了 5 篇公众号文章)
 */
export async function appendLog(categoryId: string, message: string): Promise<void> {
  const logFile = path.join(WIKI_ROOT, categoryId, "log.md");
  const dateStr = new Date().toISOString().split('T')[0];
  const logEntry = `## [${dateStr}] ${message}\n`;
  await fs.appendFile(logFile, logEntry);
}

/**
 * 更新或创建 Wiki 页面 (实体或主题)
 * @param categoryId 分类 ID
 * @param type 类型 (entities 或 topics)
 * @param name 文件名 (不含 .md)
 * @param content Markdown 内容
 */
export async function upsertWikiPage(
  categoryId: string,
  type: "entities" | "topics",
  name: string,
  content: string
): Promise<void> {
  const filePath = path.join(WIKI_ROOT, categoryId, type, `${name}.md`);
  await fs.writeFile(filePath, content);
}

/**
 * 读取整个 index.md 作为 AI 检索入口
 */
export async function getWikiIndex(categoryId: string): Promise<string> {
  const indexFile = path.join(WIKI_ROOT, categoryId, "index.md");
  try {
    return await fs.readFile(indexFile, "utf-8");
  } catch {
    return "";
  }
}

/**
 * 读取 log.md
 */
export async function getWikiLog(categoryId: string): Promise<string> {
  const logFile = path.join(WIKI_ROOT, categoryId, "log.md");
  try {
    return await fs.readFile(logFile, "utf-8");
  } catch {
    return "";
  }
}

/**
 * 更新 index.md 添加实体和主题链接
 */
export async function updateWikiIndex(
  categoryId: string,
  entities: string[],
  topics: string[]
): Promise<void> {
  const indexFile = path.join(WIKI_ROOT, categoryId, "index.md");

  const lines = ["# Wiki Index\n"];
  if (entities.length > 0) {
    lines.push("## Entities");
    for (const e of entities) {
      lines.push(`- [${e}](entities/${e}.md)`);
    }
    lines.push("");
  }
  if (topics.length > 0) {
    lines.push("## Topics");
    for (const t of topics) {
      lines.push(`- [${t}](topics/${t}.md)`);
    }
    lines.push("");
  }

  await fs.writeFile(indexFile, lines.join("\n"));
}

// ==================== Frontmatter 支持 ====================

/**
 * 解析带 frontmatter 的 Markdown 文件
 * 返回 metadata 对象和 body 内容
 */
export function parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith("---")) {
    return { metadata: {}, body: content };
  }

  const endMatch = trimmed.indexOf("\n---", 3);
  if (endMatch === -1) {
    return { metadata: {}, body: content };
  }

  const frontmatterStr = trimmed.slice(3, endMatch).trim();
  const body = trimmed.slice(endMatch + 4).trimStart();

  const metadata: Record<string, any> = {};
  for (const line of frontmatterStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: any = line.slice(colonIdx + 1).trim();

    // 解析 YAML 数组格式 (如 aliases: [a, b, c])
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1)
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    // 解析数字
    else if (/^\d+$/.test(value)) {
      value = parseInt(value, 10);
    }
    // 解析布尔
    else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

/**
 * 从 WikiPageMeta 生成 YAML frontmatter 字符串
 */
export function generateFrontmatter(meta: WikiPageMeta): string {
  const lines = [
    "---",
    `type: ${meta.type}`,
    `title: "${meta.title.replace(/"/g, '\\"')}"`,
    `categoryId: ${meta.categoryId}`,
    `aliases: [${meta.aliases.map(a => `"${a.replace(/"/g, '\\"')}"`).join(", ")}]`,
    `tags: [${meta.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]`,
    `sourceCount: ${meta.sourceCount}`,
    `createdAt: ${meta.createdAt}`,
    `updatedAt: ${meta.updatedAt}`,
    `status: ${meta.status}`,
    `confidence: ${meta.confidence}`,
    "---",
  ];
  return lines.join("\n");
}

/**
 * 生成 URL-safe 的 slug（中文名用 encodeURIComponent）
 */
function toSlug(name: string): string {
  return encodeURIComponent(name)
    .replace(/%/g, "_pct_")
    .replace(/[/?#]/g, "_");
}

/**
 * 写入带 frontmatter 的实体页面
 */
export async function upsertEntityPage(
  categoryId: string,
  slug: string,
  meta: WikiPageMeta,
  content: string
): Promise<void> {
  const frontmatter = generateFrontmatter(meta);
  const fullContent = `${frontmatter}\n\n${content}`;
  const filePath = path.join(WIKI_ROOT, categoryId, "entities", `${slug}.md`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, fullContent, "utf-8");
}

/**
 * 写入带 frontmatter 的主题页面
 */
export async function upsertTopicPage(
  categoryId: string,
  slug: string,
  meta: WikiPageMeta,
  content: string
): Promise<void> {
  const frontmatter = generateFrontmatter(meta);
  const fullContent = `${frontmatter}\n\n${content}`;
  const filePath = path.join(WIKI_ROOT, categoryId, "topics", `${slug}.md`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, fullContent, "utf-8");
}

/**
 * 读取带 frontmatter 的 Wiki 页面
 */
export async function readWikiPage(
  categoryId: string,
  type: "entity" | "topic",
  slug: string
): Promise<{ metadata: WikiPageMeta; body: string } | null> {
  const dir = type === "entity" ? "entities" : "topics";
  const filePath = path.join(WIKI_ROOT, categoryId, dir, `${slug}.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const { metadata, body } = parseFrontmatter(content);
    return { metadata: metadata as WikiPageMeta, body };
  } catch {
    return null;
  }
}

/**
 * 列出指定分类下的所有实体和主题 slug
 */
export async function listWikiPages(
  categoryId: string
): Promise<{ entities: string[]; topics: string[] }> {
  const entitiesDir = path.join(WIKI_ROOT, categoryId, "entities");
  const topicsDir = path.join(WIKI_ROOT, categoryId, "topics");

  async function listDir(dir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(f => f.endsWith(".md"))
        .map(f => f.replace(/\.md$/, ""));
    } catch {
      return [];
    }
  }

  const [entities, topics] = await Promise.all([listDir(entitiesDir), listDir(topicsDir)]);
  return { entities, topics };
}