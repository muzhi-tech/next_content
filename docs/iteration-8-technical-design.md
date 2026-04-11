# 第八轮迭代技术设计

## 一、 迭代背景与目标

在前七轮迭代完成了核心采集、AI 写作管道、Wiki 知识引擎以及自动化调度等基础建设后，第八轮迭代的核心目标是 **优化内容生产的工作流体验与精细化控制**。

主要聚焦于以下三大核心需求：
1. **数据分析面板增强**：直观展示 Agent 工作流的漏斗转化、成功率与耗时。*(已部分实现)*
2. **API 配置隔离**：区分「文案生成」与「图片生成」的独立大模型配置。
3. **公众号排版深度集成**：彻底抛弃 Iframe 方案，将开源工具 `raphael-publish` 源码级集成至本系统，实现「AI 写作 -> 自动套用排版模板 -> 一键复制发布」的顺滑体验。

---

## 二、 核心需求详情与技术方案

### 需求 1：数据分析面板增强 (Agent 状态与执行监控)

**背景：**
现有的数据面板仅展示采集与产出总量，缺乏对 8 环节 Agent 管道（采集、选题、写作、打分、去AI化、审核、配图、发布）健康度的细粒度监控。

**技术方案：**
- **数据源**：读取 `pipeline_runs` 表中的最新 100 条记录。
- **指标计算**：按环节统计被触发的总次数、成功/失败数、成功率（%）、以及基于 `startedAt` 和 `completedAt` 计算的平均耗时。
- **UI 呈现**：在 `AnalyticsTab.tsx` 底部增加工作流各 Agent 执行统计的进度条与指标看板。

---

### 需求 2：API 配置隔离 (文案大模型 vs 绘图大模型)

**背景：**
目前系统只有一个全局默认的 `api_configs`。但在实际生产（如公众号图文）中，文本写作往往使用 Claude/GPT，而封面或配图需要调用专用的绘画模型（如 Gemini、Midjourney、DALL-E API）。

**技术方案：**
- **数据库扩展 (`src/lib/db.ts`)**：
  - 在 `api_configs` 表中新增字段（如 `isDefaultImage INTEGER DEFAULT 0` 或通用的 `type TEXT`）。
- **UI 调整 (`src/components/ApiConfigSelector.tsx`)**：
  - 在创建和编辑表单中增加「配置类型」的选项（文本模型 / 绘图模型）。
  - 在列表中直观区分默认文本模型与默认绘图模型。
- **调度逻辑 (`src/lib/pipeline.ts`)**：
  - 在初始化 Pipeline 时，分别拉取默认的 Text API Config 和 Image API Config。
  - 将 Text Config 传递给选题、写作、打分、去AI、审核 Agent。
  - 将 Image Config 单独传递给配图（Illustrate）Agent。

---

## 三、 公众号排版深度集成方案 (基于 raphael-publish)

**背景：**
为了让 AI 生成的 Markdown 内容能够直接、美观地粘贴到微信公众号后台，需要引入并二开 `raphael-publish`，使其与 Next.js 项目无缝融合，并且继承其丰富的排版模板。

### 3.1 整合路径规划

1. **依赖对齐 (Dependency Alignment)**：
   - 在本项目的 `package.json` 中补充 `raphael-publish` 的核心解析依赖，如 `marked`、`highlight.js` (或相近代码高亮库)、以及内联 CSS 的工具方法。
2. **核心引擎迁移 (Core Engine Migration)**：
   - 创建 `src/lib/typeset/` 目录。
   - 提取原项目的 Markdown 渲染引擎（Renderer）和微信特性转换器（如处理图片防盗链、转换脚注等逻辑）。
3. **模板与样式继承 (Theme & Template Porting)**：
   - 创建 `src/components/TypesetTab/themes/` 目录。
   - 迁移原项目内置的多套 CSS 主题配置（Theme Variables）。
   - 将这部分数据与系统的「账号空间（Account Space）」打通，未来可支持给不同账号绑定默认的排版模板。
4. **UI 重构 (UI Reconstruction)**：
   - 用 Tailwind CSS 重写原项目的 Vue/React UI，使其完全融入现有的 Dashboard 风格。
   - 实现左侧「Markdown 编辑 + 主题配置面板」，右侧「移动端/PC 端实时富文本预览面板」。

### 3.2 交互流转设计

- **入口**：在主导航新增「公众号排版」Tab，并支持从「AI 写作」或「内容历史」详情中点击「一键去排版」直接跳转并携带 Markdown 数据。
- **操作**：用户可在左侧修改 Markdown，在顶部切换主题模板（如：默认、极简、商务等），右侧实时预览公众号最终效果。
- **出口**：提供「复制到微信公众号」按钮，点击后自动执行 CSS 内联（Inline CSS）并写入系统剪贴板。

---

## 四、 阶段验收标准 (Definition of Done)

1. `AnalyticsTab` 成功渲染 8 大 Agent 的成功率与平均耗时。*(✅ 已完成)*
2. API 配置支持明确区分「文本」与「绘图」类型，且 Pipeline 正确路由至不同的模型 API。
3. `TypesetTab` 成功替代 Iframe 方案，原生渲染 Markdown，支持切换至少 3 套内置模板。
4. 提供一键复制富文本的功能，并能在微信公众号后台无损粘贴（样式、代码块、图片等均无异常）。
