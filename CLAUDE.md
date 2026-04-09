# CLAUDE.md

## 项目名称

内容监控与选题分析工具（Content Monitoring & Topic Analysis Platform）

---

## Agent Team 组建说明

请按照以下配置启动 Agent Team：

```
Create an agent team for 内容监控与选题分析工具 development.

Team Lead: You (orchestrator only, no direct implementation)

Spawn the following teammates:

1. architect-agent
   - Role: 架构规划
   - Responsibilities: 设计 API 契约、数据模型、权限控制
   - Skill: api-designer
   - Branch: agent-architect

2. frontend-agent
   - Role: 前端实现
   - Responsibilities: UI 组件、表单验证、状态管理
   - Skill: ui-ux-pro-max-skill
   - Allowed paths: src/components/, src/app/ (excluding admin/)
   - Branch: agent-frontend

3. backend-agent
   - Role: 后端实现
   - Responsibilities: 路由、控制器、数据存储逻辑
   - Skill: backend-api
   - Allowed paths: src/app/api/, src/lib/
   - Branch: agent-backend

4. test-agent
   - Role: 测试
   - Responsibilities: 单元测试、集成测试、E2E 测试
   - Skill: test-generator
   - Branch: agent-test

5. docs-agent
   - Role: 文档
   - Responsibilities: 更新 README、API 文档、变更日志
   - Skill: docs-updater
   - Branch: agent-docs

Require plan approval before any teammate begins implementation.
Use delegation mode: team lead coordinates only, does not implement directly.
```

---

## 团队规则

### 基础规则

- 所有 teammate 启动时自动加载项目 Skills，确保编码风格一致
- 每个 teammate 在独立分支上工作，分支命名见上方配置
- 任何 teammate 不得修改自己 Allowed paths 之外的文件
- 修改高冲突文件前必须通知 Team Lead 并等待确认

### 协作规则

- 所有 teammate 通过共享任务列表协作
- architect-agent 优先完成 API 契约和数据模型，其他 teammate 等待契约产出后再并行推进
- frontend-agent 和 backend-agent 基于 architect-agent 输出的契约并行开发
- test-agent 在各模块完成后介入，不等所有模块全部完成
- docs-agent 持续跟踪变更，不等最后阶段才介入

### 完成与合并规则

- 每个 teammate 完成任务后，必须提交以下内容到共享任务列表：
  1. 变更总结（做了什么、没做什么、已知风险）
  2. 修改文件 diff 列表
  3. 验证方式说明
- 所有变更经 Human Checkpoint 确认后方可合并
- Team Lead 负责汇总各 teammate 结果，不单独合并任何分支

---

## 一、项目目标与开发原则

### 产品目标

本项目是面向内容创作者和运营者的多平台内容监控与 AI 选题分析平台，提供以下核心能力：

- 多平台内容监控（小红书、公众号、抖音、B站、微博）
- 关键词管理与分类
- 采集内容管理与展示
- AI 内容选题分析
- AI 内容生产（标题、封面、正文生成）
- 选题报告生成
- API 配置管理

### 当前开发原则

当前阶段默认以 **MVP 主链路落地** 为第一目标。除非 Team Lead 明确调整，优先顺序如下：

1. P0 核心功能可用
2. P1 高价值增强功能
3. P2 扩展能力
4. 非必要重构、样式深度优化、抽象优化

### 当前默认开发范围

**六轮迭代已完成全部核心功能。当前进入稳定维护阶段。**

**已完成：**
- 首页 + 8+ Tab 导航
- 关键词管理 + 分类 CRUD
- 文章采集 + 存储 (小红书/公众号)
- AI 内容生成/写作/标题/封面 (SSE 流式)
- Wiki 知识引擎 (摄入/查询/检查/索引)
- 8 环节 Agent 管道 (采集→选题→写作→打分→去AI化→审核→配图→发布)
- 定时采集调度 (scheduler.ts + node-cron)
- AI 生成内容持久化 (草稿/已审核/已发布/已归档)
- 账号空间 (人设/风格/知识库/模板)
- 采集日志记录
- SQLite 数据库 (10 表, 37 函数, 210 测试)

