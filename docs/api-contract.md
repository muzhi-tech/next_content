# API 契约文档

本文档定义内容监控系统的 API 接口规范。

---

## API 快速索引

| 模块 | 路由 | 方法 | 说明 |
|------|------|------|------|
| **健康检查** | `/api/health` | GET | 系统健康检查 |
| **关键词管理** | `/api/keywords` | GET/POST | 关键词列表/创建 |
| | `/api/keywords/[id]` | GET/PUT/DELETE | 关键词详情/更新/删除 |
| **分类管理** | `/api/categories` | GET/POST | 分类列表/创建 |
| | `/api/categories/[id]` | DELETE | 删除分类 |
| **文章管理** | `/api/articles` | GET | 文章列表（分页、筛选） |
| | `/api/wx-articles` | GET | 公众号文章代理 |
| **数据刷新** | `/api/refresh` | POST | 刷新指定平台数据 |
| **平台搜索** | `/api/platforms/xhs` | POST | 小红书搜索（原始） |
| | `/api/platforms/xhs-search` | POST | 小红书搜索（标准） |
| | `/api/platforms/wx` | POST | 公众号搜索（原始） |
| | `/api/platforms/wx-search` | POST | 公众号搜索（标准） |
| **账号空间-人设** | `/api/account-space/personas` | GET/POST | 人设列表/创建 |
| | `/api/account-space/personas/[id]` | GET/PUT/DELETE | 人设详情/更新/删除 |
| **账号空间-风格** | `/api/account-space/styles` | GET/POST | 风格列表/创建 |
| | `/api/account-space/styles/[id]` | GET/PUT/DELETE | 风格详情/更新/删除 |
| **账号空间-知识库** | `/api/account-space/knowledge` | GET/POST | 知识库列表/创建 |
| | `/api/account-space/knowledge/[id]` | GET/PUT/DELETE | 知识库详情/更新/删除 |
| **账号空间-模板** | `/api/account-space/templates` | GET/POST | 模板列表/创建 |
| | `/api/account-space/templates/[id]` | GET/PUT/DELETE | 模板详情/更新/删除 |
| **Wiki 引擎** | `/api/wiki/ingest` | POST | 文章内容提取并合并到 Wiki |
| | `/api/wiki/upload` | POST | 上传本地 Markdown 并提取到 Wiki |
| | `/api/wiki/index` | GET | Wiki 页面概览 |
| | `/api/wiki/[categoryId]` | GET | Wiki 页面内容和日志 |
| | `/api/wiki/lint` | POST | Wiki 健康检查 |
| **AI 内容生成** | `/api/content/generate` | POST | 生成文章正文（通用） |
| | `/api/content/write` | POST | 基于 Wiki 写文（深度） |
| | `/api/content/titles` | POST | 生成文章标题候选 |
| | `/api/content/cover/prompts` | POST | 生成封面图 Prompt |
| | `/api/content/cover` | POST | 生成封面图（调用 API） |
| **自进化管道** | `/api/pipeline` | GET/POST | 列出管道/启动管道 |
| | `/api/pipeline/[id]` | GET | 查询管道状态 |
| **报告生成** | `/api/report/generate` | POST | 生成选题分析报告 |
| | `/api/report/list` | GET | 获取历史报告列表 |
| **API 配置** | `/api/config` | GET/POST | 配置列表/创建配置 |
| | `/api/config/[id]` | PUT/DELETE | 更新/删除配置 |

---

## 通用说明

### 请求格式
- Content-Type: `application/json`
- 请求体使用 JSON 格式

### 响应格式
```typescript
// 成功响应
{
  code: 0,
  data: T,
  total?: number  // 分页时返回
}

// 错误响应
{
  code: number,  // 非 0
  msg: string
}
```

**SSE 流式响应错误格式**（仅在 SSE 内部使用）:
```typescript
// SSE 内部错误帧
{ error: string }
```

### 状态码说明
| code | 说明 |
|------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如管道并发） |
| 500 | 服务器内部错误 |

---

## 关键词管理

