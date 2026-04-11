# 第五轮迭代主链路验收清单

本文档定义内容监控系统 10 步主链路的验收标准，每步包含接口路径、请求参数示例、响应示例、失败场景及成功标志。

---

## 10 步主链路概览

1. 创建分类
2. 创建关键词
3. 采集文章
4. 查看文章列表
5. Wiki 提取
6. Wiki 索引
7. Wiki 检查
8. 生成报告
9. 生成正文
10. 生成标题封面

---

## 步骤 1：创建分类

### 接口
`POST /api/categories`

### 请求参数示例
```json
{
  "name": "AI大模型"
}
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "id": "cat-001",
    "name": "AI大模型",
    "createdAt": 1712500000000,
    "updatedAt": 1712500000000
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| name 为空 | 400 | 缺少必要参数 |
| 数据库写入失败 | 500 | 创建分类失败 |

### 成功标志
- 响应 code 为 0
- 返回的 id 非空
- 记录 categoryId 用于后续步骤

---

## 步骤 2：创建关键词

### 接口
`POST /api/keywords`

### 请求参数示例
```json
{
  "name": "GPT-4",
  "platforms": ["xhs", "wx"],
  "categoryId": "cat-001"
}
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "id": "key-001",
    "name": "GPT-4",
    "platforms": ["xhs", "wx"],
    "categoryId": "cat-001",
    "createdAt": 1712500000000,
    "updatedAt": 1712500000000
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| name/platforms/categoryId 缺失 | 400 | 缺少必要参数 |
| categoryId 不存在 | 400 | 分类不存在 |
| 数据库写入失败 | 500 | 创建关键词失败 |

### 成功标志
- 响应 code 为 0
- 返回的 id 非空
- 记录 keywordId 用于后续步骤

---

## 步骤 3：采集文章

### 接口
`POST /api/refresh`

### 请求参数示例
```json
{
  "keywordId": "key-001",
  "platforms": ["xhs", "wx"],
  "autoIngest": false
}
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "xhs": { "success": true, "count": 20 },
    "wx": { "success": true, "count": 15 }
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| keywordId/platforms 缺失 | 400 | 缺少必要参数 |
| keywordId 不存在 | 404 | 关键词不存在 |
| 第三方 API 失败 | 500 | 刷新失败（data 中平台 success 为 false） |

### 成功标志
- 响应 code 为 0
- 至少一个平台的 success 为 true
- count 总和大于 0

---

## 步骤 4：查看文章列表

### 接口
`GET /api/articles?categoryId=cat-001&page=1&pageSize=20`

### 请求参数示例
```
categoryId=cat-001
page=1
pageSize=20
```

### 成功响应示例
```json
{
  "code": 0,
  "data": [
    {
      "id": "art-001",
      "keywordId": "key-001",
      "keywordName": "GPT-4",
      "platform": "xhs",
      "title": "GPT-4 使用指南",
      "content": "正文内容...",
      "author": "作者名",
      "authorAvatar": "https://...",
      "url": "https://...",
      "likes": 100,
      "comments": 20,
      "publishedAt": 1712400000000,
      "collectedAt": 1712500000000
    }
  ],
  "total": 35
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| 参数错误 | 400 | 请求参数错误 |
| 数据库读取失败 | 500 | 获取文章列表失败 |

### 成功标志
- 响应 code 为 0
- data 为数组且长度大于 0
- total 大于 0
- 记录任意一个 articleId 用于下一步

---

## 步骤 5：Wiki 提取

### 接口
`POST /api/wiki/ingest`

### 请求参数示例
```json
{
  "articleId": "art-001",
  "categoryId": "cat-001"
}
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "updatedEntities": ["OpenAI", "GPT"],
    "updatedTopics": ["大模型闭源趋势"],
    "createdPages": ["topics/大模型闭源趋势.md"],
    "logEntry": "[2026-04-08 14:30] ingest | GPT-4 使用指南"
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| articleId/categoryId 缺失 | 400 | 缺少 articleId 或 categoryId |
| articleId 不存在 | 404 | 文章不存在 |
| 未配置 AI API | 400 | 未配置 AI API，请先在设置中添加 API 配置 |
| AI 调用失败 | 500 | Wiki 采集失败: [错误详情] |

### 成功标志
- 响应 code 为 0
- updatedEntities 或 updatedTopics 或 createdPages 至少一个非空

---

## 步骤 6：Wiki 索引

### 接口
`GET /api/wiki/index?categoryId=cat-001`

### 请求参数示例
```
categoryId=cat-001
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "entities": [
      {
        "type": "entity",
        "title": "OpenAI",
        "slug": "OpenAI",
        "summary": "大模型产业关键参与者",
        "updatedAt": "2026-04-08T14:30:00Z",
        "sourceCount": 6
      }
    ],
    "topics": [
      {
        "type": "topic",
        "title": "大模型闭源趋势",
        "slug": "大模型闭源趋势",
        "summary": "行业从开放扩散转向能力封装",
        "updatedAt": "2026-04-08T14:30:00Z",
        "sourceCount": 8
      }
    ]
  }
}
```

### 夾败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| categoryId 缺失 | 400 | categoryId required |
| Wiki 文件不存在 | 0 | data.entities 和 data.topics 为空数组 |
| 文件读取失败 | 500 | 读取 Wiki 索引失败 |

### 成功标志
- 响应 code 为 0
- entities 或 topics 至少一个非空

---

## 步骤 7：Wiki 检查

### 接口
`POST /api/wiki/lint`

### 请求参数示例
```json
{
  "categoryId": "cat-001"
}
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "issues": [
      {
        "severity": "high",
        "page": "topics/AI手机入口之争.md",
        "message": "缺少到 豆包 的交叉引用",
        "suggestion": "补充相关实体链接"
      }
    ]
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| categoryId 缺失 | 400 | categoryId required |
| 检查执行失败 | 500 | Wiki 健康检查失败 |

