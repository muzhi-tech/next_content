# 内容生产矩阵设计文档

## 一、概述

内容生产矩阵是 next_content 平台的 AI 驱动内容创作模块，集成自 Auto-wechat-writing 项目。支持生成公众号正文、标题摘要、封面图提示词，采用流式输出实现打字机效果。

## 二、核心功能

### 2.1 文章生成 (SSE 流式)
- 输入：主题、风格、关键词、长度
- 输出：流式正文内容
- 技术：Server-Sent Events (SSE)

### 2.2 标题摘要生成
- 输入：文章内容
- 输出：5 组标题+摘要
- 风格多样：疑问句、数字型、反差型

### 2.3 封面图提示词生成
- 输入：文章主题
- 输出：适合 AI 画图的提示词

## 三、写作风格模板

### 3.1 风格列表

| ID | 名称 | 描述 |
|----|------|------|
| tech | 科技媒体评论 | 犀利洞察，技术对认知的影响 |
| business | 商业财经 | 专业分析，数据驱动 |
| lifestyle | 生活美学 | 温暖治愈，生活方式 |
| news | 新闻资讯 | 客观准确，快速响应 |

### 3.2 风格模板结构

```typescript
interface WritingStyle {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;    // AI 系统提示词
  userPromptTemplate: string; // 用户提示词模板
}
```

## 四、知识引擎：LLM Wiki 架构集成 (新增)

为了支撑卡兹克方法论中“有见识”、“自然升维”、“知识随手掏”的要求，我们放弃了传统的阅后即焚式 RAG（检索增强生成），引入了 **LLM Wiki** 模式作为底层的知识沉淀引擎。

### 4.1 架构映射

| LLM Wiki 概念 | 本系统 (next_content) 实现 | 存储位置 |
|--------------|---------------------------|----------|
| **Raw Sources (原始来源)** | 每日通过 API 抓取的各平台热门文章 | `data/db.json` 中的 `articles` 表 |
| **The Wiki (维基库)** | AI 自动维护的 Markdown 实体、主题卡片 | `data/wiki/{categoryId}/` 目录下 |
| **The Schema (模式约定)** | 卡兹克写作规范与本设计文档 | `CLAUDE.md` 与本文件 |

### 4.2 核心运作流程 (Operations)

1. **Ingest (知识摄入 - 每日定时/手动触发)**
   - 当抓取到一批新文章后，AI 后台读取这些内容。
   - AI 提取实体（公司、人物、概念）和主题（如：AI 封杀事件），在 `data/wiki/{categoryId}/entities/` 或 `topics/` 中创建或**更新**对应的 Markdown 文件。
   - 找出新旧观点的冲突（如：某公司昨日裁员，今日辟谣），记录在对应卡片中。
   - 更新 `index.md`（目录）并向 `log.md`（流水账）追加一条记录。

2. **Query (知识调用 - 生成卡兹克长文时)**
   - 用户输入主题：`"聊聊大模型近期的封闭化趋势"`。
   - 系统**不直接**去搜那 100 篇乱七八糟的原始文章，而是让 AI 先读取 `index.md`，定位到 `topics/大模型封闭化.md` 和 `entities/OpenClaw.md`。
   - AI 基于这些已经高度提纯、交叉验证过的 Wiki 页面，结合卡兹克风格的 `System Prompt`，生成一篇深度、准确、充满关联性的爆款文章。

3. **Lint (维基健康检查 - 每周定时)**
   - AI 自动扫描 Wiki 文件夹，清理孤立页面，合并重复概念。

### 4.3 目录结构示例
```text
data/wiki/{categoryId}/
├── index.md        # 核心目录：所有实体和主题的索引及一句话摘要
├── log.md          # 时序日志：记录 AI 哪天摄入了什么文章
├── entities/       # 实体卡片（人物、公司、产品等）
│   ├── OpenAI.md
│   └── 豆包手机.md
└── topics/         # 主题卡片（事件脉络、行业趋势等）
    └── AI_闭源趋势分析.md
```

## 五、API 设计

### 4.1 POST /api/content/generate

生成文章正文（SSE 流式）

