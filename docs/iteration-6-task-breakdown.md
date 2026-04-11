# 第六轮迭代任务拆解清单

## 1. 迭代目标

聚焦自动化采集和内容历史，让系统从「能跑」变成「能用」。

---

## 2. 任务总览

| 编号 | 任务名称 | 优先级 | 负责方向 | 依赖 |
|------|----------|--------|----------|------|
| T6-01 | 数据库 Schema 扩展 | P0 | backend | 无 |
| T6-02 | 生成内容 CRUD API | P0 | backend | T6-01 |
| T6-03 | 内容历史 Tab 前端 | P0 | frontend | T6-02 |
| T6-04 | WritingTab 自动保存集成 | P0 | frontend | T6-02 |
| T6-05 | 修复 autoIngest 开关 | P0 | backend/frontend | 无 |
| T6-06 | 定时调度后端 | P1 | backend | T6-01 |
| T6-07 | 调度配置 UI + 采集日志 | P1 | frontend | T6-06 |
| T6-08 | Pipeline 产出自动保存 | P1 | backend | T6-02 |
| T6-09 | 测试补齐 | P2 | test | T6-02, T6-06 |

---

## 3. 任务拆解

### T6-01 数据库 Schema 扩展（P0）

**目标**
- 新建 `generated_contents` 和 `collection_logs` 两张表
- 扩展 `categories` 表增加调度配置字段

**子任务**

1. `generated_contents` 表：id, categoryId, topic, content, style, personaId, status(draft/reviewed/published/archived), wikiContext, titles, coverPrompt, sourceType(manual/pipeline), createdAt, updatedAt
2. `collection_logs` 表：id, categoryId, keywordId, keywordName, platform, status(success/failed), articleCount, errorMsg, startedAt, completedAt
3. `categories` 表新增：scheduleEnabled, scheduleInterval, autoIngest, ingestTopN
4. 在 db.ts 中添加对应的 CRUD 函数
5. 在 types.ts 中添加对应类型定义
6. 数据库初始化时自动建表（IF NOT EXISTS）

**交付物**
- 更新后的 db.ts、types.ts

**验收标准**
- `npx tsc --noEmit` 零错误
- 新表可通过 DB 函数正常读写
- 旧表不受影响

---

### T6-02 生成内容 CRUD API（P0）

**目标**
- 提供 AI 生成内容的完整 CRUD 接口

**子任务**

1. `POST /api/contents` — 创建生成内容（topic, content, style, personaId, status, wikiContext, titles, coverPrompt, sourceType, categoryId）
2. `GET /api/contents` — 列表查询（支持分页 page/pageSize，筛选 status/categoryId，搜索 topic）
3. `GET /api/contents/[id]` — 单条详情
4. `PUT /api/contents/[id]` — 更新内容/状态
5. `DELETE /api/contents/[id]` — 删除
6. 统一错误格式（复用第五轮的标准）

**交付物**
- 4 个路由文件

**验收标准**
- CRUD 全链路可用
- 分页、筛选、搜索正常
- 错误返回格式一致

---

### T6-03 内容历史 Tab 前端（P0）

**目标**
- 新建侧边栏「内容历史」Tab，展示所有 AI 生成内容

**子任务**

1. 新建 `ContentHistoryTab.tsx` 组件
2. 内容列表展示（卡片/列表视图）：
   - 显示主题、正文预览、状态标签、风格、创建时间
   - 状态筛选按钮组（全部/草稿/已审核/已发布/已归档）
   - 分类下拉筛选
   - 搜索框
3. 内容详情展开：
   - 完整正文展示
   - 标题列表展示
   - 封面提示词展示
   - 编辑按钮（进入编辑模式）
   - 状态变更按钮（草稿→已审核→已发布→已归档）
   - 复制按钮
   - 删除按钮
4. 在 `page.tsx` 侧边栏新增「内容历史」导航项（图标用 FileText 或 Archive）
5. 分页加载

**交付物**
- ContentHistoryTab.tsx
- 更新后的 page.tsx

**验收标准**
- 可查看所有生成内容
- 可按状态、分类筛选
- 可搜索主题
- 可编辑内容和变更状态
- 可删除和复制

---

### T6-04 WritingTab 自动保存集成（P0）

**目标**
- AI 写文生成完成后自动保存到后端
- 替换 mock publish 为真实状态变更

**子任务**

1. SSE 流式生成完成（收到 `type: "done"`）后，调用 `POST /api/contents` 保存
2. 保存内容包括：topic, content, style, personaId, wikiContext, titles, coverPrompt
3. sourceType 标记为 `manual`
4. 初始状态为 `draft`
5. 「发布」按钮改为调用 `PUT /api/contents/[id]` 将状态改为 `published`
6. 在 UI 上显示保存状态提示（如「已保存为草稿」）

**交付物**
- 更新后的 WritingTab.tsx

**验收标准**
- 生成完成后内容自动出现在「内容历史」
- 页面刷新后内容不丢失
- 发布按钮实际改变内容状态

---

### T6-05 修复 autoIngest 开关（P0）

**目标**
- 让 SettingsTab 中的 autoIngest 开关真正生效

**子任务**

1. 修复 SettingsTab `handleRefresh`：将 `autoIngestEnabled` 和 `ingestTopN` 传入请求体
2. 验证 `/api/refresh` 已正确处理 `autoIngest` 和 `ingestTopN` 参数（检查现有代码）
3. 前端显示 autoIngest 执行状态反馈

**交付物**
- 修复后的 SettingsTab.tsx

**验收标准**
- 开启 autoIngest 后，采集完成自动触发 Wiki 摄入
- 关闭 autoIngest 后，采集完成不触发 Wiki 摄入
- UI 上的开关与实际行为一致