**后续迭代可考虑：**
- 更多平台接入 (抖音/B站/微博)
- 高级数据分析
- 内容导出 (Markdown/PDF)
- 多模型切换
- OAuth 授权和真实发布

---

## 二、技术栈与目录结构

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 14.2.3 |
| UI 库 | React | 18 |
| 语言 | TypeScript | 5 |
| 样式 | Tailwind CSS | 3.4.1 |
| 图标 | Lucide React | 0.378.0 |
| 数据库 | better-sqlite3 (SQLite) | 12.8.0 |
| 测试 | Vitest (210 测试用例) | - |
| AI | OpenAI 兼容 API (raw fetch) | - |

### 项目目录

```text
src/
  app/
    page.tsx                    # 首页 - 侧边栏 + Tab 切换
    layout.tsx                  # 根布局
    globals.css                 # 全局样式
    api/
      keywords/                 # 关键词 CRUD
      articles/                 # 文章列表
      platforms/xhs/           # 小红书搜索
      platforms/wx/            # 公众号文章
      content/generate/         # AI 内容生成 (SSE)
      content/write/            # AI 写作 (SSE)
      content/titles/           # AI 标题生成
      content/cover/            # AI 封面生成
      config/                   # API 配置 CRUD
      report/list/              # 报告列表
      report/generate/          # 报告生成
      wiki/ingest/             # Wiki 内容摄入
      wiki/[categoryId]/        # Wiki 分类查询
      pipeline/                 # 8 环节管道
      pipeline/[id]/            # 管道状态
      account-space/personas/  # 账号人设 CRUD
      account-space/styles/     # 文风风格 CRUD
      account-space/knowledge/   # 知识库 CRUD
      account-space/templates/  # 写作模板 CRUD
      contents/                 # 生成内容 CRUD (T6-02)
      contents/[id]/            # 内容详情/更新/删除
      schedule/                 # 调度配置 (T6-06)
      collection-logs/          # 采集日志 (T6-06)
      wx-articles/              # 公众号文章
      refresh/                  # 刷新采集
      categories/               # 分类 CRUD
  components/
    ContentTab.tsx              # 采集内容 Tab
    WritingTab.tsx              # AI 写作 Tab (替代 ContentProductionTab)
    ReportTab.tsx               # 选题分析与报告 Tab
    SettingsTab.tsx             # 监控设置 Tab (含调度配置+采集日志, T6-07)
    WikiTab.tsx                 # Wiki 知识引擎 Tab
    AccountSpaceTab.tsx         # 账号空间 Tab
    ContentHistoryTab.tsx        # AI 生成内容历史 (T6-03)
    ImageTab.tsx               # 图片相关 Tab
    SystemSettingsTab.tsx       # 系统设置 Tab
  lib/
    db.ts                       # SQLite 数据库 (10 张表, 37 个导出函数)
    types.ts                    # TypeScript 类型 (含 GeneratedContent, CollectionLog)
    content-generator.ts        # AI 调用 (buildEndpoint, createChatCompletionStream/JSON)
    wiki.ts                     # Wiki 文件操作
    wiki-ingest.ts              # Wiki 内容摄入
    wiki-query.ts               # Wiki 查询
    wiki-lint.ts                # Wiki 质量检查
    pipeline.ts                 # 8 环节 Agent 管道
    scheduler.ts                # 定时调度 (T6-06, node-cron)
    agents/
      humanize.ts              # 去 AI 化 Agent
      score.ts                 # 打分 Agent
      review.ts                # 审核 Agent
      index.ts                 # Agent 入口

data/
  content.db                    # SQLite 数据库文件 (替代旧 JSON)
```

### 实际 Tab 导航 (8+)