**Request:**
```typescript
{
  topic: string;           // 主题
  style: string;           // 风格：tech/business/lifestyle/news
  keywords?: string[];     // 关键词
  length?: "short" | "medium" | "long"; // 文章长度
  apiUrl?: string;         // AI API 地址（可选，使用配置）
  apiKey?: string;         // AI API Key（可选，使用配置）
  modelName?: string;      // 模型名称（可选，使用配置）
}
```

**Response (SSE):**
```
data: {"content": "首段内容"}

data: {"content": "后续内容"}

data: [DONE]
```

### 4.2 POST /api/content/titles

生成标题和摘要

**Request:**
```typescript
{
  article: string;         // 文章内容
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}
```

**Response:**
```typescript
{
  code: 0,
  data: [
    { title: "标题1", summary: "摘要1" },
    { title: "标题2", summary: "摘要2" },
    { title: "标题3", summary: "摘要3" },
    { title: "标题4", summary: "摘要4" },
    { title: "标题5", summary: "摘要5" }
  ]
}
```

### 4.3 POST /api/content/cover

生成封面图提示词

**Request:**
```typescript
{
  topic: string;           // 主题
  style?: string;          // 风格
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}
```

**Response:**
```typescript
{
  code: 0,
  data: {
    prompt: "封面图提示词",
    negativePrompt: "负面提示词"
  }
}
```

## 五、数据流

```
用户输入主题 → 选择风格 → API 调用 → SSE 流式输出 → 前端打字机展示
                              ↓
                         生成正文
                              ↓
                         生成标题摘要（可选）
                              ↓
                         生成封面提示词（可选）
```

## 六、与现有系统集成

### 6.1 利用已有数据
- 关键词监控数据 → 热门话题提取
- 已有文章 → 竞品分析、关键词注入
- 平台数据 → 内容方向参考

### 6.2 SettingsTab 集成
在监控设置页面添加"内容生产"区块：
- 风格选择
- 主题输入
- 一键生成
- 预览编辑

## 七、技术要点

### 7.1 SSE 流式输出
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
```

### 7.2 OpenAI 兼容接口
支持 GPT/Gemini/DeepSeek/Claude 等 OpenAI 兼容 API

### 7.3 风格隔离
每个风格是独立的 prompt 模板，便于维护和扩展

## 八、文件结构

```
src/
├── app/api/content/
│   ├── generate/route.ts    # 文章生成 API
│   ├── titles/route.ts      # 标题摘要 API
│   └── cover/route.ts       # 封面提示词 API
├── lib/
│   ├── content-generator.ts # 内容生成核心逻辑
│   └── styles/
│       ├── index.ts         # 风格导出
│       ├── tech.ts          # 科技风格
│       ├── business.ts      # 商业风格
│       ├── lifestyle.ts     # 生活风格
│       └── news.ts          # 新闻风格
└── components/
    └── SettingsTab.tsx      # 更新：添加内容生产区块