---

### T6-06 定时调度后端（P1）

**目标**
- 实现服务端定时采集任务

**子任务**

1. 安装 `node-cron` 依赖
2. 创建 `src/lib/scheduler.ts`：
   - `initScheduler()` — 从数据库加载所有启用调度的分类，注册 cron 任务
   - `addSchedule(categoryId, interval)` — 注册单个调度
   - `removeSchedule(categoryId)` — 移除调度
   - `reloadSchedules()` — 重新加载所有调度
3. 调度触发时：
   - 遍历该分类下所有关键词
   - 对每个关键词调用采集逻辑（复用 refresh 核心代码）
   - 记录采集日志到 `collection_logs`
   - 如果 autoIngest 开启，采集后自动 Ingest
4. `GET /api/schedule` — 获取调度状态列表
5. `POST /api/schedule` — 更新调度配置（categoryId, enabled, interval, autoIngest, ingestTopN）
6. `GET /api/collection-logs` — 获取采集日志（分页，按 categoryId 筛选）
7. Next.js 启动时初始化调度器（通过 instrumentation.ts 或在首次 API 调用时懒加载）

**注意**
- Next.js 的 serverless 模式下 cron 不持久，需要接受这个限制
- 方案：首次调用 schedule API 时初始化调度器，配置变更时重载
- 单进程模式即可，不做分布式

**交付物**
- scheduler.ts
- 3 个 API 路由
- 更新后的 db.ts（categories 表扩展）

**验收标准**
- 配置调度后，到时间点自动采集
- 采集日志可查询
- 修改调度配置后立即生效
- 服务重启后调度自动恢复

---

### T6-07 调度配置 UI + 采集日志（P1）

**目标**
- 在监控设置 Tab 中增加调度配置和采集日志展示

**子任务**

1. 在 SettingsTab 顶部增加「调度配置」区块：
   - 当前分类的调度开关
   - 采集间隔下拉选择
   - autoIngest 开关 + Top N 输入
   - 保存按钮 → 调用 `POST /api/schedule`
2. 在 SettingsTab 底部增加「采集日志」区块：
   - 展示最近 20 条采集记录
   - 每条显示：时间、关键词、平台、状态（成功/失败）、采集数量
   - 失败记录显示错误信息
3. 自动加载当前分类的调度配置

**交付物**
- 更新后的 SettingsTab.tsx

**验收标准**
- 可配置当前分类的定时采集计划
- 配置保存后立即生效
- 采集日志可查看最近记录

---

### T6-08 Pipeline 产出自动保存（P1）

**目标**
- 8 步管道完成时自动将最终内容保存到 generated_contents

**子任务**

1. 在 pipeline.ts 的完成回调中，调用 `createGeneratedContent()`
2. 保存内容包括：topic、最终正文、scores、style
3. sourceType 标记为 `pipeline`
4. 关联 categoryId
5. 在 PipelineProgressPanel 中显示「已保存为草稿」提示

**交付物**
- 更新后的 pipeline.ts
- 更新后的 PipelineProgressPanel.tsx

**验收标准**
- 管道完成后产出出现在「内容历史」
- sourceType 正确标记为 pipeline

---

### T6-09 测试补齐（P2）

**目标**
- 为新增功能补齐测试

**覆盖范围**

1. **单元测试**：
   - db.ts 新增函数（generated_contents 和 collection_logs CRUD）
   - scheduler.ts 核心逻辑
2. **API 集成测试**：
   - `/api/contents` CRUD
   - `/api/schedule` 配置
   - `/api/collection-logs` 查询
3. **回归验证**：
   - 确保现有 147 个测试不受影响
   - 修复第五轮遗留的 4 个失败测试

**交付物**
- 新增测试文件
- 全量测试通过报告

**验收标准**
- 新增功能有测试覆盖
- 全量测试通过率 ≥ 98%

---

## 4. 推荐执行顺序

### 第一阶段：基础设施（P0，无外部依赖）

1. T6-01 数据库 Schema 扩展
2. T6-05 修复 autoIngest 开关（独立，可并行）

### 第二阶段：内容历史（P0）

3. T6-02 生成内容 CRUD API
4. T6-03 内容历史 Tab（依赖 T6-02）
5. T6-04 WritingTab 自动保存（依赖 T6-02）

### 第三阶段：自动化采集（P1）

6. T6-06 定时调度后端
7. T6-07 调度配置 UI + 采集日志
8. T6-08 Pipeline 产出自动保存

### 第四阶段：质量保障（P2）

9. T6-09 测试补齐

---

## 5. 建议分工

### backend

- T6-01 数据库扩展
- T6-02 内容 CRUD API
- T6-05 autoIngest 修复（后端部分）
- T6-06 定时调度
- T6-08 Pipeline 保存

### frontend

- T6-03 内容历史 Tab
- T6-04 WritingTab 自动保存
- T6-05 autoIngest 修复（前端部分）
- T6-07 调度 UI + 日志

### test

- T6-09 测试补齐

---

## 6. 风险与约束

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| Next.js serverless 模式下 cron 不持久 | 调度重启后丢失 | 首次 API 调用时从 DB 恢复调度 |
| node-cron 在 Vercel 上不可用 | 定时采集失效 | 本地部署模式可用；Vercel 环境用 Vercel Cron |
| 生成内容量大时查询性能 | 列表加载慢 | 分页 + 索引 |
| SSE 流式内容截断风险 | 保存不完整 | 在 `done` 事件后保存，确保完整 |

---

## 7. 一句话总结

**让采集自动化、让 AI 产出可追溯。**
