/**
 * 数据库操作层 — 向后兼容入口
 *
 * 所有函数签名保持不变，实际实现已拆分到 src/lib/db/ 目录。
 */

export {
  _testResetDB,
  getKeywords, getKeyword, createKeyword, updateKeyword, deleteKeyword,
  getArticles, saveArticle, saveArticles, deleteArticlesByKeyword,
  getApiConfigs, getDefaultApiConfig, createApiConfig, updateApiConfig, deleteApiConfig,
  getPersonas, getPersona, createPersona, updatePersona, deletePersona,
  getStyles, getStyle, createStyle, updateStyle, deleteStyle,
  getKnowledgeBases, getKnowledgeBase, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase,
  getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  buildAIContext,
  getCategories, createCategory, deleteCategory,
  updateCategorySchedule, getScheduledCategories,
  getReports, addReport, getReportById,
  getPipelineRun, createPipelineRun, updatePipelineStep, updatePipelineStatus,
  updatePipelineRun, listPipelineRuns, deleteOldPipelineRuns,
  getGeneratedContents, getGeneratedContent, createGeneratedContent,
  updateGeneratedContent, deleteGeneratedContent,
  getStickerContents, getStickerContent, createStickerContent,
  updateStickerContent, deleteStickerContent,
  getCollectionLogs, createCollectionLog,
  getDashboardArticleStats, getPlatformDistribution, getCollectionTrend,
  getGeneratedContentStats, getTopKeywords, getActivePipelineRun,
} from "./db/index";
