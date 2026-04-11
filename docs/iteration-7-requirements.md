# 第七轮迭代需求文档（PRD）

## 1. 迭代背景

六轮迭代已完成核心功能闭环：多平台采集 → AI 写作 → 8步管道 → 定时调度 → 内容历史。系统从「能跑」进化到「能用」。

当前系统现状：
- ✅ 小红书、公众号两大平台内容监控
- ✅ AI 标题/封面/正文生成（SSE 流式）
- ✅ Wiki 知识引擎（摄入/查询/检查/索引）
- ✅ 8 环节 Agent 管道（采→选→写→打→去AI→审→配→发）
- ✅ 定时采集调度（node-cron）
- ✅ AI 生成内容持久化（草稿→已审核→已发布→已归档）
- ✅ 210 测试用例覆盖

---

## 2. 本轮迭代目标

**一句话：让数据可见、让 Agent 状态可感知。**

两个核心方向：
1. **数据分析仪表板** — 平台分布、采集趋势、内容状态、关键词热度，一目了然
2. **Agent 状态监控** — 8 大环节管道状态实时可见，执行/空闲/完成/失败一目了然

---

## 3. 功能需求

### 3.1 数据分析仪表板（P0）

#### 3.1.1 数据统计

| 统计维度 | 指标 | 数据来源 |
|---------|------|---------|
| 内容总量 | 总文章数、本周新增 | articles 表 |
| 平台分布 | 各平台文章数量占比 | articles.platform |
| 采集动态 | 近7天采集数量趋势 | collection_logs |
| 内容产出 | AI 生成内容数量、状态分布 | generated_contents |
| 关键词热度 | Top 10 关键词（按关联文章数）| keywords + articles |

#### 3.1.2 可视化

- 平台分布：**饼图**（CSS conic-gradient）
- 采集趋势：**折线图**（SVG polyline）
- 内容状态：**环形图**（CSS conic-gradient）
- 关键词热度：**水平条形图**（CSS flexbox）

**技术选型**：纯 CSS + SVG 实现，不引入 ECharts/D3 等重量库。

#### 3.1.3 数据刷新

- 页面加载时主动请求
- 支持手动刷新按钮
- 不做自动轮询

---

### 3.2 Agent 状态监控（P0）

#### 3.2.1 监控范围

8 大 Agent 管道环节：

| 环节 | Agent 名称 | 可能状态 |
|------|------------|---------|
| 1 | 采集 Agent | idle / running / completed / failed |
| 2 | 选题 Agent | idle / running / completed / failed |
| 3 | 写作 Agent | idle / running / completed / failed |
| 4 | 打分 Agent | idle / running / completed / failed |
| 5 | 去AI化 Agent | idle / running / completed / failed |
| 6 | 审核 Agent | idle / running / completed / failed |
| 7 | 配图 Agent | idle / running / completed / failed |
| 8 | 发布 Agent | idle / running / completed / failed |

#### 3.2.2 状态展示

- 当前正在执行的 Agent 高亮显示（running 状态）
- 每个环节显示：环节名称、状态、时间
- 支持查看当前 Pipeline Run 的完整状态

#### 3.2.3 状态来源

从 `pipeline_runs` 表读取当前 running 状态的管道，取 `steps` 数组中每个 step 的状态。

#### 3.2.4 刷新机制

- 每 3 秒轮询一次 `/api/pipeline` 获取最新状态
- 管道完成后停止轮询

---

## 4. 非目标

本轮迭代不处理：

- 内容导出（Markdown/PDF）
- 微信公众号 OAuth 授权和真实发布
- B站平台接入
- 多模型切换
- 复杂的数据对比或自定义报表
- Agent 控制（启动/暂停/停止）

---

## 5. 交付物

### P0 必须交付
1. 数据分析仪表板（平台分布、采集趋势、内容状态、关键词热度）
2. Agent 状态监控面板（8 环节状态实时展示）

### P1 期望交付
3. 数据统计 API 聚合端点
4. Pipeline 状态轮询机制

---

## 6. 验收标准

### 数据分析
- [ ] 平台分布饼图显示正确（xhs/wx 文章数量）
- [ ] 近7天采集趋势折线图正确
- [ ] AI 生成内容状态环形图正确
- [ ] Top 10 关键词列表正确
- [ ] 页面加载 < 1s

### Agent 状态监控
- [ ] 8 个环节状态清晰展示（idle/running/completed/failed）
- [ ] 当前运行环节高亮
- [ ] 状态自动轮询更新
- [ ] 管道完成后显示最终状态