```

## 九、LLM Wiki 与卡兹克方法论落地规划 (Roadmap)

为了将上述设计转化为实际可运行的功能，制定以下三阶段落地规划：

### 阶段一：基础 Wiki 摄入测试 (当前重点)
- **UI 改造**：在“采集内容 Tab”中，为每篇抓取到的文章新增一个 **“提取到 Wiki (Ingest)”** 的操作按钮。
- **功能实现**：点击后，触发后端 API，调用 LLM 读取该文章内容，提取核心实体与观点。
- **存储落地**：调用 `src/lib/wiki.ts` 的相关方法，在 `data/wiki/{categoryId}/` 目录下生成/更新 `.md` 文件，并更新 `index.md` 和 `log.md`。

### 阶段二：生成侧链路打通 (Query & Generate)
- **上下文组装**：在“选题分析与报告 Tab”或生成文章时，不再让 AI“裸写”，而是先检索对应分类下的 `index.md`。
- **卡兹克 Prompt 融合**：如果用户选择了“卡兹克深度长文”风格，在发送给 LLM 的最终 Prompt 中，强制拼接由 Wiki 提供的高纯度背景知识（`topics` 或 `entities` 内容）。
- **质量验收**：通过真实生成的一篇文章，检验是否符合 HKR 模型及 L1-L4 的活人感标准。

### 阶段三：全自动化闭环 (Auto Ingest & Lint)
- **自动摄入**：将“提取到 Wiki”从手动点击升级为定时任务。每次爬虫完成抓取后，自动将 Top 10 的热门文章交由 AI 增量摄入。
- **维基健康检查**：开发一个后台脚本，每周执行一次 `Lint` 操作，让 AI 自动清理无效词条、合并相似主题，保持知识库的高密度与高质量。

## 八、多智能体协同：自进化内容生产流 (Multi-Agent Workflow)

为了实现“数据反哺、自动进化、质量越来越高”的目标，系统采用 **多智能体协同 (Multi-Agent System)** 架构，将流水线拆分为 8 个职责明确的专业 Agent，彻底将单向的生成转变为闭环的自我迭代过程。

### 8.1 核心 Agent 矩阵与职责

1. **采集 Agent (Collection Agent)**
   - **职责**：输入源的抓取与风格克隆（初始化）。
   - **工作流**：读取为每个发布账号独立创建的本地文件夹（如 `data/accounts/xiaohongshu_tech/raw/`）。大模型自动分析其中的历史爆款、参考链接和文档，提取语感、高频词汇和叙事结构，自动生成该账号专属的“基因库”文件（`风格指南.md`、`范文样本.md`、`负面约束.md`）。

2. **选题 Agent (Topic Agent)**
   - **职责**：灵感发现与方向把控。
   - **工作流**：基于该账号的风格指南、近期采集的热门话题以及 LLM Wiki 知识库，主动提供一批高潜力的选题。提交给人工确认（Human-in-the-loop）后，生成详细大纲。

3. **写作 Agent (Writing Agent)**
   - **职责**：内容骨架与初稿撰写。
   - **工作流**：根据确认的大纲，结合 LLM Wiki 中的背景知识，填充血肉，撰写初稿，并强制注入该账号特有的故事、隐喻和情绪点。

4. **打分 Agent (Scoring Agent)**
   - **职责**：内部质量控制与自我进化闭环。
   - **工作流**：根据预设的质量模型（如 HKR 模型、人设符合度）对初稿进行 0-100 分评估。低于设定阈值（如 80 分），则附带具体修改意见打回给 **写作 Agent** 重写；多次未达标则输出诊断报告转交人工审核。

5. **去 AI 化 Agent (De-AI Agent)**
   - **职责**：文本洗稿，消除机器生成痕迹（“伪人感”清洗）。
   - **清洗规则**：
     - **消灭 em-dash 阴谋**：去除泛滥的长破折号（“——”），恢复自然连接与节奏。
     - **抑制“欢快而正式”语调**：删除“exciting”、“remarkable”等假嗨词汇，适配真实人类的情绪起伏。
     - **打破模板化结构**：粉碎“Firstly... In conclusion”、“On one hand... On the other hand”等八股文逻辑连接。
     - **消除模糊表达**：去除“may”、“could”、“it is believed that”等免责声明，建立明确立场与锋芒。
     - **降级高级词汇**：替换“delve into”、“leverage”、“pivotal”、“underscore”等 AI 高频装逼词汇。
     - **纠正拟人化错位**：删除生硬的物品拟人（如“记住我梦想的笔记本”），确保语境真实贴地。

6. **审核 Agent (Compliance Agent)**
   - **职责**：合规性与红线安全把控。
   - **审核规则**：
     - **红线检测**：扫描涉政、黄赌毒、传销、虚假宣传、极限词（“最”、“绝对”）。
     - **免责审查**：确保医疗、金融、法律等高危领域的 claims 客观准确，无夸大成分。
     - **平台特定规范**：针对微信公众号、小红书、抖音等特定平台的广告合规性、诱导性表述、AI 生成标识要求进行排查。
     - **处理机制**：轻微违规给出修改建议并退回，严重违规直接拦截并警报。

7. **配图 Agent (Image Agent)**
   - **职责**：多模态视觉生成与匹配。
   - **工作流**：阅读审核通过的最终成文，提取视觉线索，生成 1 张吸睛封面图和 2-3 张与上下文紧密贴合的文中插图。

8. **发布 Agent (Publishing Agent)**
   - **职责**：多渠道分发与触达。
   - **工作流**：获取最终图文包，自动适配不同平台（微信公众号、小红书等）的排版与标签格式，执行定时或立即发布任务。

### 8.2 闭环自进化流程图

```text
┌─────────────────┐
│ 1. 采集 Agent   │ ──(提取基因)──> 风格文件 (指南/样本/约束)
└─────────────────┘
         │