### GET /api/keywords
获取关键词列表

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 否 | 按分类筛选 |

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "1234567890-abc123",
      "name": "人工智能",
      "platforms": ["xhs", "wx", "dy"],
      "categoryId": "cat-001",
      "createdAt": 1712500000000,
      "updatedAt": 1712500000000
    }
  ]
}
```

---

### POST /api/keywords
创建关键词

**请求体：**
```json
{
  "name": "人工智能",
  "platforms": ["xhs", "wx", "dy", "bilibili", "weibo"],
  "categoryId": "cat-001"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 关键词名称 |
| platforms | string[] | 是 | 启用的平台列表 |
| categoryId | string | 是 | 所属分类ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "1234567890-xyz789",
    "name": "人工智能",
    "platforms": ["xhs", "wx", "dy"],
    "categoryId": "cat-001",
    "createdAt": 1712500000000,
    "updatedAt": 1712500000000
  }
}
```

---

### PUT /api/keywords/[id]
更新关键词

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 关键词ID |

**请求体：**
```json
{
  "name": "AI",
  "platforms": ["xhs", "wx"]
}
```

**说明：** 所有字段可选，只更新提供的字段

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "1234567890-xyz789",
    "name": "AI",
    "platforms": ["xhs", "wx"],
    "categoryId": "cat-001",
    "createdAt": 1712500000000,
    "updatedAt": 1712500001000
  }
}
```

---

### DELETE /api/keywords/[id]
删除关键词

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 关键词ID |

**说明：** 删除关键词时会同时删除关联的文章

**响应示例：**
```json
{
  "code": 0,
  "msg": "deleted"
}
```

---

## 文章管理

### GET /api/articles
获取文章列表

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keywordId | string | 否 | 按关键词筛选 |
| platform | string | 否 | 按平台筛选 (xhs/wx/dy/bilibili/weibo) |
| categoryId | string | 否 | 按分类筛选 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20 |

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "art-001",
      "keywordId": "1234567890-abc123",
      "keywordName": "人工智能",
      "platform": "xhs",
      "title": "小红书笔记标题",
      "content": "笔记正文内容...",
      "author": "作者名称",
      "authorAvatar": "https://example.com/avatar.jpg",
      "url": "https://www.xiaohongshu.com/explore/xxx",
      "coverImage": "https://example.com/cover.jpg",
      "likes": 100,
      "comments": 20,
      "shares": 10,
      "publishedAt": 1712400000000,
      "collectedAt": 1712500000000,
      "isOriginal": false,
      "extra": {}
    }
  ],
  "total": 100
}
```

---

### GET /api/wx-articles
公众号文章代理（GET 方式，用于直接调用第三方 API）

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 否 | 搜索关键词，默认 "AI" |
| page | number | 否 | 页码，默认 1 |
| period | number | 否 | 时间范围(天)，默认 7 |
| sort_type | number | 否 | 排序类型，默认 1 |

**响应：** 直接透传第三方 API 响应

---

## 分类管理

### GET /api/categories
获取分类列表

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "cat-001",
      "name": "科技",
      "createdAt": 1712500000000,
      "updatedAt": 1712500000000
    }
  ]
}
```

---

### POST /api/categories
创建分类

**请求体：**
```json
{
  "name": "科技"
}
```

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "cat-002",
    "name": "科技",
    "createdAt": 1712500000000,
    "updatedAt": 1712500000000
  }
}
```

---

### DELETE /api/categories/[id]
删除分类

**响应示例：**
```json
{
  "code": 0,
  "msg": "deleted"
}
```

---

## 系统健康检查

### GET /api/health
系统健康检查端点，用于验证服务和配置状态。

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "db": "ok",
    "apiConfig": true,
    "hasCategories": true,
    "xhsKey": true,
    "wxKey": true
  }
}
```

**字段说明：**
| 字段 | 类型 | 说明 |
|------|------|------|
| db | string | 数据库状态 |
| apiConfig | boolean | API 配置是否存在 |
| hasCategories | boolean | 是否有分类数据 |
| xhsKey | boolean | 小红书 API Key 是否配置 |
| wxKey | boolean | 微信 API Key 是否配置 |

---

## 数据刷新

### POST /api/refresh
刷新指定关键词指定平台的数据

**请求体：**
```json
{
  "keywordId": "1234567890-abc123",
  "platforms": ["xhs", "wx"],
  "autoIngest": false,
  "ingestTopN": 5
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keywordId | string | 是 | 关键词ID |
| platforms | string[] | 是 | 平台列表 |
| autoIngest | boolean | 否 | 是否自动采集到 Wiki，默认 false |
| ingestTopN | number | 否 | 自动采集数量，默认 5 |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "xhs": { "success": true, "count": 20 },
    "wx": { "success": true, "count": 15 }
  }
}
```