| Tab | 组件 | 说明 |
|-----|------|------|
| 内容监控 | ContentTab | 采集内容展示 |
| AI 写作 | WritingTab | AI 写作 (含 Wiki 集成, T6-04) |
| 选题报告 | ReportTab | 选题分析与报告 |
| 监控设置 | SettingsTab | 含调度配置+采集日志 (T6-05/07) |
| Wiki | WikiTab | 知识引擎浏览与查询 |
| 账号空间 | AccountSpaceTab | 人设/风格/知识库/模板 |
| 内容历史 | ContentHistoryTab | AI 生成内容持久化 (T6-03) |
| 图片 | ImageTab | 图片相关 |
| 系统设置 | SystemSettingsTab | 系统配置 |

### 目录使用原则

- 页面级功能落在 `src/app/` 对应模块目录
- 复用型组件放在 `src/components/`
- 公共类型放在 `src/lib/types.ts`
- 通用工具放在 `src/lib/` 下
- API 路由在 `src/app/api/` 下按功能模块划分
- 不创建与现有目录语义重复的新目录

---

## 三、角色职责详细说明

### Team Lead / Orchestrator（你）

**职责：**

- 理解 PRD 和当前迭代目标
- 拆分任务并定义优先级与依赖关系
- 分配 teammate 和模块边界
- 跟踪进度、清除阻塞
- 汇总阶段结果
- 决定何时进入联调、测试、收尾
- 做最终交付判断

**约束：**

- 先派工再跟踪，不直接写大块代码
- 对共享文件、接口变更、类型变更进行显式管理
- 对复杂任务要求 teammate 先提交计划，批准后再实施
- 在宣布完成前，必须确认 QA 结论
- 使用委派模式（Delegation Mode），专注编排

---

### architect-agent（架构规划）

**Skill：** `api-designer`
**Branch：** `agent-architect`

**职责：**

- 设计并输出完整 API 契约
- 设计数据模型与数据库结构
- 定义权限控制策略
- 为 frontend-agent 和 backend-agent 提供接口基准

**必须优先完成，其他 teammate 等待其输出后再并行推进。**

**输出物：**

- API 契约文档（路径、方法、参数、响应结构、错误码）
- 数据模型说明（字段、类型、关联关系）
- 权限控制矩阵

---

### frontend-agent（前端实现）

**Skill：** `ui-ux-pro-max-skill`
**Branch：** `agent-frontend`
**Allowed paths：** `src/components/`、`src/app/`（不含 `admin/`）

**职责：**

- 实现用户侧所有页面 UI 与交互
- 表单验证与状态管理
- 基于 architect-agent 输出的契约对接接口

**约束：**

- 不修改 `src/lib/db.ts` 数据库逻辑
- 不自行定义接口结构，必须基于契约

---

### backend-agent（后端实现）

**Skill：** `backend-api`
**Branch：** `agent-backend`
**Allowed paths：** `src/app/api/`、`src/lib/`

**职责：**

- 实现 API 路由与控制器逻辑
- 实现数据存储与读写逻辑
- **实现 8 大自进化 Agent (采集、选题、写作、打分、去AI化、审核、配图、发布) 的协同流转管道**
- **实现 LLM Wiki 知识引擎的数据结构与更新逻辑**
- 基于 architect-agent 输出的契约实现接口
- schema 变更必须同步 Team Lead

**约束：**

- 不修改 `src/components/` 前端目录
- `src/lib/types.ts` 和 `src/lib/schema.ts` 变更必须同步 Team Lead
- 不在未通知前端的情况下修改响应结构

---

### test-agent（测试）

**Skill：** `test-generator`
**Branch：** `agent-test`

**职责：**

- 为各模块编写单元测试
- 编写前后端集成测试
- 编写关键链路 E2E 测试（Playwright）
- 检查 PRD P0 功能覆盖情况
- 输出测试报告与回归清单

**约束：**

- 不修改业务代码
- 在各模块完成后介入，不等所有模块全部完成

---

### docs-agent（文档）

**Skill：** `docs-updater`
**Branch：** `agent-docs`

**职责：**

- 更新 README（安装、启动、目录说明）
- 更新 API 文档（基于 architect-agent 契约）
- 更新 CHANGELOG
- 持续跟踪变更，不等最后阶段才介入

**约束：**

- 不修改业务代码

---

## 四、接口契约规则

### 并行开发前必须先对齐

前后端并行开发时，必须先确认以下内容：

