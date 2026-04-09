import { WikiLintIssue, WikiPageMeta } from "./types";
import { listWikiPages, getWikiIndex, readWikiPage, parseFrontmatter } from "./wiki";
import { promises as fs } from "fs";
import path from "path";

const WIKI_ROOT = path.join(process.cwd(), "data", "wiki");

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * 检测孤立页面（未被 index.md 引用的页面）
 */
export async function detectOrphanPages(
  categoryId: string
): Promise<WikiLintIssue[]> {
  const issues: WikiLintIssue[] = [];

  const [pageList, indexContent] = await Promise.all([
    listWikiPages(categoryId),
    getWikiIndex(categoryId),
  ]);

  // 收集 index.md 中引用的 slug
  const referencedSlugs = new Set<string>();
  const linkPattern = /\[([^\]]+)\]\((?:entities|topics)\/([^)]+)\.md\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(indexContent)) !== null) {
    referencedSlugs.add(match[2]);
  }

  // 实体中的孤立页
  for (const slug of pageList.entities) {
    if (!referencedSlugs.has(slug)) {
      issues.push({
        severity: "high",
        page: `entities/${slug}`,
        message: "未被 index.md 引用",
        suggestion: "补充到索引或删除",
      });
    }
  }

  // 主题中的孤立页
  for (const slug of pageList.topics) {
    if (!referencedSlugs.has(slug)) {
      issues.push({
        severity: "high",
        page: `topics/${slug}`,
        message: "未被 index.md 引用",
        suggestion: "补充到索引或删除",
      });
    }
  }

  return issues;
}

/**
 * 检测标题相似的重复页面
 */
export async function detectDuplicatePages(
  categoryId: string
): Promise<WikiLintIssue[]> {
  const issues: WikiLintIssue[] = [];
  const pageList = await listWikiPages(categoryId);

  interface PageTitleInfo {
    slug: string;
    type: "entity" | "topic";
    title: string;
    aliases: string[];
  }

  const allPages: PageTitleInfo[] = [];

  // 收集所有页面的 title 和 aliases
  for (const slug of pageList.entities) {
    const page = await readWikiPage(categoryId, "entity", slug);
    if (page) {
      allPages.push({
        slug,
        type: "entity",
        title: page.metadata.title || slug,
        aliases: (page.metadata.aliases as string[]) || [],
      });
    }
  }

  for (const slug of pageList.topics) {
    const page = await readWikiPage(categoryId, "topic", slug);
    if (page) {
      allPages.push({
        slug,
        type: "topic",
        title: page.metadata.title || slug,
        aliases: (page.metadata.aliases as string[]) || [],
      });
    }
  }

  // 归一化函数：去掉空格和标点后比较
  function normalize(s: string): string {
    return s
      .replace(/[\s\u3000.,!?;:'"()（）、。，！？；：""'']/g, "")
      .toLowerCase();
  }

  // 检查两个字符串是否相似
  function isSimilar(a: string, b: string): boolean {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    // 完全相同
    if (na === nb) return true;
    // 一个包含另一个
    if (na.includes(nb) || nb.includes(na)) return true;
    return false;
  }

  // 两两比较（只比较 title）
  const reported = new Set<string>();
  for (let i = 0; i < allPages.length; i++) {
    for (let j = i + 1; j < allPages.length; j++) {
      const a = allPages[i];
      const b = allPages[j];
      const key = `${a.type}/${a.slug}||${b.type}/${b.slug}`;

      if (reported.has(key)) continue;

      if (isSimilar(a.title, b.title)) {
        reported.add(key);
        issues.push({
          severity: "medium",
          page: `${a.type}/${a.slug}`,
          message: `标题与 ${b.type}/${b.slug} ("${b.title}") 相似`,
          suggestion: "考虑合并或区分标题",
        });
      }
    }
  }

  return issues;
}

/**
 * 检测过时声明（长期未更新、草稿状态、未解决冲突）
 */
export async function detectStaleClaims(
  categoryId: string
): Promise<WikiLintIssue[]> {
  const issues: WikiLintIssue[] = [];
  const pageList = await listWikiPages(categoryId);

  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  async function checkPages(
    slugs: string[],
    type: "entity" | "topic"
  ): Promise<void> {
    for (const slug of slugs) {
      const page = await readWikiPage(categoryId, type, slug);
      if (!page) continue;

      const meta = page.metadata;
      const pagePath = `${type}s/${slug}`;

      // updatedAt 超过 7 天
      if (meta.updatedAt) {
        const updatedTime = new Date(meta.updatedAt).getTime();
        if (!isNaN(updatedTime) && now - updatedTime > SEVEN_DAYS_MS) {
          issues.push({
            severity: "low",
            page: pagePath,
            message: "长期未更新（超过 7 天）",
            suggestion: "检查内容是否需要更新",
          });
        }
      }

      // 草稿状态
      if (meta.status === "draft") {
        issues.push({
          severity: "medium",
          page: pagePath,
          message: "仍为草稿状态",
          suggestion: "完善内容后激活",
        });
      }

      // body 中有未解决的冲突块
      if (page.body && page.body.includes('status: "open"')) {
        issues.push({
          severity: "high",
          page: pagePath,
          message: "有未解决冲突",
          suggestion: "审查并解决冲突内容",
        });
      }
    }
  }

  await Promise.all([
    checkPages(pageList.entities, "entity"),
    checkPages(pageList.topics, "topic"),
  ]);

  return issues;
}

/**
 * 完整的 Wiki 健康检查
 * 依次检测孤立页面、重复页面、过时声明，合并结果按 severity 排序
 */
export async function lintWiki(
  categoryId: string
): Promise<WikiLintIssue[]> {
  const [orphans, duplicates, stale] = await Promise.all([
    detectOrphanPages(categoryId),
    detectDuplicatePages(categoryId),
    detectStaleClaims(categoryId),
  ]);

  const all = [...orphans, ...duplicates, ...stale];

  all.sort((a, b) => {
    const orderA = SEVERITY_ORDER[a.severity] ?? 99;
    const orderB = SEVERITY_ORDER[b.severity] ?? 99;
    return orderA - orderB;
  });

  return all;
}