---

## 平台搜索

### POST /api/platforms/xhs-search
小红书搜索（标准接口）

**请求体：**
```json
{
  "keyword": "人工智能",
  "page": "1",
  "sort": "popularity",
  "note_time": "7d"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| page | string | 否 | 页码，默认 "1" |
| sort | string | 否 | 排序：popularity(最热)/time(最新)，默认 popularity |
| note_time | string | 否 | 时间范围：7d/30d/90d/365d/day，默认 7d |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "items": [...]
  }
}
```

---

### POST /api/platforms/xhs
小红书搜索（原始路由，与 xhs-search 参数略有不同）

**请求体：**
```json
{
  "keyword": "人工智能",
  "page": "1",
  "sort": "comment_descending",
  "note_time": "day"
}
```

---

### POST /api/platforms/wx-search
公众号搜索（标准接口）

**请求体：**
```json
{
  "keyword": "人工智能",
  "page": 1,
  "period": 30,
  "sort_type": 1
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| page | number | 否 | 页码，默认 1 |
| period | number | 否 | 时间范围(天)：7/30/90/180/365，默认 30 |
| sort_type | number | 否 | 排序类型，默认 1 |

---

### POST /api/platforms/wx
公众号搜索（原始路由）

**请求体：**
```json
{
  "keyword": "人工智能",
  "page": 1,
  "period": 7,
  "sort_type": 1
}
```

---

## 平台列表

| 平台 | code | 名称 | 状态 |
|------|------|------|------|
| xhs | xhs | 小红书 | 已实现 |
| wx | wx | 公众号 | 已实现 |
| dy | dy | 抖音 | 预留 |
| bilibili | bilibili | B站 | 预留 |
| weibo | weibo | 微博 | 预留 |

---

## 账号空间

### 概述

账号空间是一套用于配置 AI 创作人设、风格、知识库和公众号模板的模块。AI 创作时可根据这些配置自动组装系统提示词，生成符合特定人设和风格的内容。

### 数据模型

#### Persona（人设）
```typescript
interface Persona {
  id: string;
  name: string;              // 人设名称
  description: string;       // 人设描述
  avatar?: string;          // 头像 URL
  systemPrompt: string;     // 系统提示词
  createdAt: number;
  updatedAt: number;
}
```

#### Style（风格）
```typescript
interface Style {
  id: string;
  name: string;              // 风格名称
  icon: string;             // 图标 emoji
  systemPrompt: string;     // 系统提示词
  createdAt: number;
  updatedAt: number;
}
```

#### KnowledgeBase（知识库）
```typescript
interface KnowledgeBase {
  id: string;
  name: string;             // 知识库名称
  description: string;      // 描述
  content: string;          // 知识内容
  createdAt: number;
  updatedAt: number;
}
```

#### WxTemplate（公众号模板）
```typescript
interface WxTemplate {
  id: string;
  name: string;              // 模板名称
  titleTemplate: string;    // 标题模板（支持 {变量} 格式）
  contentTemplate: string;   // 内容模板
  coverPromptTemplate?: string; // 封面提示词模板
  createdAt: number;
  updatedAt: number;
}
```

---

## 人设管理

### GET /api/account-space/personas
获取人设列表

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "persona-001",
      "name": "科技小达人",
      "description": "专注科技领域解读，风格犀利",
      "avatar": "https://example.com/avatar.jpg",
      "systemPrompt": "你是一位资深的科技评论员，擅长用通俗易懂的语言解读复杂的科技产品...",
      "createdAt": 1712500000000,
      "updatedAt": 1712500000000
    }
  ]
}
```

---

### POST /api/account-space/personas
创建人设

**请求体：**
```json
{
  "name": "科技小达人",
  "description": "专注科技领域解读，风格犀利",
  "avatar": "https://example.com/avatar.jpg",
  "systemPrompt": "你是一位资深的科技评论员，擅长用通俗易懂的语言解读复杂的科技产品..."
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 人设名称 |
| description | string | 是 | 人设描述 |
| avatar | string | 否 | 头像 URL |
| systemPrompt | string | 是 | 系统提示词（AI 调用用） |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "persona-002",
    "name": "科技小达人",
    "description": "专注科技领域解读，风格犀利",
    "avatar": "https://example.com/avatar.jpg",
    "systemPrompt": "你是一位资深的科技评论员...",
    "createdAt": 1712500000000,
    "updatedAt": 1712500000000
  }
}
```

