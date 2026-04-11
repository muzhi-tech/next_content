import { WikiIndexItem, AIConfig } from "./types";
import { getWikiIndex, readWikiPage, appendLog } from "./wiki";
import { createChatCompletionJSON, parseJSON } from "./content-generator";

/**
 * 解析 index.md 中的条目列表
 * 条目格式: - [{title}](path) - {summary} | 更新: {date} | 来源: {count}
 */
function parseIndexItems(indexContent: string): WikiIndexItem[] {
  const items: WikiIndexItem[] = [];
  const lines = indexContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- [")) continue;

    // 格式: - [title](path) - summary | 更新: date | 来源: count
    const linkMatch = trimmed.match(
      /^-\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:-\s*(.*))?/
    );
    if (!linkMatch) continue;

    const title = linkMatch[1];
    const rawPath = linkMatch[2];
    const rest = linkMatch[3] || "";

    // 从路径提取 type 和 slug
    // entities/slug.md => type=entity, slug=slug
    // topics/slug.md => type=topic, slug=slug
    let type: "entity" | "topic" = "entity";
    let slug = rawPath;

    if (rawPath.startsWith("entities/")) {
      type = "entity";
      slug = rawPath.replace("entities/", "").replace(".md", "");
    } else if (rawPath.startsWith("topics/")) {
      type = "topic";
      slug = rawPath.replace("topics/", "").replace(".md", "");
    }

    // 解析 summary | 更新: date | 来源: count
    let summary = "";
    let updatedAt = "";
    let sourceCount = 0;

    const parts = rest.split("|").map((s) => s.trim());
    if (parts.length >= 1) {
      summary = parts[0].trim();
    }
    for (const part of parts) {
      if (part.startsWith("更新:") || part.startsWith("更新：")) {
        updatedAt = part.replace(/^更新[:：]\s*/, "").trim();
      }
      if (part.startsWith("来源:") || part.startsWith("来源：")) {
        sourceCount = parseInt(
          part.replace(/^来源[:：]\s*/, "").trim(),
          10
        );
        if (isNaN(sourceCount)) sourceCount = 0;
      }
    }

    items.push({ type, title, slug, summary, updatedAt, sourceCount });
  }

  return items;
}

/**
 * 解析 index.md，按关键词模糊匹配 title/summary，返回匹配的 WikiIndexItem[]
 */
export async function searchWikiIndex(
  categoryId: string,
  query: string
): Promise<WikiIndexItem[]> {
  const indexContent = await getWikiIndex(categoryId);
  if (!indexContent) return [];

  const items = parseIndexItems(indexContent);
  const lowerQuery = query.toLowerCase();

  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.summary.toLowerCase().includes(lowerQuery)
  );
}

/**
 * 根据主题和关键词，用 AI 从候选列表中选取最相关的 3-5 个页面 slug
 */
export async function resolveRelevantWikiPages(
  categoryId: string,
  topic: string,
  config: AIConfig,
  keywords?: string[]
): Promise<string[]> {
  // 获取所有候选项（使用空 query 获取全部，或者直接解析 index）
  const indexContent = await getWikiIndex(categoryId);
  if (!indexContent) return [];

  const allItems = parseIndexItems(indexContent);

  // 如果没有条目，直接返回空
  if (allItems.length === 0) return [];

  // 先做关键词预筛选
  let candidates = allItems;
  const searchTerms = [topic, ...(keywords || [])].filter(Boolean);

  if (searchTerms.length > 0) {
    const lowerTerms = searchTerms.map((t) => t.toLowerCase());
    candidates = allItems.filter(
      (item) =>
        lowerTerms.some(
          (term) =>
            item.title.toLowerCase().includes(term) ||
            item.summary.toLowerCase().includes(term) ||
            item.slug.toLowerCase().includes(term)
        )
    );
    // 如果筛选后为空，回退到全部条目（取前 15 个）
    if (candidates.length === 0) {
      candidates = allItems.slice(0, 15);
    }
  }

  // 如果候选 <= 5 个，直接返回
  if (candidates.length <= 5) {
    return candidates.map((c) => c.slug);
  }

  // 超过 5 个，用 AI 选取最相关的
  const candidateList = candidates
    .map((c, i) => `${i + 1}. [${c.type}] ${c.title}: ${c.summary}`)
    .join("\n");

  const systemPrompt = `你是一个知识库检索助手。根据给定的主题和关键词，从候选列表中选出最相关的 3-5 个条目。
请严格按 JSON 数组格式返回被选中条目的编号（序号），不要返回其他内容。
示例: [1, 3, 5]`;

  const userPrompt = `主题: ${topic}${keywords?.length ? `\n关键词: ${keywords.join(", ")}` : ""}

候选列表:
${candidateList}

请选出最相关的 3-5 个条目编号:`;

  try {
    const raw = await createChatCompletionJSON(
      {
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
      },
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]
    );

    const indices = parseJSON(raw) as number[];
    if (!Array.isArray(indices)) {
      // 解析失败，取前 5 个
      return candidates.slice(0, 5).map((c) => c.slug);
    }

    return indices
      .filter((i) => i >= 1 && i <= candidates.length)
      .slice(0, 5)
      .map((i) => candidates[i - 1].slug);
  } catch {
    // AI 调用失败，取前 5 个
    return candidates.slice(0, 5).map((c) => c.slug);
  }
}

/**
 * 读取相关页面内容，拼接为结构化上下文字符串供 AI 使用
 */
export async function buildWikiContext(
  categoryId: string,
  topic: string,
  config: AIConfig,
  keywords?: string[]
): Promise<string> {
  const slugs = await resolveRelevantWikiPages(
    categoryId,
    topic,
    config,
    keywords
  );

  if (slugs.length === 0) return "";

  const sections: string[] = [
    "## Wiki 知识库上下文（以下是从知识库中检索到的相关信息）",
    "",
  ];

  for (const slug of slugs) {
    // 尝试 entity 和 topic 两种类型
    const page =
      (await readWikiPage(categoryId, "entity", slug)) ||
      (await readWikiPage(categoryId, "topic", slug));

    if (!page) continue;

    const typeLabel =
      page.metadata.type === "entity" ? "实体" : "主题";
    sections.push(`### ${typeLabel}: ${page.metadata.title}`);
    sections.push(page.body);
    sections.push("");
  }

  // 追加 log
  try {
    await appendLog(
      categoryId,
      `wiki-query | 检索上下文: topic="${topic}", 命中 ${slugs.length} 个页面`
    );
  } catch {
    // 日志写入失败不影响主流程
  }

  return sections.join("\n");
}