- API 路径与请求方式
- 请求参数（含必填 / 选填）
- 响应结构（含字段名、类型）
- 错误返回格式
- 分页字段（page、pageSize、total）
- 筛选与排序字段

### 已实现 API 端点 (2026-04-09 完成)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/keywords` | GET/POST | 关键词列表/创建 |
| `/api/keywords/[id]` | GET/PUT/DELETE | 关键词详情/更新/删除 |
| `/api/articles` | GET | 文章列表 (分页/平台/关键词/日期筛选) |
| `/api/categories` | GET/POST | 分类 CRUD |
| `/api/categories/[id]` | GET/PUT/DELETE | 分类详情/更新/删除 |
| `/api/platforms/xhs` | GET | 小红书搜索 |
| `/api/platforms/wx` | GET | 公众号文章 |
| `/api/content/generate` | POST | AI 内容生成 (SSE) |
| `/api/content/write` | POST | AI 写作 (SSE) |
| `/api/content/titles` | POST | AI 标题生成 |
| `/api/content/cover` | POST | AI 封面生成 |
| `/api/content/cover/prompts` | GET | 封面提示词 |
| `/api/config` | GET/POST | API 配置列表/创建 |
| `/api/config/[id]` | GET/PUT/DELETE | 配置详情/更新/删除 |
| `/api/report/list` | GET | 报告列表 |
| `/api/report/generate` | POST | 报告生成 |
| `/api/wiki/ingest` | POST | Wiki 内容摄入 |
| `/api/wiki/[categoryId]` | GET | Wiki 分类查询 |
| `/api/wiki/query` | POST | Wiki 语义查询 |
| `/api/wiki/lint` | POST | Wiki 质量检查 |
| `/api/wiki/index` | POST | Wiki 索引构建 |
| `/api/pipeline` | POST | 创建 8 环节管道 |
| `/api/pipeline/[id]` | GET | 管道状态 |
| `/api/account-space/personas` | CRUD | 人设管理 |
| `/api/account-space/styles` | CRUD | 文风风格 |
| `/api/account-space/knowledge` | CRUD | 知识库 |
| `/api/account-space/templates` | CRUD | 写作模板 |
| `/api/contents` | GET/POST | 生成内容列表/创建 (T6-02) |
| `/api/contents/[id]` | GET/PUT/DELETE | 内容详情/更新/删除 (T6-02) |
| `/api/schedule` | GET/POST | 调度配置 (T6-06) |
| `/api/collection-logs` | GET | 采集日志 (T6-06) |
| `/api/wx-articles` | GET | 公众号文章 |
| `/api/refresh` | POST | 刷新采集 (含 autoIngest, T6-05) |

---

## 五、文件边界与冲突规避

### 高冲突文件清单