---

### GET /api/account-space/personas/:id
获取单个

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 人设ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "persona-001",
    "name": "科技小达人",
    "description": "专注科技领域解读，风格犀利",
    "avatar": "https://example.com/avatar.jpg",
    "systemPrompt": "你是一位资深的科技评论员...",
    "createdAt": 1712500000000,
    "updatedAt": 1712500000000
  }
}
```

---

### PUT /api/account-space/personas/:id
更新人设

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 人设ID |

**请求体：**
```json
{
  "name": "科技评论员",
  "systemPrompt": "更新后的系统提示词..."
}
```

**说明：** 所有字段可选，只更新提供的字段

---

### DELETE /api/account-space/personas/:id
删除人设

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 人设ID |

**响应示例：**
```json
{
  "code": 0,
  "msg": "deleted"
}
```

---

## 风格管理

### GET /api/account-space/styles
获取风格列表

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "style-001",
      "name": "科技媒体评论",
      "icon": "💻",
      "systemPrompt": "以专业科技媒体的视角评论产品...",
      "createdAt": 1712500000000,
      "updatedAt": 1712500000000
    }
  ]
}
```

---

### POST /api/account-space/styles
创建风格

**请求体：**
```json
{
  "name": "科技媒体评论",
  "icon": "💻",
  "systemPrompt": "以专业科技媒体的视角评论产品，强调数据分析和行业洞察..."
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 风格名称 |
| icon | string | 是 | 图标 emoji |
| systemPrompt | string | 是 | 系统提示词 |

---

### GET /api/account-space/styles/:id
获取单个

### PUT /api/account-space/styles/:id
更新风格

### DELETE /api/account-space/styles/:id
删除风格

---

## 知识库管理

### GET /api/account-space/knowledge
获取知识库列表

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "kb-001",
      "name": "AI知识库",
      "description": "AI相关知识汇总",
      "content": "人工智能、机器学习、深度学习是大语言模型的基础...",
      "createdAt": 1712500000000,
      "updatedAt": 1712500000000
    }
  ]
}
```

---

### POST /api/account-space/knowledge
创建知识库

**请求体：**
```json
{
  "name": "AI知识库",
  "description": "AI相关知识汇总",
  "content": "人工智能、机器学习、深度学习是大语言模型的基础..."
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 知识库名称 |
| description | string | 是 | 描述 |
| content | string | 是 | 知识内容 |

---

### GET /api/account-space/knowledge/:id
获取单个

### PUT /api/account-space/knowledge/:id
更新知识库

### DELETE /api/account-space/knowledge/:id
删除知识库

---

## 公众号模板管理

### GET /api/account-space/templates
获取模板列表

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "tpl-001",
      "name": "科技测评模板",
      "titleTemplate": "【测评】{产品名}",
      "contentTemplate": "开箱体验...\n优势...\n不足...\n总结...",
      "coverPromptTemplate": "科技感产品图，{产品名}，简洁背景",
      "createdAt": 1712500000000,
      "updatedAt": 1712500000000
    }
  ]
}
```

---

### POST /api/account-space/templates
创建模板

**请求体：**
```json
{
  "name": "科技测评模板",
  "titleTemplate": "【测评】{产品名}",
  "contentTemplate": "开箱体验...\n优势...\n不足...\n总结...",
  "coverPromptTemplate": "科技感产品图，{产品名}，简洁背景"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 模板名称 |
| titleTemplate | string | 是 | 标题模板（支持 {变量} 格式） |
| contentTemplate | string | 是 | 内容模板 |
| coverPromptTemplate | string | 否 | 封面提示词模板 |

---

### GET /api/account-space/templates/:id
获取单个

### PUT /api/account-space/templates/:id
更新模板

### DELETE /api/account-space/templates/:id
删除模板

---

## Wiki 知识引擎

### POST /api/wiki/ingest
将文章内容提取并合并到 Wiki 知识引擎中。

**请求体：**
```json
{
  "articleId": "article_001",
  "categoryId": "cat-001"
}
```

**响应示例：**
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

---

### POST /api/wiki/upload
上传本地 Markdown 文件并提取合并到 Wiki 知识引擎中。

**请求体（FormData）：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | Markdown 文件 (.md) |
| categoryId | string | 是 | 所属分类ID |

**响应示例：**
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

---

### GET /api/wiki/index
获取指定分类下的 Wiki 页面概览（实体与主题列表）。

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 是 | 按分类筛选 |

**响应示例：**
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

---

### GET /api/wiki/[categoryId]
获取 Wiki 页面内容和日志

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| categoryId | string | 分类ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "index": "index.md 内容",
    "log": "wiki.log 内容"
  }
}
```

