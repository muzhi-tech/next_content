# 环境配置需求清单

本文档列出内容监控与选题分析工具正常运行所需的所有环境配置项。

## 配置总览

| 配置项 | 存储位置 | 影响功能 | 必要性 |
|--------|----------|----------|--------|
| AI API（URL + Key + Model） | 数据库 `api_configs` 表 | 内容生成、标题生成、封面提示词、选题分析 | 必需 |
| XHS_API_KEY | 环境变量 `.env.local` | 小红书内容搜索与采集 | 使用小红书时必需 |
| WX_API_KEY | 环境变量 `.env.local` | 公众号文章搜索与采集 | 使用公众号时必需 |

---

## 1. AI API 配置

**存储位置**: 数据库 `api_configs` 表（通过「监控设置」页面管理）

**配置路径**: 打开应用 → 监控设置 → API 配置

**所需字段**:
- `apiUrl` — OpenAI 兼容接口地址（如 `https://api.openai.com/v1`）
- `apiKey` — API 密钥
- `modelName` — 模型名称（如 `gpt-4o-mini`）

**备选方案**: 也可通过环境变量设置默认值：
```
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
```

**影响的功能**:
- `POST /api/content/generate` — AI 文章生成
- `POST /api/content/write` — AI 写作
- `POST /api/content/titles` — AI 标题与摘要生成
- `POST /api/content/cover` — AI 封面提示词生成

**缺少时的错误提示**:
```json
{ "code": 400, "msg": "未配置 AI API。请在「监控设置」页面添加 API 配置（URL 和 Key），或设置环境变量 OPENAI_API_URL / OPENAI_API_KEY。" }
```

---

## 2. 小红书 API Key

**存储位置**: 环境变量

**配置方式**: 在项目根目录的 `.env.local` 文件中添加：
```
XHS_API_KEY=your_xhs_api_key
```

**影响的功能**:
- `POST /api/platforms/xhs` — 小红书搜索
- `POST /api/platforms/xhs-search` — 小红书搜索（别名路由）
- `POST /api/refresh` — 内容刷新（小红书部分）

**缺少时的错误提示**:
```json
{ "code": 400, "msg": "未配置小红书 API Key。请在项目根目录的 .env.local 文件中设置 XHS_API_KEY。" }
```

---

## 3. 公众号 API Key

**存储位置**: 环境变量

**配置方式**: 在项目根目录的 `.env.local` 文件中添加：
```
WX_API_KEY=your_wx_api_key
```

**影响的功能**:
- `POST /api/platforms/wx` — 公众号搜索
- `POST /api/platforms/wx-search` — 公众号搜索（别名路由）
- `GET /api/wx-articles` — 公众号文章列表
- `POST /api/refresh` — 内容刷新（公众号部分）

**缺少时的错误提示**:
```json
{ "code": 400, "msg": "未配置公众号 API Key。请在项目根目录的 .env.local 文件中设置 WX_API_KEY。" }
```

---

## 快速配置指南

### 首次使用

1. 复制 `.env.local.example` 为 `.env.local`（如没有 example 文件则直接创建）
2. 填写需要的 API Key
3. 启动应用后在「监控设置」页面配置 AI API
4. 访问 `/api/health` 检查配置状态

### 配置检查

通过健康检查接口确认当前配置状态：
```
GET /api/health
```

返回示例：
```json
{
  "code": 0,
  "data": {
    "db": "ok",
    "apiConfig": true,
    "hasCategories": true,
    "xhsKey": true,
    "wxKey": false
  }
}
```

- `apiConfig: true` 表示 AI API 已配置
- `xhsKey: true` 表示小红书 Key 已配置
- `wxKey: false` 表示公众号 Key 未配置

---

## 配置校验实现

所有配置校验逻辑集中在 `src/lib/config-check.ts`，提供三个校验函数：

- `requireAIConfig()` — 校验 AI API 配置
- `requireXhsKey()` — 校验小红书 API Key
- `requireWxKey()` — 校验公众号 API Key

各 API 路由在调用外部服务前会调用对应的校验函数，配置缺失时返回清晰的错误信息。