┌─────────────────┐
│ 2. 选题 Agent   │ ──(提报大纲)──> [ 人工确认 Human-in-the-loop ]
└─────────────────┘
         │
┌─────────────────┐      ╭────────────────────────────────╮
│ 3. 写作 Agent   │ <────┤ 4. 打分 Agent (低于80分打回重写) │
└─────────────────┘      ╰────────────────────────────────╯
         │ (≥80分进入清洗)
┌─────────────────┐
│ 5. 去 AI 化 Agent│ ──(洗去机械感/八股文/高级词)
└─────────────────┘
         │
┌─────────────────┐
│ 6. 审核 Agent   │ ──(涉政/违规/极限词拦截)
└─────────────────┘
         │ (安全通过)
┌─────────────────┐
│ 7. 配图 Agent   │ ──(封面+2~3张插图)
└─────────────────┘
         │
┌─────────────────┐
│ 8. 发布 Agent   │ ──(全网多平台分发)
└─────────────────┘
```

### 8.3 模型路由配置 (Model Routing)

由于不同 Agent 的核心诉求不同（逻辑推理 vs 图像生成），系统在调用大模型时采用差异化的路由策略，统一通过 `302.ai` 接口聚合层进行中转：

- **统一 API Base URL**: `https://api.302.ai/v1/`
- **统一 API Key**: 采用系统统一配置密钥。

#### 1. 文本处理模型 (文案大模型)
- **指定模型**: `claude-sonnet-4-6` (推测对应 Claude 3.5/3.7 Sonnet 系列的超强逻辑模型)
- **适用 Agent**: 采集 Agent、选题 Agent、写作 Agent、打分 Agent、去 AI 化 Agent、审核 Agent。
- **选择理由**: 这 6 个环节涉及大量的风格克隆、零样本学习（Zero-shot）、严格的指令遵循（如清洗 em-dash、强行去除模板化结构），Claude 系列在这些长文本处理和“反机器感”的自然语言模拟上表现极具优势。

#### 2. 多模态生成模型 (配图大模型)
- **指定模型**: `gemini-3.1-flash-image-preview`
- **适用 Agent**: 配图 Agent。
- **选择理由**: Gemini Flash 的最新图像预览模型具备优秀的上下文理解与跨模态生成能力，能够根据文章的意境、主题以及对标人物，直接生成符合要求的封面及文中配图。

## 十、可直接开发的模块拆解清单

### 10.1 P0：Wiki 最小闭环
- `src/lib/wiki.ts`：目录初始化、页面读写、`index.md` 更新、`log.md` 追加。
- `src/lib/wiki-ingest.ts`：单篇文章 ingest，抽取实体、主题、观点、冲突并落库。
- `src/app/api/wiki/ingest/route.ts`：提供“提取到 Wiki”接口。
- `src/components/ContentTab.tsx`：增加“提取到 Wiki”按钮与状态反馈。

### 10.2 P1：生成链路接入 Wiki
- `src/lib/wiki-query.ts`：读取 `index.md`，解析相关 `topics` 与 `entities`。
- `src/lib/content-generator.ts`：生成前组装 Wiki 上下文，替代裸 prompt。
- `src/app/api/content/generate/route.ts`：新增 `categoryId`、`useWiki`、`wikiMode` 参数。
- `src/components/ContentProductionTab.tsx`：增加分类选择、Wiki 开关、命中页展示。

### 10.3 P2：Wiki 治理与观测
- `src/lib/wiki-lint.ts`：检测孤立页、重复页、过时结论、缺失交叉引用。
- `src/app/api/wiki/lint/route.ts`：手动或定时触发健康检查。
- `src/app/api/wiki/index/route.ts`：读取 index 概览。
- `src/components/ReportTab.tsx`：展示最近变更、健康检查结果与推荐修复项。

