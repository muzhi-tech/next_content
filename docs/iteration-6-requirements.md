# 第六轮迭代需求文档

## 1. 迭代背景

前五轮迭代已完成 MVP 主链路开发、Wiki 知识引擎、8 步 Agent 管道、SQLite 迁移和系统收口稳定化。系统具备手动采集、AI 写文、Wiki 知识管理等核心能力。

但实际使用中暴露两个关键缺口：

1. **采集全靠手动点击**，没有定时调度能力，SettingsTab 里的「采集后自动 Ingest」开关也是假的（没有传参到后端）
2. **AI 生成内容随页面关闭丢失**，没有持久化，没有草稿/发布状态，发布按钮也是 mock 的 setTimeout

本轮迭代解决这两个问题，让系统从「能跑」变成「能用」。

---

## 2. 本轮迭代目标

1. 实现定时采集调度，支持按分类/关键词配置采集计划
2. 修复现有 autoIngest 开关（当前是假开关）
3. 新建 AI 生成内容表，支持草稿持久化
4. 实现内容状态流转：草稿 → 已审核 → 已发布
5. 在前端展示内容历史列表

---

## 3. 功能需求

### 3.1 定时采集调度

#### 3.1.1 调度配置

- 在「监控设置」Tab 中为每个分类配置采集计划
- 支持配置项：
  - 是否启用定时采集（开关）
  - 采集间隔（30分钟 / 1小时 / 2小时 / 6小时 / 12小时 / 24小时）
  - 是否采集后自动 Ingest 到 Wiki
  - Ingest Top N 数量
- 配置持久化到数据库（`categories` 表扩展字段或新建 `schedules` 表）

#### 3.1.2 调度执行

- 使用 Next.js API Route + `node-cron` 实现服务端定时任务
- 定时触发时自动调用现有 `/api/refresh` 逻辑
- 记录每次采集执行结果（成功/失败/采集数量）

#### 3.1.3 采集历史

- 新建 `collection_logs` 表记录每次采集执行结果
- 字段：id, categoryId, keywordId, platform, status, articleCount, errorMsg, startedAt, completedAt
- 在「监控设置」Tab 底部展示最近采集记录

#### 3.1.4 修复 autoIngest 开关

- 修复 SettingsTab 中 `handleRefresh` 不传 `autoIngest`/`ingestTopN` 的问题
- 让「采集后自动 Ingest」开关真正生效

---

### 3.2 AI 生成内容历史

#### 3.2.1 内容持久化

- 新建 `generated_contents` 表
- 字段：id, categoryId, topic, content, style, personaId, status, wikiContext, titles, coverPrompt, sourceType, createdAt, updatedAt
- `status` 枚举：`draft` | `reviewed` | `published` | `archived`
- `sourceType`：`manual`（手动单篇生成）| `pipeline`（管道产出）

#### 3.2.2 自动保存

- AI 写文生成完成后，WritingTab 自动调用保存接口
- 管道（Pipeline）完成时，自动将最终产出保存到 `generated_contents`
- 保存内容包括：主题、正文、标题、封面提示词、使用的风格/人设、关联 Wiki 页面

#### 3.2.3 内容状态流转

- **草稿 (draft)**：生成完成后的初始状态，可编辑
- **已审核 (reviewed)**：用户确认内容质量后的状态
- **已发布 (published)**：内容已发布到外部平台
- **已归档 (archived)**：不再使用的内容

#### 3.2.4 内容历史 UI

- 在侧边栏新增「内容历史」Tab 或在 WritingTab 中增加子 Tab
- 展示所有 AI 生成的内容列表，支持：
  - 按状态筛选（全部/草稿/已审核/已发布）
  - 按分类筛选
  - 搜索标题/主题
  - 查看详情、编辑正文、修改状态
  - 复制内容
  - 删除

---

## 4. 技术方案

### 4.1 数据库变更

#### 新建 `generated_contents` 表

```sql
CREATE TABLE IF NOT EXISTS generated_contents (
  id TEXT PRIMARY KEY,
  categoryId TEXT,
  topic TEXT NOT NULL,
  content TEXT NOT EMPTY,
  style TEXT,
  personaId TEXT,
  status TEXT DEFAULT 'draft',
  wikiContext TEXT,
  titles TEXT,
  coverPrompt TEXT,
  sourceType TEXT DEFAULT 'manual',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

#### 新建 `collection_logs` 表

```sql
CREATE TABLE IF NOT EXISTS collection_logs (
  id TEXT PRIMARY KEY,
  categoryId TEXT,
  keywordId TEXT,
  keywordName TEXT,
  platform TEXT,
  status TEXT NOT NULL,
  articleCount INTEGER DEFAULT 0,
  errorMsg TEXT,
  startedAt INTEGER NOT NULL,
  completedAt INTEGER
);
```

#### 扩展 `categories` 表

新增字段：
- `scheduleEnabled` INTEGER DEFAULT 0
- `scheduleInterval` TEXT DEFAULT '1h'
- `autoIngest` INTEGER DEFAULT 0
- `ingestTopN` INTEGER DEFAULT 5

### 4.2 新增 API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/contents` | GET | 获取生成内容列表（分页、筛选） |
| `/api/contents` | POST | 保存生成内容 |
| `/api/contents/[id]` | GET | 获取单条内容详情 |
| `/api/contents/[id]` | PUT | 更新内容（编辑/改状态） |
| `/api/contents/[id]` | DELETE | 删除内容 |
| `/api/schedule` | GET | 获取调度配置列表 |
| `/api/schedule` | POST | 更新调度配置 |
| `/api/collection-logs` | GET | 获取采集日志列表 |

### 4.3 定时调度实现

- 安装 `node-cron` 依赖
- 创建 `src/lib/scheduler.ts` 管理定时任务
- Next.js 启动时通过 instrumentation 或自定义 server 初始化调度器
- 调度触发时调用现有采集逻辑，复用 `/api/refresh` 的核心代码

### 4.4 前端变更

- **SettingsTab**：修复 autoIngest 传参 + 增加调度配置 UI + 采集日志展示
- **新建 ContentHistoryTab**：AI 生成内容历史列表
- **WritingTab**：生成完成后自动保存 + 替换 mock publish 为真实状态变更
- **page.tsx**：侧边栏新增「内容历史」导航项

---

## 5. 非目标

本轮迭代不处理：

- 微信/小红书 OAuth 授权和真实发布
- 高级数据分析和趋势图表
- 更多平台接入（抖音/B站/微博）
- 内容导出（Markdown/PDF）
- 多模型切换

---

## 6. 交付物

1. 调度配置 UI 和后端逻辑
2. 采集日志记录和展示
3. autoIngest 开关修复
4. `generated_contents` 表和 CRUD API
5. `collection_logs` 表和查询 API
6. 内容历史 Tab 组件
7. WritingTab 自动保存集成
8. Pipeline 产出自动保存
9. 测试覆盖（单元 + API 集成）

---

## 7. 验收标准

- 可为分类配置定时采集计划，到时自动执行
- 采集日志可在页面查看最近记录
- autoIngest 开关实际生效，采集后自动摄入 Wiki
- AI 写文生成后内容自动保存为草稿
- 管道产出自动保存为草稿
- 内容历史 Tab 可查看、搜索、筛选、编辑所有生成内容
- 内容状态可在 draft → reviewed → published → archived 间流转
- 新增 API 和 DB 操作有对应的单元测试

---

## 8. 一句话定义

**让采集自动化、让 AI 产出可追溯。**
