import { WikiIngestInput, WikiIngestResult, WikiConflict, WikiPageMeta, ApiConfig } from "./types";
import {
  initWiki,
  upsertEntityPage,
  upsertTopicPage,
  updateWikiIndex,
  appendLog,
  listWikiPages,
  readWikiPage,
} from "./wiki";
import { createChatCompletionJSON, parseJSON } from "./content-generator";

/**
 * 生成 URL-safe 的 slug
 */
function toSlug(name: string): string {
  return encodeURIComponent(name)
    .replace(/%/g, "_pct_")
    .replace(/[/?#]/g, "_");
}

/**
 * 获取当前 ISO 日期字符串
 */
function nowISO(): string {
  return new Date().toISOString();
}

/**
 * AI 提取结果的实体项
 */
interface ExtractedEntity {
  name: string;
  summary: string;
  description: string;
  facts: string[];
  type?: string;
}

/**
 * AI 提取结果的主题项
 */
interface ExtractedTopic {
  name: string;
  summary: string;
  currentView: string;
  keyPoints: string[];
}

/**
 * AI 提取结果
 */
interface ExtractionResult {
  entities: ExtractedEntity[];
  topics: ExtractedTopic[];
  conflicts: WikiConflict[];
}

/**
 * 构造实体页 Markdown 内容
 */
function buildEntityMarkdown(
  entity: ExtractedEntity,
  articleTitle: string,
  articleUrl?: string
): string {
  const source = articleUrl ? `[${articleTitle}](${articleUrl})` : articleTitle;

  const lines: string[] = [
    `# ${entity.name}`,
    "",
    `> ${entity.summary}`,
    "",
    "## 核心描述",
    "",
    entity.description,
    "",
    "## 关键事实",
    "",
    ...entity.facts.map(f => `- ${f}`),
    "",
    "## 来源",
    "",
    `- ${source}`,
  ];

  return lines.join("\n");
}

/**
 * 构造主题页 Markdown 内容
 */
function buildTopicMarkdown(
  topic: ExtractedTopic,
  articleTitle: string,
  articleUrl?: string
): string {
  const source = articleUrl ? `[${articleTitle}](${articleUrl})` : articleTitle;

  const lines: string[] = [
    `# ${topic.name}`,
    "",
    `> ${topic.summary}`,
    "",
    "## 当前判断",
    "",
    topic.currentView,
    "",
    "## 关键观点",
    "",
    ...topic.keyPoints.map(p => `- ${p}`),
    "",
    "## 来源",
    "",
    `- ${source}`,
  ];

  return lines.join("\n");
}

/**
 * 构造 AI 合并提示词（当页面已存在时）
 */
function buildMergePrompt(
  name: string,
  type: "entity" | "topic",
  oldBody: string,
  newInfo: string
): string {
  return `以下是一个已有的 Wiki ${type === "entity" ? "实体" : "主题"}页面内容和新发现的补充信息。
请将新信息合并到已有内容中，保留已有内容的结构，补充新的关键事实和观点。
不要删除已有的有价值信息。

已有页面内容：
---
${oldBody}
---

新发现的补充信息：
---
${newInfo}
---

请输出合并后的完整页面 Markdown 内容（不含 frontmatter），保持与已有页面相同的章节结构，并在适当位置补充新信息。`;
}

/**
 * 核心函数：将一篇文章采集到 Wiki 知识引擎
 */
export async function ingestArticleToWiki(
  input: WikiIngestInput,
  config: ApiConfig
): Promise<WikiIngestResult> {
  const { articleId, categoryId, title, content, url, platform, publishedAt } = input;

  // 1. 确保 wiki 目录存在
  await initWiki(categoryId);

  // 2. 获取已有页面列表
  const existing = await listWikiPages(categoryId);

  // 3. 构造 AI 提取提示词
  const systemPrompt = `你是一位专业的内容分析专家和知识工程师。请从给定的文章内容中提取结构化的实体和主题信息。

请严格按以下 JSON 格式返回，不要返回任何其他内容：
{
  "entities": [
    {
      "name": "实体名称",
      "summary": "一句话摘要（20字以内）",
      "description": "核心描述（50-100字）",
      "facts": ["关键事实1", "关键事实2"],
      "type": "company/person/product/concept/other"
    }
  ],
  "topics": [
    {
      "name": "主题名称",
      "summary": "一句话摘要（20字以内）",
      "currentView": "当前判断和观点（50-100字）",
      "keyPoints": ["关键观点1", "关键观点2"]
    }
  ],
  "conflicts": []
}

要求：
1. entities：提取文章中提到的人物、组织、产品、技术、概念等具名实体
   - 每个实体必须有 name, summary, description, facts
   - facts 是从文章中提取的客观事实，每个事实一句话
   - 最多提取 8 个实体
2. topics：提取文章讨论的核心主题和趋势
   - 每个主题必须有 name, summary, currentView, keyPoints
   - currentView 是基于当前文章内容的判断和观点总结
   - 最多提取 5 个主题
3. conflicts：如果发现文章中的观点与常识或已知信息矛盾，记录冲突
   - 如果没有冲突，返回空数组
   - 冲突格式：{ "claim": "争议点", "oldView": "旧观点", "newView": "新观点", "status": "open", "sourceArticleIds": [] }`;

  const articleMeta: string[] = [
    `文章标题：${title}`,
  ];
  if (platform) articleMeta.push(`平台：${platform}`);
  if (publishedAt) articleMeta.push(`发布时间：${publishedAt}`);
  if (url) articleMeta.push(`链接：${url}`);

  const userPrompt = `${articleMeta.join("\n")}\n\n文章内容：\n${content.slice(0, 6000)}`;

  // 4. 调用 AI 提取
  const aiConfig = {
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    modelName: config.modelName,
  };

  const raw = await createChatCompletionJSON(aiConfig, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const extraction = parseJSON(raw) as ExtractionResult;
  const entities = extraction.entities || [];
  const topics = extraction.topics || [];
  const conflicts: WikiConflict[] = (extraction.conflicts || []).map((c: any) => ({
    claim: c.claim || "",
    oldView: c.oldView || "",
    newView: c.newView || "",
    status: "open" as const,
    sourceArticleIds: [articleId],
  }));

  const updatedEntities: string[] = [];
  const updatedTopics: string[] = [];
  const createdPages: string[] = [];

  // 5. 处理实体
  for (const entity of entities) {
    const slug = toSlug(entity.name);
    const isNew = !existing.entities.includes(slug);

    let markdown = buildEntityMarkdown(entity, title, url);

    // 如果页面已存在，让 AI 合并
    if (!isNew) {
      const oldPage = await readWikiPage(categoryId, "entity", slug);
      if (oldPage) {
        const newInfo = `名称: ${entity.name}\n摘要: ${entity.summary}\n描述: ${entity.description}\n新事实: ${entity.facts.join("; ")}`;
        const mergeResponse = await createChatCompletionJSON(aiConfig, [
          {
            role: "user",
            content: buildMergePrompt(entity.name, "entity", oldPage.body, newInfo),
          },
        ]);
        if (mergeResponse.trim()) {
          markdown = mergeResponse.trim();
        }
      }
    }

    const meta: WikiPageMeta = {
      type: "entity",
      title: entity.name,
      categoryId,
      aliases: [],
      tags: [entity.type || "other"].filter(Boolean),
      sourceCount: isNew ? 1 : 0, // 已存在时保留原来的计数，此处简化处理
      createdAt: isNew ? nowISO() : "",
      updatedAt: nowISO(),
      status: "active",
      confidence: "medium",
    };

    // 如果页面已存在，读取旧的 meta 保留 createdAt 和 sourceCount
    if (!isNew) {
      const oldPage = await readWikiPage(categoryId, "entity", slug);
      if (oldPage) {
        meta.createdAt = oldPage.metadata.createdAt || nowISO();
        meta.sourceCount = (oldPage.metadata.sourceCount || 0) + 1;
        meta.aliases = oldPage.metadata.aliases || [];
        meta.tags = Array.from(new Set([...(oldPage.metadata.tags || []), ...(meta.tags || [])]));
        if (oldPage.metadata.confidence === "high") {
          meta.confidence = "high";
        }
      }
    }

    await upsertEntityPage(categoryId, slug, meta, markdown);

    if (isNew) {
      createdPages.push(`entity:${entity.name}`);
    } else {
      updatedEntities.push(entity.name);
    }
  }

  // 6. 处理主题
  for (const topic of topics) {
    const slug = toSlug(topic.name);
    const isNew = !existing.topics.includes(slug);

    let markdown = buildTopicMarkdown(topic, title, url);

    // 如果页面已存在，让 AI 合并
    if (!isNew) {
      const oldPage = await readWikiPage(categoryId, "topic", slug);
      if (oldPage) {
        const newInfo = `名称: ${topic.name}\n摘要: ${topic.summary}\n当前判断: ${topic.currentView}\n新观点: ${topic.keyPoints.join("; ")}`;
        const mergeResponse = await createChatCompletionJSON(aiConfig, [
          {
            role: "user",
            content: buildMergePrompt(topic.name, "topic", oldPage.body, newInfo),
          },
        ]);
        if (mergeResponse.trim()) {
          markdown = mergeResponse.trim();
        }
      }
    }

    const meta: WikiPageMeta = {
      type: "topic",
      title: topic.name,
      categoryId,
      aliases: [],
      tags: [],
      sourceCount: isNew ? 1 : 0,
      createdAt: isNew ? nowISO() : "",
      updatedAt: nowISO(),
      status: "active",
      confidence: "medium",
    };

    // 如果页面已存在，读取旧的 meta
    if (!isNew) {
      const oldPage = await readWikiPage(categoryId, "topic", slug);
      if (oldPage) {
        meta.createdAt = oldPage.metadata.createdAt || nowISO();
        meta.sourceCount = (oldPage.metadata.sourceCount || 0) + 1;
        meta.aliases = oldPage.metadata.aliases || [];
        meta.tags = Array.from(new Set([...(oldPage.metadata.tags || []), ...(meta.tags || [])]));
        if (oldPage.metadata.confidence === "high") {
          meta.confidence = "high";
        }
      }
    }

    await upsertTopicPage(categoryId, slug, meta, markdown);

    if (isNew) {
      createdPages.push(`topic:${topic.name}`);
    } else {
      updatedTopics.push(topic.name);
    }
  }

  // 7. 更新 index.md
  const entitySet = new Set([...existing.entities, ...entities.map(e => toSlug(e.name))]);
  const topicSet = new Set([...existing.topics, ...topics.map(t => toSlug(t.name))]);
  const allEntitySlugs = Array.from(entitySet);
  const allTopicSlugs = Array.from(topicSet);
  await updateWikiIndex(categoryId, allEntitySlugs, allTopicSlugs);

  // 8. 构造日志条目
  const logEntry = `ingest | 采集自《${title}》| 新建: ${createdPages.join(", ") || "无"} | 更新实体: ${updatedEntities.join(", ") || "无"} | 更新主题: ${updatedTopics.join(", ") || "无"} | 冲突: ${conflicts.length}`;
  await appendLog(categoryId, logEntry);

  // 9. 返回结果
  return {
    updatedEntities,
    updatedTopics,
    createdPages,
    conflicts,
    logEntry,
  };
}

/**
 * 自动 ingest：取 Top N 热门文章异步触发 Wiki 采集
 * 不阻塞调用方，异常只打日志不影响主流程
 *
 * @param categoryId - 分类 ID
 * @param topN - 取前 N 篇（按 likes 降序），默认 5
 */
export async function autoIngestTopArticles(
  categoryId: string,
  topN: number = 5
): Promise<void> {
  try {
    const { getArticles, getDefaultApiConfig } = await import("./db");

    const apiConfig = await getDefaultApiConfig();
    if (!apiConfig) {
      console.warn("[autoIngest] No API config, skipping auto-ingest");
      return;
    }

    const { articles } = await getArticles({ categoryId, pageSize: topN, keywordId: undefined });
    // Sort by likes descending, take topN
    const topArticles = articles
      .sort((a, b) => b.likes - a.likes)
      .slice(0, topN);

    if (topArticles.length === 0) {
      console.log("[autoIngest] No articles to ingest for category:", categoryId);
      return;
    }

    console.log(`[autoIngest] Starting auto-ingest for ${topArticles.length} articles in category ${categoryId}`);

    // Process articles sequentially to avoid overwhelming the AI API
    for (const article of topArticles) {
      try {
        const input: WikiIngestInput = {
          articleId: article.id,
          categoryId,
          title: article.title,
          content: article.content,
          url: article.url,
          platform: article.platform,
          publishedAt: article.publishedAt
            ? new Date(article.publishedAt).toISOString()
            : undefined,
        };

        const result = await ingestArticleToWiki(input, apiConfig);
        console.log(
          `[autoIngest] Article "${article.title}" ingested: ${result.createdPages.length} created, ${result.updatedEntities.length} entities, ${result.updatedTopics.length} topics`
        );
      } catch (err) {
        console.error(`[autoIngest] Failed to ingest article "${article.title}":`, err);
        // Continue with next article
      }
    }

    console.log(`[autoIngest] Completed auto-ingest for category ${categoryId}`);
  } catch (err) {
    console.error("[autoIngest] Fatal error in autoIngestTopArticles:", err);
  }
}