### 成功标志
- 响应 code 为 0
- 返回 issues 数组（可为空，表示无问题）

---

## 步骤 8：生成报告

### 接口
`POST /api/report/generate`

### 请求参数示例
```json
{
  "categoryId": "cat-001"
}
```

### 成功响应示例
```json
{
  "code": 0,
  "data": {
    "id": "report-123",
    "categoryId": "cat-001",
    "createdAt": "2026-04-08T14:30:00Z",
    "date": "4月8日 (今日)",
    "summary": "整体趋势研判：大模型行业正在从开放生态转向封闭生态...",
    "topics": [
      {
        "title": "大模型闭源趋势深度分析",
        "why": "为什么值得写：这是当前行业最核心的变局，影响所有从业者...",
        "boom": "爆款潜力：争议性强，观点鲜明，容易引发讨论...",
        "growth": "增长策略：结合行业预测，提供独家见解..."
      }
    ]
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| categoryId 缺失 | 400 | 缺少 categoryId |
| 分类下无文章 | 400 | 该分类下暂无文章，无法生成报告 |
| 未配置 AI API | 400 | 未配置 AI API，请先在设置中添加 API 配置 |
| AI 调用失败 | 500 | 报告生成失败: [错误详情] |

### 成功标志
- 响应 code 为 0
- summary 非空
- topics 数组非空
- 每个包含 why/boom/growth 三个字段

---

## 步骤 9：生成正文

### 接口
`POST /api/content/write` 或 `POST /api/content/generate`

### 请求参数示例
```json
{
  "topic": "大模型闭源趋势深度分析",
  "categoryId": "cat-001",
  "useWiki": true,
  "wikiMode": "full-context",
  "style": "tech",
  "length": "long"
}
```

### 成功响应示例（SSE 流式）
```
data: {"meta":{"matchedPages":["topics/大模型闭源趋势.md","entities/OpenAI.md"]}}

data: {"type":"content","content":"先说结论，大模型行业正在加速闭源。"}

data: {"type":"content","content":"这一趋势的核心驱动力是..."}

data: {"type":"done"}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| topic 缺失 | 400 | 缺少主题 |
| 未配置 AI API | 400 | 缺少 API 配置 |
| AI 调用失败 | 500（SSE 内部） | `data: {"error":"生成失败：..."}` |

### 成功标志
- 收到 `{"type":"done"}` 帧
- 中间有多条 `{"type":"content","content":"..."}` 帧
- 可选的 `{"meta":{"matchedPages":[...]}}` 帧

---

