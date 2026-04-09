import { NextRequest, NextResponse } from "next/server";
import { getWikiIndex } from "@/lib/wiki";
import { WikiIndexItem } from "@/lib/types";

interface IndexEntry {
  type: "entity" | "topic";
  title: string;
  slug: string;
  summary: string;
  updatedAt: string;
  sourceCount: number;
}

/**
 * 解析 index.md 中的条目
 */
function parseIndexEntries(indexContent: string): {
  entities: IndexEntry[];
  topics: IndexEntry[];
} {
  const entities: IndexEntry[] = [];
  const topics: IndexEntry[] = [];

  const lines = indexContent.split("\n");
  let currentSection: "entities" | "topics" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // 识别 section header
    if (trimmed === "## Entities") {
      currentSection = "entities";
      continue;
    }
    if (trimmed === "## Topics") {
      currentSection = "topics";
      continue;
    }
    // 遇到其他 ## 标题则重置
    if (trimmed.startsWith("## ") && trimmed !== "## Entities" && trimmed !== "## Topics") {
      currentSection = null;
      continue;
    }

    if (!trimmed.startsWith("- [") || !currentSection) continue;

    // 格式: - [title](entities/slug.md) - summary | 更新: date | 来源: count
    const linkMatch = trimmed.match(
      /^-\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:-\s*(.*))?/
    );
    if (!linkMatch) continue;

    const title = linkMatch[1];
    const rawPath = linkMatch[2];
    const rest = linkMatch[3] || "";

    let type: "entity" | "topic";
    let slug: string;

    if (rawPath.startsWith("entities/")) {
      type = "entity";
      slug = rawPath.replace("entities/", "").replace(".md", "");
    } else if (rawPath.startsWith("topics/")) {
      type = "topic";
      slug = rawPath.replace("topics/", "").replace(".md", "");
    } else {
      type = currentSection === "entities" ? "entity" : "topic";
      slug = rawPath.replace(".md", "");
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

    const entry: IndexEntry = {
      type,
      title,
      slug,
      summary,
      updatedAt,
      sourceCount,
    };

    if (type === "entity") {
      entities.push(entry);
    } else {
      topics.push(entry);
    }
  }

  return { entities, topics };
}

/**
 * GET /api/wiki/index?categoryId=ai
 * 返回结构化的 entities 和 topics 列表
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  if (!categoryId) {
    return NextResponse.json(
      { code: 400, msg: "categoryId required" },
      { status: 400 }
    );
  }

  try {
    const indexContent = await getWikiIndex(categoryId);

    if (!indexContent) {
      return NextResponse.json({
        code: 0,
        data: { entities: [], topics: [] },
      });
    }

    const { entities, topics } = parseIndexEntries(indexContent);

    return NextResponse.json({
      code: 0,
      data: { entities, topics },
    });
  } catch (error) {
    console.error("Error reading wiki index:", error);
    return NextResponse.json(
      { code: 500, msg: "读取 Wiki 索引失败" },
      { status: 500 }
    );
  }
}