修改以下文件前必须说明原因、影响范围、是否需要对齐其他 teammate：

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/WritingTab.tsx` (最复杂组件, ~700行)
- `src/components/ContentTab.tsx`
- `src/components/ContentHistoryTab.tsx` (T6-03)
- `src/components/ReportTab.tsx`
- `src/components/SettingsTab.tsx` (含调度配置, T6-05/07)
- `src/components/WikiTab.tsx`
- `src/components/AccountSpaceTab.tsx`
- `src/lib/db.ts` (617行, 10表37函数)
- `src/lib/types.ts`
- `src/lib/pipeline.ts` (265行, 8环节管道)
- `src/lib/scheduler.ts` (T6-06)
- `src/lib/content-generator.ts`

---

## 六、汇报与交付格式

### 进度汇报

```
【当前任务】
【当前状态】进行中 / 阻塞 / 完成
【已完成内容】
【未完成内容】
【遇到的问题】
【建议下一步】
【需要谁配合】
```

### 结果交付（提交到共享任务列表）

```
【交付物】
【修改了哪些目录 / 文件】
【变更 diff 摘要】
【如何验证】
【已知风险】
【是否阻塞后续任务】
```

### 风险上报

```
【风险描述】
【影响范围】
【当前是否阻塞】
【建议处理方案】
【需要谁决策】
```

---

## 七、完成定义（Definition of Done）

满足以下全部条件，任务才可标记为完成：

- 目标范围内内容已实现
- 输出物已明确交付
- 变更总结 + diff 已提交到共享任务列表
- 验证方式已说明
- 风险和未完成项已说明
- 不再阻塞后续任务，或阻塞项已明确转交
- 等待 Human Checkpoint 确认后方可合并

---

## 八、Git 操作规则

### 提交与推送

**每次提交后必须立即推送到远端仓库：**

```bash
git commit -m "提交信息"
git push
```

或使用组合命令：

```bash
git commit -m "提交信息" && git push
```

**禁止行为：**
- 禁止本地多次提交后才推送
- 禁止积累大量未推送的 commit
- 禁止在一天工作结束时还有未推送的 commit

---

## 九、禁止事项

- 禁止未确认范围就直接大规模编码
- 禁止擅自修改 Allowed paths 之外的文件
- 禁止擅自重构其他 agent 负责的模块
- 禁止多人无协调地同时修改高冲突文件
- 禁止前后端各自维护不一致的数据结构
- 禁止把"方案"当作"结果"交付
- 禁止隐瞒风险、缺口、未完成项
- 禁止绕过 Human Checkpoint 直接合并分支

---

## 十、迭代开发历史 (六轮全部完成)

### ✅ 第一迭代 (P0安全修复 + P1核心功能 + P2增强)
- Token 修复、路由去重、8 环节管道、报告持久化、Wiki 浏览 UI

### ✅ 第二迭代 (Wiki 基础升级)
- wiki.ts/wiki-ingest.ts 升级、Wiki 类型扩展、WritingTab Wiki 集成

### ✅ 第三迭代 (Query/Lint/集成/前端)
- wiki-query.ts/wiki-lint.ts、Wiki Lint/Index API、内容生成 Wiki 集成

### ✅ 第四迭代 (管道增强 + 自动化 + UI质量)
- 管道状态持久化 (pipeline_runs 表)、SSE 流式推送、断点恢复
- SQLite 迁移完成 (10 张表, 37 个导出函数)

### ✅ 第五迭代 (收口、对齐、稳定化)
- API 契约收口、错误结构统一、测试补齐 (184→210 测试)

### ✅ 第六迭代 (自动化采集 + 内容历史, 2026-04-09)
- generated_contents + collection_logs 表
- ContentHistoryTab、内容自动保存草稿
- 定时调度 (scheduler.ts + node-cron)、autoIngest 修复
- 调度配置 UI + 采集日志

### Wiki 知识引擎 (未在原始设计中，已完整实现)

| 模块 | 文件 | 状态 |
|-----|------|------|
| 核心引擎 | `lib/wiki.ts` | ✅ |
| 内容摄入 | `lib/wiki-ingest.ts` | ✅ |
| 查询 | `lib/wiki-query.ts` | ✅ |
| 质量检查 | `lib/wiki-lint.ts` | ✅ |
| Wiki API | `api/wiki/*` | ✅ |
| Wiki UI | `WikiTab.tsx` | ✅ |

### 8 大 Agent 管道 (已在 pipeline.ts 协作运行)

| Agent | 状态 | 备注 |
|-------|------|------|
| 采集 | ✅ | 集成在 pipeline |
| 选题 | ✅ | 集成在 pipeline |
| 写作 | ✅ | 集成在 pipeline |
| 打分 | ✅ | 独立 `lib/agents/score.ts` |
| 去AI化 | ✅ | 独立 `lib/agents/humanize.ts` |
| 审核 | ✅ | 独立 `lib/agents/review.ts` |
| 配图 | ✅ | 集成在 pipeline |
| 发布 | ⚠️ | 集成在 pipeline (终点) |

---

## 十一、文档同步规则

以下内容变化时，必须同步文档、任务说明或共享说明：

- 模块边界变化
- 接口契约变化
- 数据模型变化
- 分工变化
- 优先级变化
- 验收标准变化

本文件优先级高于临时口头约定。临时约定若持续有效，必须尽快沉淀到文档中。