### 10.4 P3：多智能体流水线
- `src/lib/agents/topic-agent.ts`：选题与大纲。
- `src/lib/agents/writing-agent.ts`：初稿撰写。
- `src/lib/agents/scoring-agent.ts`：质量打分与退回重写。
- `src/lib/agents/de-ai-agent.ts`：去 AI 化清洗。
- `src/lib/agents/compliance-agent.ts`：合规审查。
- `src/lib/agents/image-agent.ts`：封面与配图生成。
- `src/lib/agents/publishing-agent.ts`：多平台发布。
- `src/lib/agent-workflow.ts`：统一编排状态流转。

## 十一、Wiki 数据结构与页面模板规范

### 11.1 目录规范
```text
data/wiki/{categoryId}/
├── index.md
├── log.md
├── entities/
└── topics/
```

### 11.2 页面命名规范
- `entities/*.md` 使用最常用正式名，别名写入 `aliases`。
- `topics/*.md` 使用可复用主题短句，不在文件名中写日期。
- 同义实体不重复建页，统一并入同一页面。

### 11.3 Frontmatter 规范
```yaml
type: entity | topic
title: 页面标题
categoryId: 分类ID
aliases: []
tags: []
sourceCount: 0
createdAt: ISO时间
updatedAt: ISO时间
status: draft | active | archived
confidence: low | medium | high
```

### 11.4 实体页模板
```markdown
# {实体名}
## 一句话摘要
## 核心描述
## 关键事实
## 近期动态
## 相关主题
## 相关实体
## 争议与冲突
## 来源
```

### 11.5 主题页模板
```markdown
# {主题名}
## 一句话摘要
## 当前判断
## 关键观点
## 时间线
## 相关实体
## 子主题
## 争议与冲突
## 来源
```

### 11.6 特殊文件规范
- `index.md`：按 `Entities`、`Topics` 分组，记录链接、一句话摘要、更新时间、来源数。
- `log.md`：append-only，使用 `## [时间] ingest|query|lint | 标题` 作为统一前缀。

### 11.7 运行规则
- ingest 必须同步更新页面、`index.md`、`log.md`。
- query 必须先读 `index.md`，再选取少量高相关 `topic/entity` 页面组装上下文。
- lint 每周至少检查一次孤立页、重复页、长期未更新页、未解决冲突。

## 十二、API 契约与 TypeScript 类型草案

### 12.1 API 契约草案
```typescript
POST /api/wiki/ingest
{ articleId: string; categoryId: string; apiConfigId?: string }
=> { code: 0, data: { updatedEntities: string[], updatedTopics: string[], logEntry: string } }

GET /api/wiki/index?categoryId=ai
=> { code: 0, data: { entities: WikiIndexItem[], topics: WikiIndexItem[] } }

POST /api/wiki/lint
{ categoryId: string }
=> { code: 0, data: { issues: WikiLintIssue[] } }

POST /api/content/generate
{ topic: string; style: string; categoryId?: string; useWiki?: boolean; wikiMode?: "off" | "index-only" | "full-context" }
```

### 12.2 TypeScript 类型草案
```typescript
interface WikiSourceRef {
  articleId: string;
  title: string;
  url?: string;
  platform?: string;
  publishedAt?: string;
}

interface WikiConflict {
  claim: string;
  oldView: string;
  newView: string;
  status: "open" | "resolved";
  sourceArticleIds: string[];
}

interface WikiIndexItem {
  type: "entity" | "topic";
  title: string;
  slug: string;
  summary: string;
  updatedAt: string;
  sourceCount: number;
}

interface WikiLintIssue {
  severity: "critical" | "high" | "medium" | "low";
  page: string;
  message: string;
  suggestion: string;
}
```

## 十三、后端实现清单与函数签名草案

### 13.1 `src/lib/wiki.ts`
```typescript
export function ensureWikiRoot(categoryId: string): Promise<void>;
export function readWikiIndex(categoryId: string): Promise<string>;
export function writeWikiIndex(categoryId: string, content: string): Promise<void>;
export function appendWikiLog(categoryId: string, entry: string): Promise<void>;
export function upsertEntityPage(categoryId: string, slug: string, content: string): Promise<void>;
export function upsertTopicPage(categoryId: string, slug: string, content: string): Promise<void>;
export function listWikiPages(categoryId: string): Promise<{ entities: string[]; topics: string[] }>;
```

