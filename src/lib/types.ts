// 关键词
export interface Keyword {
  id: string;
  name: string;
  platforms: Platform[];
  categoryId: string;
  createdAt: number;
  updatedAt: number;
}

// 文章
export interface Article {
  id: string;
  keywordId: string;
  keywordName: string;
  platform: Platform;
  title: string;
  content: string;
  author: string;
  authorAvatar?: string;
  url: string;
  coverImage?: string;
  likes: number;
  comments: number;
  shares?: number;
  collectedAt: number;
  publishedAt: number;
  isOriginal?: boolean;
  extra: Record<string, unknown>;
}

// 平台
export type Platform = "xhs" | "wx" | "dy" | "bilibili" | "weibo";

// 平台信息
export const PLATFORMS: { id: Platform; name: string; icon: string }[] = [
  { id: "xhs", name: "小红书", icon: "📕" },
  { id: "wx", name: "公众号", icon: "📰" },
  { id: "dy", name: "抖音", icon: "🎵" },
  { id: "bilibili", name: "B站", icon: "📺" },
  { id: "weibo", name: "微博", icon: "🌐" },
];

// API 配置
export type ApiConfigType = 'text' | 'image';

export interface ApiConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  type: ApiConfigType;
  isDefault: boolean;
  isDefaultImage: boolean;
  createdAt: number;
  updatedAt: number;
}

// 分类
export interface Category {
  id: string;
  name: string;           // 分类名称
  scheduleEnabled?: boolean; // 是否启用定时采集
  scheduleInterval?: string; // 采集间隔 (30m/1h/2h/6h/12h/24h)
  autoIngest?: boolean;      // 采集后自动 Ingest 到 Wiki
  ingestTopN?: number;       // Ingest Top N 数量
  createdAt: number;
  updatedAt: number;
}

// 数据库结构
export interface Database {
  keywords: Keyword[];
  articles: Article[];
  categories: Category[];
  personas: Persona[];
  styles: Style[];
  knowledgeBases: KnowledgeBase[];
  templates: WxTemplate[];
  apiConfigs: ApiConfig[];
  reports: Report[];
  pipelineRuns: PipelineRun[];
}

// ==================== 账号空间相关类型 ====================

/**
 * Persona（人设）
 * 定义 AI 创作时使用的人设角色
 */
export interface Persona {
  id: string;
  name: string;           // 人设名称
  description: string;      // 人设描述
  avatar?: string;        // 头像 URL
  systemPrompt: string;    // 系统提示词（AI 调用用）
  createdAt: number;
  updatedAt: number;
}

/**
 * Style（风格）
 * 定义 AI 创作时的写作风格
 */
export interface Style {
  id: string;
  name: string;           // 风格名称
  icon: string;           // 图标 emoji
  systemPrompt: string;   // 系统提示词
  createdAt: number;
  updatedAt: number;
}

/**
 * KnowledgeBase（知识库）
 * 存储 AI 创作时引用的知识内容
 */
export interface KnowledgeBase {
  id: string;
  name: string;           // 知识库名称
  description: string;    // 描述
  content: string;        // 知识内容
  createdAt: number;
  updatedAt: number;
}

/**
 * WxTemplate（公众号模板）
 * 公众号文章的标题和内容模板
 */
export interface WxTemplate {
  id: string;
  name: string;           // 模板名称
  titleTemplate: string;  // 标题模板（支持 {变量} 格式）
  contentTemplate: string; // 内容模板
  coverPromptTemplate?: string; // 封面提示词模板
  createdAt: number;
  updatedAt: number;
}

// 报告
export interface Report {
  id: string;
  categoryId: string;
  createdAt: string;
  summary: string;
  topics: Array<{ title: string; why: string; boom: string; growth: string }>;
}

// ==================== AI 创作相关类型 ====================

/**
 * AI 内容生成请求
 */
export interface AIGenerateRequest {
  topic: string;              // 主题/话题
  templateId?: string;        // 模板 ID
  personaId?: string;         // 人设 ID
  styleId?: string;           // 风格 ID
  knowledgeIds?: string[];     // 知识库 IDs
  titleTemplate?: string;      // 自定义标题模板
  coverPromptTemplate?: string; // 自定义封面提示词模板
}

/**
 * AI 内容生成响应
 */
export interface AIGenerateResponse {
  title: string;              // 生成的标题
  content: string;            // 生成的内容
  coverPrompt?: string;       // 封面提示词
}

/**
 * AI 标题生成请求
 */
export interface AITitlesRequest {
  topic: string;              // 主题/话题
  count?: number;             // 生成数量，默认 5
  personaId?: string;         // 人设 ID
  styleId?: string;           // 风格 ID
}

/**
 * AI 标题生成响应
 */
export interface AITitlesResponse {
  titles: {
    title: string;
    summary: string;
  }[];
}

/**
 * 封面提示词生成请求
 */
export interface AICoverPromptRequest {
  topic: string;              // 主题/话题
  content?: string;           // 文章内容（可选，用于提炼关键点）
  style?: string;             // 风格偏好
}

/**
 * 封面提示词生成响应
 */
