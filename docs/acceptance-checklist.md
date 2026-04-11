# 主链路验收清单

本文档定义内容监控与选题分析平台的核心功能验收标准。

---

## 验收环境准备

- [ ] 数据库已初始化（`data/content.db` 存在）
- [ ] 环境变量已配置（`XHS_API_KEY`, `WX_API_KEY` 等）
- [ ] 默认 API 配置已设置（通过 `/api/config` 或环境变量）
- [ ] 至少存在一个分类（通过 `/api/categories` 创建）

---

## 主链路 10 步验收

### 步骤 1：创建分类和关键词

**目标：** 验证基础数据管理功能

- [ ] 1.1 通过 `POST /api/categories` 创建一个分类（如"科技"）
- [ ] 1.2 通过 `GET /api/categories` 验证分类创建成功
- [ ] 1.3 通过 `POST /api/keywords` 创建关键词（指定 platforms 和 categoryId）
- [ ] 1.4 通过 `GET /api/keywords` 验证关键词创建成功

**验收标准：**
- 响应 `code: 0`
- 返回的数据包含正确的 id、name、createdAt 等字段

---

### 步骤 2：平台数据采集（小红书）

**目标：** 验证小红书数据采集功能

- [ ] 2.1 通过 `POST /api/platforms/xhs-search` 搜索关键词
- [ ] 2.2 验证返回数据包含 items 数组
- [ ] 2.3 验证单条数据包含 title、content、author 等字段

**验收标准：**
- 响应 `code: 0`
- `data.items` 是数组且长度 > 0

---

### 步骤 3：平台数据采集（公众号）

**目标：** 验证公众号数据采集功能

- [ ] 3.1 通过 `POST /api/platforms/wx-search` 搜索关键词
- [ ] 3.2 验证返回数据结构正确
- [ ] 3.3 或通过 `GET /api/wx-articles` 代理方式获取

**验收标准：**
- 响应 `code: 0`
- 返回有效的文章数据

---

### 步骤 4：刷新数据并存储

**目标：** 验证数据刷新和存储功能

- [ ] 4.1 通过 `POST /api/refresh` 刷新指定关键词的数据
- [ ] 4.2 验证响应中各平台 success 状态
- [ ] 4.3 通过 `GET /api/articles?keywordId=xxx` 查询已采集的文章

**验收标准：**
- `/api/refresh` 返回各平台的采集数量
- `/api/articles` 能查询到刚采集的文章

---

### 步骤 5：Wiki 内容摄取

**目标：** 验证 Wiki 知识引擎的摄取功能

- [ ] 5.1 通过 `POST /api/wiki/ingest` 提取文章内容到 Wiki
- [ ] 5.2 验证返回 updatedEntities、updatedTopics、createdPages
- [ ] 5.3 通过 `GET /api/wiki/index?categoryId=xxx` 查看索引

**验收标准：**
- `/api/wiki/ingest` 返回摄取的实体和主题数量
- `/api/wiki/index` 返回 entities 和 topics 数组

---

### 步骤 6：账号空间配置

**目标：** 验证人设、风格、知识库、模板配置

- [ ] 6.1 通过 `POST /api/account-space/personas` 创建人设
- [ ] 6.2 通过 `POST /api/account-space/styles` 创建风格
- [ ] 6.3 通过 `POST /api/account-space/knowledge` 创建知识库
- [ ] 6.4 通过 `POST /api/account-space/templates` 创建模板

**验收标准：**
- 所有创建请求返回 `code: 0` 和有效的 id
- 通过 GET 请求能获取到刚创建的配置

---

### 步骤 7：AI 内容生成

**目标：** 验证 AI 生成正文功能

- [ ] 7.1 通过 `POST /api/content/generate` 生成文章正文
- [ ] 7.2 验证 SSE 流式响应正确
- [ ] 7.3 验证返回 meta 帧和 content 帧
- [ ] 7.4 验证最终收到 `{"type":"done"}` 帧

**验收标准：**
- SSE 连接成功
- 接收到至少一个 content 帧
- 最终收到 done 帧

---

### 步骤 8：AI 标题和封面生成

**目标：** 验证 AI 生成标题和封面功能

- [ ] 8.1 通过 `POST /api/content/titles` 生成标题候选
- [ ] 8.2 验证返回 titles 数组且包含 title 和 summary
- [ ] 8.3 通过 `POST /api/content/cover/prompts` 生成封面 Prompt
- [ ] 8.4 验证返回 prompt 和 negativePrompt

**验收标准：**
- `/api/content/titles` 返回至少 3 个标题候选
- `/api/content/cover/prompts` 返回有效的提示词

---

### 步骤 9：自进化管道

**目标：** 验证 8 大 Agent 协同管道

- [ ] 9.1 通过 `POST /api/pipeline` 启动管道（指定 categoryId）
- [ ] 9.2 验证响应返回 pipelineId
- [ ] 9.3 通过 `GET /api/pipeline/[id]` 查询管道状态
- [ ] 9.4 验证 steps 数组包含 8 个步骤

**验收标准：**
- 管道能成功启动
- 状态查询返回正确的 currentStepIndex
- 最终状态为 completed 或 failed（有明确错误信息）

---

### 步骤 10：选题报告生成

**目标：** 验证报告生成功能

- [ ] 10.1 通过 `POST /api/report/generate` 生成报告
- [ ] 10.2 验证返回 summary、topics 数组
- [ ] 10.3 验证每个 topic 包含 why、boom、growth 字段
- [ ] 10.4 通过 `GET /api/report/list` 查询历史报告

**验收标准：**
- 报告生成成功，topics 数组长度 > 0
- 每个选题包含完整的分析字段

---

## 边界情况测试

### 错误处理

- [ ] 传入无效的 keywordId，验证返回 404 错误
- [ ] 传入空的 keyword，验证返回 400 错误
- [ ] 管道并发启动（同一 categoryId），验证返回 409 冲突错误

### 空数据处理

- [ ] 查询不存在的分类的文章，返回空数组
- [ ] Wiki 摄取空内容，不影响已有数据
- [ ] 无 API 配置时调用生成接口，返回明确错误提示

---

## 健康检查

- [ ] 通过 `GET /api/health` 验证系统状态
- [ ] 验证返回 db、apiConfig、hasCategories、xhsKey、wxKey 字段

---

## 验收通过标准

**P0 核心功能：** 步骤 1-5 必须全部通过
**P1 高价值功能：** 步骤 6-10 至少通过 80%
**边界情况：** 错误处理和空数据处理至少通过 50%

---

## 验收记录模板

| 日期 | 验收人 | 通过步骤 | 失败步骤 | 备注 |
|------|--------|----------|----------|------|
| 2026-04-08 | docs-agent | - | - | 待验收 |