### 13.2 `src/lib/wiki-ingest.ts`
```typescript
export interface WikiIngestInput {
  articleId: string;
  categoryId: string;
  title: string;
  content: string;
  url?: string;
  platform?: string;
  publishedAt?: string;
}

export interface WikiIngestResult {
  updatedEntities: string[];
  updatedTopics: string[];
  createdPages: string[];
  conflicts: WikiConflict[];
  logEntry: string;
}

export function ingestArticleToWiki(input: WikiIngestInput): Promise<WikiIngestResult>;
```

### 13.3 `src/lib/wiki-query.ts`
```typescript
export function searchWikiIndex(categoryId: string, query: string): Promise<WikiIndexItem[]>;
export function resolveRelevantWikiPages(categoryId: string, topic: string, keywords?: string[]): Promise<string[]>;
export function buildWikiContext(categoryId: string, topic: string, keywords?: string[]): Promise<string>;
```

### 13.4 `src/lib/wiki-lint.ts`
```typescript
export function lintWiki(categoryId: string): Promise<WikiLintIssue[]>;
export function detectOrphanPages(categoryId: string): Promise<WikiLintIssue[]>;
export function detectDuplicatePages(categoryId: string): Promise<WikiLintIssue[]>;
export function detectStaleClaims(categoryId: string): Promise<WikiLintIssue[]>;
```

### 13.5 API 路由职责
- `POST /api/wiki/ingest`：校验参数，读取文章，调用 `ingestArticleToWiki`，返回变更摘要。
- `GET /api/wiki/index`：读取并解析 `index.md`，返回 `entities/topics` 概览。
- `POST /api/wiki/lint`：执行健康检查，返回 issue 列表与修复建议。
- `POST /api/content/generate`：在 `useWiki=true` 时调用 `buildWikiContext` 注入知识上下文。

### 13.6 后端状态流转
- ingest：`pending -> extracting -> updating-pages -> updating-index -> appending-log -> completed | failed`
- generate：`pending -> resolving-wiki -> streaming -> completed | failed`
- lint：`pending -> scanning -> reporting -> completed | failed`

## 十四、前端交互流程与页面状态设计

### 14.1 `ContentTab`：提取到 Wiki
- 入口：文章卡片操作区新增 `提取到 Wiki` 按钮。
- 交互流程：点击 -> 参数校验 -> 请求 ingest API -> 展示进度 -> 返回结果摘要。
- 成功反馈：展示 `新增页面`、`更新页面`、`冲突数`、`最近日志`。
- 失败反馈：展示错误原因与重试按钮。

### 14.2 `ContentTab` 页面状态
```typescript
type WikiIngestStatus = "idle" | "submitting" | "success" | "error";

interface WikiIngestUIState {
  articleId: string;
  status: WikiIngestStatus;
  message?: string;
  updatedEntities?: string[];
  updatedTopics?: string[];
}
```

### 14.3 `ContentProductionTab`：基于 Wiki 生成
- 控件：分类选择、`使用 Wiki 知识增强` 开关、`wikiMode` 选择。
- 交互流程：输入主题 -> 选择风格 -> 预检索 wiki -> 展示命中页 -> 发起流式生成。
- 展示区：正文流式输出区、命中页侧栏、生成完成后的标题/封面二次操作入口。

### 14.4 `ContentProductionTab` 页面状态
```typescript
type GenerateStatus = "idle" | "resolvingWiki" | "streaming" | "completed" | "error";

interface ContentGenerationUIState {
  status: GenerateStatus;
  useWiki: boolean;
  wikiMode: "off" | "index-only" | "full-context";
  matchedPages: string[];
  content: string;
  error?: string;
}
```

### 14.5 `ReportTab`：Wiki 健康检查
- 入口：新增 `运行 Wiki 健康检查` 按钮。
- 展示：问题级别、问题页面、建议动作、最近一次检查时间。
- 筛选：按 `critical/high/medium/low` 过滤。

### 14.6 通用交互原则
- 所有异步动作必须有 loading、success、error 三态。
- 流式生成期间禁止重复提交，但允许停止生成。
- Wiki 相关结果尽量展示“命中了哪些页”，增强可解释性。
- 所有失败态保留最近一次输入，便于用户重试。

## 十五、Wiki 页面更新算法规则

