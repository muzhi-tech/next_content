import { NextRequest, NextResponse } from "next/server";
import { getArticles, getDefaultApiConfig, addReport } from "@/lib/db";
import { getWikiIndex } from "@/lib/wiki";
import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";

interface ReportTopic {
  title: string;
  why: string;
  boom: string;
  growth: string;
}

interface Report {
  id: string;
  categoryId: string;
  createdAt: string;
  date: string;
  summary: string;
  topics: ReportTopic[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${month}月${day}日 (今日)`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId } = body;

    if (!categoryId) {
      return NextResponse.json(
        { code: 400, msg: "缺少 categoryId" },
        { status: 400 }
      );
    }

    // 1. 加载该分类下的最近 50 篇文章
    const { articles } = await getArticles({ categoryId, pageSize: 50 });

    if (articles.length === 0) {
      return NextResponse.json(
        { code: 400, msg: "该分类下暂无文章，无法生成报告" },
        { status: 400 }
      );
    }

    // 2. 读取 Wiki 索引作为补充上下文
    let wikiContext = "";
    try {
      const wikiIndex = await getWikiIndex(categoryId);
      if (wikiIndex) {
        wikiContext = `\n\n## 已有知识库索引\n${wikiIndex}`;
      }
    } catch {
      // Wiki 不存在时忽略
    }

    // 3. 获取默认 API 配置
    const apiConfig = await getDefaultApiConfig();
    if (!apiConfig) {
      return NextResponse.json(
        { code: 400, msg: "未配置 AI API，请先在设置中添加 API 配置" },
        { status: 400 }
      );
    }

    // 4. 构建文章摘要
    const articleSummaries = articles
      .map(
        (a, i) =>
          `${i + 1}. [${a.platform}] ${a.title} (赞${a.likes} 评${a.comments})`
      )
      .join("\n");

    // 5. 调用 AI 生成报告
    const systemPrompt = `你是一位资深的自媒体内容策略分析师，擅长从海量内容中发现趋势、挖掘选题机会。

请根据提供的文章数据进行分析，生成一份选题分析报告。

请严格按以下 JSON 格式返回，不要返回任何其他内容：
{
  "summary": "整体趋势研判（1-2句话，概括当前内容生态的趋势和机会）",
  "topics": [
    {
      "title": "选题标题",
      "why": "为什么这个选题值得写（2-3句话，从趋势、受众、差异化角度分析）",
      "boom": "爆款潜力分析（2-3句话，分析这个选题的传播潜力和爆款可能）",
      "growth": "增长与变现策略（2-3句话，提供涨粉、引流、变现的具体建议）"
    }
  ]
}

要求：
1. 推荐 2-3 个高价值选题
2. 每个选题必须从 why/boom/growth 三个维度深入分析
3. 分析要具体、可落地，避免空泛的套话
4. 结合已有知识库索引（如有）进行交叉分析`;

    const userPrompt = `## 文章数据（共 ${articles.length} 篇）

${articleSummaries}
${wikiContext}`;

    const raw = await createChatCompletionJSON(
      {
        apiUrl: apiConfig.apiUrl,
        apiKey: apiConfig.apiKey,
        modelName: apiConfig.modelName,
      },
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]
    );

    const parsed = parseJSON(raw) as {
      summary: string;
      topics: ReportTopic[];
    };

    // 6. 组装报告
    const report: Report = {
      id: generateId(),
      categoryId,
      createdAt: new Date().toISOString(),
      date: formatDate(),
      summary: parsed.summary || "",
      topics: parsed.topics || [],
    };

    // 7. 持久化到数据库
    await addReport({
      id: report.id,
      categoryId: report.categoryId,
      createdAt: report.createdAt,
      summary: report.summary,
      topics: report.topics,
    });

    return NextResponse.json({ code: 0, data: report });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      {
        code: 500,
        msg:
          "报告生成失败: " +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