---

### POST /api/wiki/lint
对指定分类的 Wiki 进行健康检查。

**请求体：**
```json
{ "categoryId": "cat-001" }
```

**响应示例：**
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

---

## AI 内容生成

### POST /api/content/generate
生成文章正文（SSE 流式输出）

**请求体：**
```json
{
  "topic": "最新款iPhone测评",
  "templateId": "tpl-001",
  "personaId": "persona-001",
  "styleId": "style-001",
  "knowledgeIds": ["kb-001", "kb-002"],
  "categoryId": "cat-001",
  "useWiki": true,
  "wikiMode": "full-context",
  "style": "tech",
  "keywords": ["iPhone", "Apple"],
  "length": "long"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | 是 | 主题/话题 |
| templateId | string | 否 | 模板 ID |
| personaId | string | 否 | 人设 ID |
| styleId | string | 否 | 风格 ID |
| knowledgeIds | string[] | 否 | 知识库 IDs |
| categoryId | string | 否 | 分类 ID（用于 Wiki 上下文） |
| useWiki | boolean | 否 | 是否使用 Wiki 上下文 |
| wikiMode | string | 否 | Wiki 模式：full-context/light |
| style | string | 否 | 旧版风格名称 |
| keywords | string[] | 否 | 关键词列表 |
| length | string | 否 | 文章长度 |
| apiUrl | string | 否 | 覆盖默认 API URL |
| apiKey | string | 否 | 覆盖默认 API Key |
| modelName | string | 否 | 覆盖默认模型名 |

**AI 调用流程：**
1. 根据 `personaId`、`styleId`、`knowledgeIds` 加载配置
2. 使用 `buildAIContext()` 构建系统提示词
3. 如果启用 `useWiki`，构建 Wiki 上下文
4. 结合 `topic` 和模板生成最终 Prompt
5. 调用 AI API 生成内容

**响应示例（SSE 流式）：**
```
data: {"meta":{"matchedPages":["topics/大模型闭源趋势.md","entities/OpenAI.md"]}}

data: {"type":"content","content":"先说结论，大模型行业正在加速闭源。"}

data: {"type":"done"}
```

**SSE 内部错误格式：**
```
data: {"error":"生成失败：API 超时"}
```

---

### POST /api/content/write
基于 Wiki 上下文写文（专注于深度 Wiki 模式）

**请求体：**
```json
{
  "topic": "聊聊大模型近期的封闭化趋势",
  "categoryId": "cat-001",
  "useWiki": true,
  "wikiMode": "full-context",
  "keywords": ["OpenAI", "Google"],
  "length": "long",
  "style": "tech",
  "personaId": "persona-001",
  "styleId": "style-001",
  "knowledgeIds": ["kb-001"],
  "templateId": "tpl-001"
}
```

**与 `/api/content/generate` 的区别：**
- `write` 专门为基于 Wiki 知识库的深度内容生成设计
- `generate` 是通用接口，支持更灵活的配置组合
- `write` 在 Wiki 上下文集成和主题相关性分析上更深入

**响应示例（SSE 流式）：**
```
data: {"meta":{"matchedPages":["topics/大模型闭源趋势.md"]}}

data: {"type":"content","content":"先说结论..."}

