# 第七轮迭代技术设计

## 1. 技术方案总览

| 功能 | 优先级 | 技术方案 |
|------|--------|----------|
| 数据分析仪表板 | P0 | 纯 CSS/SVG 图表 + API 聚合统计 |
| Agent 状态监控 | P0 | Pipeline 状态轮询 + 实时展示 |

**新增依赖**：无（纯 CSS/SVG 实现，不引入图表库）

---

## 2. 数据库变更

### 2.1 新增表：无

本轮迭代不新增数据库表，均复用现有表：

- 数据分析：`articles`, `collection_logs`, `generated_contents`, `keywords`
- Agent 监控：`pipeline_runs`

### 2.2 索引（如需优化查询性能）

```sql
-- 采集趋势统计用（如尚不存在）
CREATE INDEX IF NOT EXISTS idx_articles_collectedAt ON articles(collectedAt);
```

---

## 3. API 设计

### 3.1 数据分析聚合 API

```typescript
// GET /api/analytics/dashboard

// Response
interface DashboardData {
  // 内容总量
  totalArticles: number;
  weeklyArticles: number;        // 本周新增（7天内）

  // 平台分布
  platformDistribution: {
    platform: string;
    count: number;
  }[];

  // 采集趋势（近7天，每天一条）
  collectionTrend: {
    date: string;         // YYYY-MM-DD
    count: number;
  }[];

  // AI 产出统计
  generatedContentStats: {
    total: number;
    byStatus: {
      status: string;
      count: number;
    }[];
  };

  // 关键词热度 Top 10
  topKeywords: {
    keywordId: string;
    keywordName: string;
    articleCount: number;
  }[];
}
```

**实现位置**：`src/app/api/analytics/dashboard/route.ts`

**查询逻辑**：

```sql
-- 平台分布
SELECT platform, COUNT(*) as count FROM articles GROUP BY platform;

-- 总量 + 本周新增
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN collectedAt > ? THEN 1 ELSE 0 END) as weekly
FROM articles;

-- 近7天采集趋势
SELECT date(startedAt/1000, 'unixepoch') as date, COUNT(*) as count
FROM collection_logs
WHERE startedAt > ? (7天前时间戳)
GROUP BY date
ORDER BY date;

-- 内容状态分布
SELECT status, COUNT(*) as count FROM generated_contents GROUP BY status;

-- 关键词热度 Top 10
SELECT k.id, k.name, COUNT(a.id) as articleCount
FROM keywords k
LEFT JOIN articles a ON a.keywordId = k.id
GROUP BY k.id
ORDER BY articleCount DESC
LIMIT 10;
```

---

### 3.2 Agent 状态 API

复用现有 `GET /api/pipeline` 和 `GET /api/pipeline/[id]` 接口。

新增一个**当前活跃管道**查询接口：

```typescript
// GET /api/analytics/pipeline-status

// Response
interface PipelineStatus {
  hasActivePipeline: boolean;
  pipeline?: {
    id: string;
    categoryId: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    currentStepIndex: number;
    steps: {
      step: string;          // 'collection' | 'topic' | 'writing' | 'score' | 'humanize' | 'review' | 'image' | 'publish'
      status: 'pending' | 'running' | 'completed' | 'failed';
      startedAt?: string;
      completedAt?: string;
      duration?: number;     // 毫秒
    }[];
    createdAt: string;
    updatedAt: string;
  };
}
```

**实现位置**：`src/app/api/analytics/pipeline-status/route.ts`

**查询逻辑**：
```sql
SELECT * FROM pipeline_runs
WHERE status = 'running'
ORDER BY createdAt DESC
LIMIT 1;
```

---

## 4. 前端变更

### 4.1 新建 AnalyticsTab 组件

```text
src/components/AnalyticsTab.tsx （新建）
```

**Tab 位置**：侧边栏导航，在「内容监控」之后

**page.tsx 更新**：增加「数据分析」导航项

---

### 4.2 AnalyticsTab 布局结构

```
┌──────────────────────────────────────────────────────────┐
│  数据分析                              [刷新]            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ 内容总量   │ │ 本周新增   │ │ AI 产出    │       │
│  │   1,234    │ │    +89     │ │    456     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  ┌────────────────────────┐ ┌────────────────────┐   │
│  │ 平台分布                │ │ 采集趋势（7天）    │   │
│  │  ████████░░ 小红书 65%  │ │      ___/\___      │   │
│  │  ████░░░░░░ 公众号 25% │ │   __/        \__   │   │
│  │  ██░░░░░░░░ 抖音  10%  │ │  /              \  │   │
│  └────────────────────────┘ └────────────────────┘   │
│                                                          │
│  ┌────────────────────────┐ ┌────────────────────┐   │
│  │ 内容状态分布            │ │ 关键词热度 Top 10   │   │
│  │  ██████████████ 草稿   │ │ 1. 人工智能  128  │   │
│  │  ██████░░░░░░░ 已审核  │ │ 2. AIGC        95  │   │
│  │  ████░░░░░░░░░ 已发布  │ │ 3. ChatGPT    87  │   │
│  └────────────────────────┘ │ ...              │   │
│                              └────────────────────┘   │
│                                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │ Agent 状态监控                                  │   │
│  │                                                │   │
│  │  [采集]→[选题]→[写作]→[打分]→[去AI]→[审核]→[配图]→[发布]  │
│  │    ✓      ✓      ●      ○      ○      ○      ○      ○   │
│  │  (已完成) (已完成) (进行中) (等待中)...               │   │
│  │                                                │   │
│  │  当前：写作 Agent 执行中，已运行 23 秒            │   │
│  └────────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────────┘
```