## 步骤 10：生成标题封面

### 接口
`POST /api/content/titles`（标题）+ `POST /api/content/cover/prompts`（封面提示词）

### 标题请求参数示例
```json
{
  "topic": "大模型闭源趋势深度分析",
  "count": 5
}
```

### 标题成功响应示例
```json
{
  "code": 0,
  "data": {
    "titles": [
      { "title": "大模型闭源：一场改变行业格局的静默革命", "summary": "深度解析 OpenAI、谷歌等巨头的策略转变" },
      { "title": "从开放到封闭：大模型行业正在经历什么？", "summary": "剖析闭源趋势背后的商业逻辑" }
    ]
  }
}
```

### 封面请求参数示例
```json
{
  "topic": "大模型闭源趋势深度分析",
  "style": "科技简约风"
}
```

### 封面成功响应示例
```json
{
  "code": 0,
  "data": {
    "prompt": "Futuristic AI server room, blue lighting, minimalist tech aesthetic, clean composition, professional photography, 8k",
    "negativePrompt": "text, watermark, logo, busy, blurry, low quality"
  }
}
```

### 失败场景及错误码
| 场景 | 错误码 | 错误消息 |
|------|--------|----------|
| topic 缺失 | 400 | 缺少必填字段: topic / 缺少主题 |
| 未配置 AI API | 400 | 缺少 API 配置 |
| AI 返回格式异常 | 500 | AI 返回格式异常，期望数组 |
| AI 调用失败 | 500 | 生成失败 |

### 成功标志
- **标题**：code 为 0，titles 数组非空，每个包含 title 和 summary
- **封面**：code 为 0，prompt 和 negativePrompt 非空

---

## 验收测试顺序建议

1. 按步骤顺序依次执行
2. 每步失败则停止，修复后继续
3. 建议使用自动化测试脚本执行
4. 保留每步的响应数据用于调试

---

## 快速验收 curl 命令

```bash
# 1. 创建分类
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"AI大模型"}' \
  | jq '.data.id' > /tmp/cat_id.txt

# 2. 创建关键词
CAT_ID=$(cat /tmp/cat_id.txt)
curl -X POST http://localhost:3000/api/keywords \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"GPT-4\",\"platforms\":[\"xhs\",\"wx\"],\"categoryId\":\"$CAT_ID\"}" \
  | jq '.data.id' > /tmp/key_id.txt

# 3. 采集文章
KEY_ID=$(cat /tmp/key_id.txt)
curl -X POST http://localhost:3000/api/refresh \
  -H "Content-Type: application/json" \
  -d "{\"keywordId\":\"$KEY_ID\",\"platforms\":[\"xhs\"]}"

# 4. 查看文章
curl "http://localhost:3000/api/articles?categoryId=$CAT_ID&page=1&pageSize=5" \
  | jq '.data[0].id' > /tmp/art_id.txt

# 5. Wiki 提取
ART_ID=$(cat /tmp/art_id.txt)
curl -X POST http://localhost:3000/api/wiki/ingest \
  -H "Content-Type: application/json" \
  -d "{\"articleId\":\"$ART_ID\",\"categoryId\":\"$CAT_ID\"}"

# 6. Wiki 索引
curl "http://localhost:3000/api/wiki/index?categoryId=$CAT_ID"

# 7. Wiki 检查
curl -X POST http://localhost:3000/api/wiki/lint \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$CAT_ID\"}"

# 8. 生成报告
curl -X POST http://localhost:3000/api/report/generate \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":\"$CAT_ID\"}"

# 9. 生成正文（需 SSE 客户端）
curl -N -X POST http://localhost:3000/api/content/write \
  -H "Content-Type: application/json" \
  -d "{\"topic\":\"大模型闭源趋势\",\"categoryId\":\"$CAT_ID\",\"useWiki\":true}"

# 10. 生成标题
curl -X POST http://localhost:3000/api/content/titles \
  -H "Content-Type: application/json" \
  -d "{\"topic\":\"大模型闭源趋势\"}"

# 10. 生成封面提示词
curl -X POST http://localhost:3000/api/content/cover/prompts \
  -H "Content-Type: application/json" \
  -d "{\"topic\":\"大模型闭源趋势\",\"style\":\"科技简约风\"}"
```