data: {"type":"done"}
```

---

### POST /api/content/titles
生成文章标题候选列表

**请求体：**
```json
{
  "topic": "AI大模型发展趋势",
  "article": "文章正文内容...",
  "count": 5,
  "personaId": "persona-001",
  "styleId": "style-001"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| article | string | 否 | 文章正文（与 topic 二选一） |
| topic | string | 否 | 主题/话题（与 article 二选一） |
| count | number | 否 | 生成数量，默认 5 |
| personaId | string | 否 | 人设 ID |
| styleId | string | 否 | 风格 ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "titles": [
      { "title": "AI大模型：2024年技术革命新起点", "summary": "探讨大模型在各领域的应用前景" },
      { "title": "深度解析：大语言模型的下一个风口", "summary": "从技术演进角度分析发展趋势" }
    ]
  }
}
```

---

### POST /api/content/cover/prompts
生成封面图 Prompt（仅返回提示词文本，不调用图片生成 API）

**请求体：**
```json
{
  "topic": "iPhone 15 Pro Max 测评",
  "content": "文章正文内容...",
  "style": "科技简约风",
  "personaId": "persona-001",
  "styleId": "style-001",
  "templateId": "tpl-001"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| topic | string | 是 | 主题/话题 |
| content | string | 否 | 文章正文（用于提炼关键点） |
| style | string | 否 | 风格偏好 |
| personaId | string | 否 | 人设 ID |
| styleId | string | 否 | 风格 ID |
| templateId | string | 否 | 模板 ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "prompt": "A sleek smartphone on a minimalist desk, professional product photography, soft natural lighting, Apple branding visible, clean white background, ultra-detailed, 8k",
    "negativePrompt": "watermark, text, logo, busy background, low quality, blurry"
  }
}
```

---

### POST /api/content/cover
生成封面图（实际调用图片生成 API，返回图片 URL）

**请求体：**
```json
{
  "topic": "iPhone 15 Pro Max 测评",
  "style": "科技简约风",
  "apiUrl": "https://api.example.com/v1",
  "apiKey": "sk-xxx",
  "modelName": "dall-e-3"
}
```

**与 `/api/content/cover/prompts` 的区别：**
- `cover/prompts` 只生成并返回提示词文本
- `cover` 会实际调用图片生成 API 并返回图片 URL

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "prompt": "...",
    "negativePrompt": "...",
    "imageUrl": "https://example.com/generated-image.jpg"
  }
}
```

---

## 自进化管道（8 大 Agent）

### POST /api/pipeline
启动 8 大 Agent 协同管道

**请求体：**
```json
{
  "categoryId": "cat-001",
  "keywordId": "keyword-001",
  "stream": true,
  "resumeFromPipelineId": "pipeline-123"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 条件必填 | 分类 ID（与 resumeFromPipelineId 二选一） |
| keywordId | string | 否 | 关键词 ID |
| stream | boolean | 否 | 是否使用 SSE 流式，默认 false |
| resumeFromPipelineId | string | 条件必填 | 从指定管道恢复（与 categoryId 二选一） |

**8 大 Agent 步骤：**
1. 采集 Agent (Collector) — 从平台采集文章
2. 选题 Agent (Topic Selector) — 分析并选择选题
3. 写作 Agent (Writer) — 生成文章正文
4. 打分 Agent (Scorer) — 评估文章质量
5. 去AI化 Agent (De-AI-ifier) — 降低 AI 痕迹
6. 审核Agent (Reviewer) — 内容审核
7. 配图 Agent (Illustrator) — 生成配图/封面
8. 发布 Agent (Publisher) — 发布到目标平台

**同步响应示例（stream=false）：**
```json
{
  "code": 0,
  "data": {
    "id": "pipeline-123",
    "status": "completed",
    "currentStep": "Publisher",
    "topic": "大模型闭源趋势分析",
    "content": "文章正文...",
    "score": 85,
    "coverPrompt": "封面图提示词..."
  }
}
```

**SSE 流式响应事件（stream=true）：**
```
event: pipeline_start
data: {"type":"pipeline_started","pipelineId":"pipeline-123","status":"running"}

event: step_start
data: {"type":"step_started","pipelineId":"pipeline-123","step":"Collector","stepIndex":0}

event: wiki_context
data: {"type":"wiki_context","pipelineId":"pipeline-123","pages":["topics/大模型闭源趋势.md"]}

event: step_complete
data: {"type":"step_completed","pipelineId":"pipeline-123","step":"Collector","stepIndex":0,"output":"采集了 20 篇文章"}

event: pipeline_complete
data: {"type":"pipeline_completed","pipelineId":"pipeline-123","status":"completed","output":"文章正文..."}
```

**错误响应：**
```json
{
  "code": 409,
  "msg": "该分类已有管道运行中"
}
```

---

### GET /api/pipeline
列出最近管道记录

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 否 | 按分类筛选 |
| limit | number | 否 | 返回数量，默认 20 |

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "pipeline-123",
      "categoryId": "cat-001",
      "status": "completed",
      "currentStepIndex": 7,
      "result": { "content": "..." },
      "createdAt": 1712500000000,
      "updatedAt": 1712500005000
    }
  ]
}
```