export interface AICoverPromptResponse {
  prompt: string;             // 正面提示词
  negativePrompt: string;      // 负面提示词
}

// ==================== 管道持久化相关类型 ====================

export interface PipelineStepResult {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: string;
  output?: string;
  score?: number;
  feedback?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineRun {
  id: string;
  categoryId: string;
  type?: PipelineType;
  status: 'running' | 'completed' | 'failed' | 'paused';
  steps: PipelineStepResult[];
  currentStepIndex: number;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Wiki 引擎相关类型 ====================

export interface WikiPageMeta {
  type: 'entity' | 'topic';
  title: string;
  categoryId: string;
  aliases: string[];
  tags: string[];
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'archived';
  confidence: 'low' | 'medium' | 'high';
}

export interface WikiConflict {
  claim: string;
  oldView: string;
  newView: string;
  status: 'open' | 'resolved';
  sourceArticleIds: string[];
}

export interface WikiIndexItem {
  type: 'entity' | 'topic';
  title: string;
  slug: string;
  summary: string;
  updatedAt: string;
  sourceCount: number;
}

export interface WikiIngestInput {
  articleId: string;
  categoryId: string;
  title: string;
  content: string;
  url?: string;
  platform?: string;
  publishedAt?: string;
}

export interface WikiIngestResult {
  updatedEntities: string[];
  updatedTopics: string[];
  createdPages: string[];
  conflicts: WikiConflict[];
  logEntry: string;
}

export interface WikiLintIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  page: string;
  message: string;
  suggestion: string;
}

// ==================== 第六轮迭代：内容历史 + 采集日志 ====================

export type ContentStatus = 'draft' | 'reviewed' | 'published' | 'archived';
export type ContentSourceType = 'manual' | 'pipeline' | 'sticker-pipeline';

export interface GeneratedContent {
  id: string;
  categoryId?: string;
  topic: string;
  content: string;
  style?: string;
  personaId?: string;
  status: ContentStatus;
  wikiContext?: string;
  titles?: string;       // JSON: [{title, summary}]
  coverPrompt?: string;  // JSON: {prompt, negativePrompt}
  sourceType: ContentSourceType;
  createdAt: number;
  updatedAt: number;
}

export type CollectionLogStatus = 'success' | 'failed' | 'partial';

// ==================== AI 配置相关类型 ====================

/**
 * AI API 调用配置
 */
export interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface CollectionLog {
  id: string;
  categoryId?: string;
  keywordId?: string;
  keywordName?: string;
  platform: string;
  status: CollectionLogStatus;
  articleCount: number;
  errorMsg?: string;
  startedAt: number;
  completedAt?: number;
}

// ==================== 第九轮迭代：贴图（微信小绿书）流水线 ====================

/**
 * 贴图短文案结构（sticker-writer.ts 输出）
 */
export interface StickerSlide {
  heading: string;   // 副标题
  content: string;   // 一句话核心观点
}

export interface StickerContent {
  title: string;     // 封面大标题（极具吸引力）
  slides: StickerSlide[];  // 3-8 个分项
  caption: string;   // 底部配套短文案（含吐槽/钩子问题）
}

/**
 * 贴图内容数据库记录
 */
export interface StickerContentRecord {
  id: string;
  title: string;
  slides: StickerSlide[];  // JSON stored
  caption: string;
  status: 'draft' | 'published' | 'archived';
  wxMediaId?: string;
  wxUrl?: string;
  categoryId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 贴图发布请求
 */
export interface StickerPublishRequest {
  title: string;           // 封面大标题
  slides: StickerSlide[];  // 分项内容
  caption: string;         // 底部短文案
  imageUrls?: string[];    // 生成的图片 URL 列表（可选，前端渲染后上传）
  author?: string;          // 作者名称（可选）
}

/**
 * 贴图发布响应
 */
export interface StickerPublishResponse {
  success: boolean;
  mediaId?: string;        // 微信返回的 media_id
  url?: string;            // 草稿预览 URL
  error?: string;
}

/**
 * Pipeline 类型（支持长文和贴图两种模式）
 */
export type PipelineType = 'long-article' | 'sticker';

/**
 * 风格基因（从采集文章中提取的共性写作风格）
 */
export interface StyleProfile {
  guidelines: string;   // 写作风格指导原则
  samples: string;      // 风格样本
  constraints: string;  // 风格约束
}

// ==================== 数据分析相关类型 ====================

export interface PlatformDistribution {
  platform: string;
  count: number;
}

export interface CollectionTrend {
  date: string;
  count: number;
}

export interface ContentStatusCount {
  status: string;
  count: number;
}

export interface TopKeyword {
  keywordId: string;
  keywordName: string;
  articleCount: number;
}

export interface DashboardData {
  totalArticles: number;
  weeklyArticles: number;
  generatedContentTotal: number;
  platformDistribution: PlatformDistribution[];
  collectionTrend: CollectionTrend[];
  generatedContentStats: {
    total: number;
    byStatus: ContentStatusCount[];
  };
  topKeywords: TopKeyword[];
}

export interface AgentStat {
  key: string;
  name: string;
  triggered: number;
  success: number;
  failed: number;
  successRate: number;
  avgDuration: number;
}