### 15.1 Ingest 总流程
1. 读取文章与 `index.md`。
2. 抽取候选实体、主题、观点、冲突。
3. 基于标题、别名、slug 做去重匹配。
4. 决定 `create` 或 `update`。
5. 更新页面正文、来源、更新时间。
6. 重建 `index.md` 条目并追加 `log.md`。

### 15.2 实体/主题去重规则
- 标题完全一致：直接命中已有页。
- slug 一致：直接命中已有页。
- 命中 `aliases`：并入已有页，不新建。
- 语义高度相似但名称不同：记录为候选合并项，优先 update，不自动双建。

### 15.3 页面更新规则
- `summary`：保留原有主判断，仅在新信息明显更完整时重写。
- `keyFacts/keyPoints`：去重后追加，最多保留高价值条目。
- `timeline/recentDevelopments`：按时间倒序插入，重复事件不重复写入。
- `sources`：按 `articleId + url` 去重。
- `updatedAt`：仅在页面实际变化时更新。
- `sourceCount`：以去重后的来源数重新计算。

### 15.4 冲突处理规则
- 新来源与旧结论相反时，不覆盖旧结论，先写入 `conflicts`。
- 冲突项至少包含：`claim`、`oldView`、`newView`、`status`、`sourceArticleIds`。
- 同一冲突再次出现时合并来源，不重复创建冲突块。
- 仅在 lint 或人工确认后，才允许把 `resolved` 结果写回主结论。

### 15.5 页面新建规则
- 满足“无同名页、无别名命中、具备后续复用价值”时才新建。
- 过细、一次性、无复用价值的主题不单独建页，只补充到已有主题页。
- 新建页后必须同步生成 index 条目与来源块。

### 15.6 Index/Log 更新规则
- `index.md` 始终按 `Entities`、`Topics` 分组输出。
- index 条目字段固定：链接、摘要、`updatedAt`、`sourceCount`。
- `log.md` 为 append-only，不回写历史记录。
- 每次 ingest/query/lint 都必须产生日志条目。

## 十六、核心接口请求/响应示例

### 16.1 `POST /api/wiki/ingest`
**Request**
```json
{
  "articleId": "article_001",
  "categoryId": "ai"
}
```

**Response 200**
```json
{
  "code": 0,
  "data": {
    "updatedEntities": ["OpenAI", "Google"],
    "updatedTopics": ["大模型闭源趋势"],
    "createdPages": ["topics/大模型闭源趋势.md"],
    "logEntry": "[2026-04-08 14:30] ingest | 某篇文章"
  }
}
```

**Response 404**
```json
{
  "code": 404,
  "error": {
    "name": "ARTICLE_NOT_FOUND",
    "message": "未找到指定文章",
    "requestId": "req_xxx"
  }
}
```

### 16.2 `GET /api/wiki/index?categoryId=ai`
**Response 200**
```json
{
  "code": 0,
  "data": {
    "entities": [
      { "type": "entity", "title": "OpenAI", "slug": "OpenAI", "summary": "大模型产业关键参与者", "updatedAt": "2026-04-08T14:30:00Z", "sourceCount": 6 }
    ],
    "topics": [
      { "type": "topic", "title": "大模型闭源趋势", "slug": "大模型闭源趋势", "summary": "行业从开放扩散转向能力封装", "updatedAt": "2026-04-08T14:30:00Z", "sourceCount": 8 }
    ]
  }
}
```

### 16.3 `POST /api/wiki/lint`
**Request**
```json
{ "categoryId": "ai" }
```

**Response 200**
```json
{
  "code": 0,
  "data": {
    "issues": [
      { "severity": "high", "page": "topics/AI手机入口之争.md", "message": "缺少到 豆包 的交叉引用", "suggestion": "补充相关实体链接" }
    ]
  }
}
```

### 16.4 `POST /api/content/generate`
**Request**
```json
{
  "topic": "聊聊大模型近期的封闭化趋势",
  "style": "tech",
  "categoryId": "ai",
  "useWiki": true,
  "wikiMode": "full-context",
  "length": "long"
}
```

**SSE 首帧建议**
```text
data: {"meta":{"matchedPages":["topics/大模型闭源趋势.md","entities/OpenAI.md"]}}
```

**SSE 内容帧**
```text
data: {"content":"先说结论，大模型行业正在加速闭源。"}
```