---

### GET /api/pipeline/[id]
查询管道执行状态

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 管道 ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "pipeline-123",
    "categoryId": "cat-001",
    "status": "running",
    "steps": ["Collector", "Topic Selector", "Writer", "Scorer", "De-AI-ifier", "Reviewer", "Illustrator", "Publisher"],
    "currentStepIndex": 2,
    "result": null,
    "error": null,
    "createdAt": 1712500000000,
    "updatedAt": 1712500003000
  }
}
```

**状态说明：**
- `pending` — 等待执行
- `running` — 执行中
- `completed` — 执行完成
- `failed` — 执行失败

---

## 报告生成

### POST /api/report/generate
生成选题分析报告

**请求体：**
```json
{
  "categoryId": "cat-001"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 是 | 分类 ID |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "report-123",
    "categoryId": "cat-001",
    "createdAt": "2026-04-08T14:30:00Z",
    "date": "4月8日 (今日)",
    "summary": "整体趋势研判...",
    "topics": [
      {
        "title": "选题标题",
        "why": "为什么这个选题值得写...",
        "boom": "爆款潜力分析...",
        "growth": "增长与变现策略..."
      }
    ]
  }
}
```

---

### GET /api/report/list
获取历史报告列表

**Query 参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 否 | 按分类筛选 |

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "report-123",
      "categoryId": "cat-001",
      "createdAt": "2026-04-08T14:30:00Z",
      "date": "4月8日 (今日)",
      "summary": "整体趋势研判...",
      "topics": [...]
    }
  ]
}
```

---

## API 配置管理

### GET /api/config
获取 API 配置列表

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "configs": [
      {
        "id": "config-001",
        "name": "OpenAI API",
        "apiUrl": "https://api.openai.com/v1",
        "modelName": "gpt-4",
        "isDefault": false,
        "createdAt": 1712500000000
      }
    ],
    "defaultConfig": {
      "id": "config-002",
      "name": "DeepSeek API",
      "apiUrl": "https://api.deepseek.com/v1",
      "modelName": "deepseek-chat",
      "isDefault": true
    }
  }
}
```

---

### POST /api/config
创建 API 配置

**请求体：**
```json
{
  "name": "OpenAI API",
  "apiUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxx",
  "modelName": "gpt-4",
  "isDefault": true
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 配置名称 |
| apiUrl | string | 是 | API URL |
| apiKey | string | 是 | API Key |
| modelName | string | 是 | 模型名称 |
| isDefault | boolean | 否 | 是否设为默认 |

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "id": "config-003",
    "name": "OpenAI API",
    "apiUrl": "https://api.openai.com/v1",
    "modelName": "gpt-4",
    "isDefault": true,
    "createdAt": 1712500000000
  }
}
```

---

### PUT /api/config/[id]
更新 API 配置

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 配置 ID |

**请求体：**
```json
{
  "name": "OpenAI API Updated",
  "apiUrl": "https://api.openai.com/v1",
  "apiKey": "sk-new-key",
  "modelName": "gpt-4-turbo",
  "isDefault": false
}
```

---

### DELETE /api/config/[id]
删除 API 配置

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 配置 ID |

**响应示例：**
```json
{
  "code": 0,
  "msg": "deleted"
}
```

---

## 数据分析

### GET /api/analytics/dashboard
获取数据分析仪表板聚合数据

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "totalArticles": 1234,
    "weeklyArticles": 56,
    "platformDistribution": [
      { "platform": "xhs", "count": 500 },
      { "platform": "wx", "count": 300 }
    ],
    "collectionTrend": [
      { "date": "2026-04-05", "count": 10 },
      { "date": "2026-04-06", "count": 15 }
    ],
    "generatedContentStats": {
      "total": 100,
      "draft": 20,
      "reviewed": 30,
      "published": 45,
      "archived": 5
    },
    "topKeywords": [
      { "id": "kw-001", "name": "AI", "articleCount": 200 }
    ]
  }
}
```