---

### 4.3 图表实现（纯 CSS/SVG）

#### 4.3.1 饼图 / 环形图（CSS conic-gradient）

```tsx
// 平台分布饼图
<div style={{
  width: 140,
  height: 140,
  borderRadius: '50%',
  background: `conic-gradient(
    #FF6B6B 0% 35%,
    #4ECDC4 35% 60%,
    #45B7D1 60% 100%
  )`,
  // 环形图：再加个内圆
  boxShadow: 'inset 0 0 0 40px white'
}} />
```

#### 4.3.2 折线图（SVG polyline）

```tsx
<svg viewBox="0 0 280 80" style={{ width: '100%', height: 80 }}>
  {/* Y 轴网格线 */}
  {[0, 25, 50, 75, 100].map(y => (
    <line key={y} x1="0" y1={y} x2="280" y2={y}
      stroke="#eee" strokeWidth="1" />
  ))}
  {/* 折线 */}
  <polyline
    points={points.map((p, i) =>
      `${(i / (points.length - 1)) * 280},${80 - (p.value / max) * 80}`
    ).join(' ')}
    fill="none"
    stroke="#4ECDC4"
    strokeWidth="2"
    strokeLinejoin="round"
  />
  {/* 数据点 */}
  {points.map((p, i) => (
    <circle
      key={i}
      cx={(i / (points.length - 1)) * 280}
      cy={80 - (p.value / max) * 80}
      r="3"
      fill="#4ECDC4"
    />
  ))}
</svg>
```

#### 4.3.3 水平条形图（CSS flexbox）

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
  {data.map((item, i) => (
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 80, fontSize: 12 }}>{item.name}</span>
      <div style={{
        flex: 1,
        height: 16,
        background: '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${(item.count / max) * 100}%`,
          height: '100%',
          background: '#4ECDC4',
          borderRadius: 4
        }} />
      </div>
      <span style={{ width: 40, fontSize: 12, textAlign: 'right' }}>{item.count}</span>
    </div>
  ))}
</div>
```

---

### 4.4 Agent 状态展示组件

#### 4.4.1 PipelineSteps 组件

```tsx
interface Step {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
}

const STEP_NAMES = ['采集', '选题', '写作', '打分', '去AI', '审核', '配图', '发布'];
const STEP_KEYS = ['collection', 'topic', 'writing', 'score', 'humanize', 'review', 'image', 'publish'];

const statusStyle = {
  pending: { bg: '#f0f0f0', color: '#999', icon: '○' },
  running: { bg: '#fff3cd', color: '#856404', icon: '●' },
  completed: { bg: '#d4edda', color: '#155724', icon: '✓' },
  failed: { bg: '#f8d7da', color: '#721c24', icon: '✗' },
};

function PipelineSteps({ steps }: { steps: Step[] }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {STEP_KEYS.map((key, i) => {
        const step = steps.find(s => s.step === key);
        const status = step?.status || 'pending';
        const s = statusStyle[status];
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              padding: '4px 8px',
              background: s.bg,
              color: s.color,
              borderRadius: 4,
              fontSize: 12
            }}>
              {STEP_NAMES[i]}
            </div>
            {i < STEP_KEYS.length - 1 && <span style={{ color: '#ccc' }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}
```

#### 4.4.2 轮询机制

```tsx
useEffect(() => {
  if (!hasActivePipeline) return;

  const interval = setInterval(async () => {
    const res = await fetch('/api/analytics/pipeline-status');
    const data = await res.json();
    setPipelineStatus(data.pipeline);

    // 管道完成时停止轮询
    if (data.pipeline?.status !== 'running') {
      clearInterval(interval);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [hasActivePipeline]);
```

---

## 5. 文件变更清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `src/app/api/analytics/dashboard/route.ts` | 数据分析聚合 API |
| `src/app/api/analytics/pipeline-status/route.ts` | 当前活跃管道状态 API |
| `src/components/AnalyticsTab.tsx` | 数据分析 + Agent 监控 Tab |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/app/page.tsx` | 增加「数据分析」导航项 |
| `src/lib/db.ts` | 如需要，增加 analytics 专用查询函数 |

---

## 6. 测试覆盖

| 测试对象 | 测试内容 |
|---------|---------|
| `analytics/dashboard/route.ts` | 聚合数据正确、空数据正确 |
| `analytics/pipeline-status/route.ts` | 无活跃管道返回正确、有活跃管道返回正确 |
| `AnalyticsTab.tsx` | 图表渲染正确、轮询逻辑正确 |

---

## 7. 风险与约束

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| 统计查询慢 | 页面加载超 1s | 加索引 + 简单缓存 |
| 管道表为空 | Agent 监控显示空状态 | 显示「当前无运行中的管道」 |

---

## 8. 推荐执行顺序

1. T7-01 实现 `GET /api/analytics/dashboard` API
2. T7-02 实现 `GET /api/analytics/pipeline-status` API
3. T7-03 新建 `AnalyticsTab.tsx` 组件
4. T7-04 实现图表 UI（饼图/折线图/条形图）
5. T7-05 实现 Agent 状态展示 + 轮询
6. T7-06 测试覆盖 + 回归验证

---

## 9. 一句话总结

**让数据可见、让 Agent 状态可感知。**