**字段说明：**
| 字段 | 类型 | 说明 |
|------|------|------|
| totalArticles | number | 文章总量 |
| weeklyArticles | number | 本周新增文章数 |
| platformDistribution | array | 各平台文章分布 |
| collectionTrend | array | 近7天采集趋势 |
| generatedContentStats | object | AI 产出统计 |
| topKeywords | array | 关键词热度 Top 10 |

---

### GET /api/analytics/pipeline-status
获取当前活跃管道状态

**响应示例：**
```json
{
  "code": 0,
  "data": {
    "hasActivePipeline": true,
    "pipeline": {
      "id": "pipeline-123",
      "categoryId": "cat-001",
      "status": "running",
      "currentStepIndex": 3,
      "steps": [
        {
          "step": "collection",
          "status": "completed",
          "startedAt": "2026-04-11T10:00:00Z",
          "completedAt": "2026-04-11T10:01:00Z",
          "duration": 60000
        }
      ],
      "createdAt": 1712826000000,
      "updatedAt": 1712826100000
    }
  }
}
```

---

### GET /api/analytics/agent-stats
获取 Agent 执行统计

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "key": "collection",
      "name": "采集",
      "triggered": 50,
      "success": 48,
      "failed": 2,
      "successRate": 96,
      "avgDuration": 12.5
    },
    {
      "key": "writing",
      "name": "写作",
      "triggered": 45,
      "success": 42,
      "failed": 3,
      "successRate": 93,
      "avgDuration": 28.3
    }
  ]
}
```

**字段说明：**
| 字段 | 类型 | 说明 |
|------|------|------|
| key | string | Agent 标识 |
| name | string | Agent 名称 |
| triggered | number | 触发次数 |
| success | number | 成功次数 |
| failed | number | 失败次数 |
| successRate | number | 成功率 (%) |
| avgDuration | number | 平均耗时 (秒) |

---

## 贴图生成与发布

### POST /api/sticker
发布贴图草稿到微信

**请求体：**
```json
{
  "title": "封面大标题",
  "slides": [
    { "heading": "副标题1", "content": "内容1" },
    { "heading": "副标题2", "content": "内容2" }
  ],
  "caption": "底部短文案",
  "imageUrls": ["https://example.com/image1.jpg"],
  "author": "作者名"
}
```

**字段说明：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 封面大标题 |
| slides | array | 是 | 贴图内容数组 |
| slides[].heading | string | 是 | 副标题 |
| slides[].content | string | 是 | 内容 |
| caption | string | 是 | 底部短文案 |
| imageUrls | string[] | 否 | 图片 URL 列表 |
| author | string | 否 | 作者名 |

**响应示例：**
```json
{
  "code": 0,
  "msg": "贴图草稿发布成功",
  "data": {
    "mediaId": "xxx",
    "url": "https://mp.weixin.qq.com/cgi-bin/fin?action=getfile&token=xxx"
  }
}
```

**错误码：**
| code | 说明 |
|------|------|
| 400 | 缺少必填参数或未配置微信 AppID/AppSecret |
| 500 | 发布失败 |

---

## Auto-wechat-writing 接口适配

### 概述

参考 [Auto-wechat-writing](https://github.com/lengyi2030/Auto-wechat-writing) 的接口设计，本项目进行了以下适配：

| Auto-wechat-writing | 本项目 | 说明 |
|---------------------|--------|------|
| POST /api/article | POST /api/content/generate | 流式生成正文，已扩展账号空间支持 |
| POST /api/titles | POST /api/content/titles | 生成多组标题+摘要 |
| POST /api/cover/prompts | POST /api/content/cover/prompts | 生成封面图 Prompt |
| POST /api/cover/generate | POST /api/content/cover | 调用图片生成 API |
| GET /api/cover/proxy | 无需实现 | 本项目使用 S3/本地存储 |

### 主要差异

1. **账号空间集成**：本项目在生成内容时，可指定 `personaId`、`styleId`、`knowledgeIds`，自动构建系统提示词
2. **模板变量替换**：支持在模板中使用 `{变量名}` 格式，AI 生成后自动替换
3. **统一响应格式**：使用 `code`、`msg`、`data` 统一响应格式

### 复用方案

```typescript
// content-generator.ts 中的流式处理逻辑可复用
import { createChatCompletionStream } from "@/lib/content-generator";

// AI 调用示例
const response = await createChatCompletionStream(
  { apiUrl, apiKey, modelName },
  [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  (chunk) => { /* 处理流式输出 */ }
);
```
