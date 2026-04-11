/**
 * 数据库操作层 — 统一入口
 *
 * 重新导出所有子模块的函数，保持与原始 db.ts 完全一致的导出签名。
 */

export { _testResetDB } from "./shared";
export {
  getKeywords, getKeyword, createKeyword, updateKeyword, deleteKeyword,
} from "./keywords";
export {
  getArticles, saveArticle, saveArticles, deleteArticlesByKeyword,
} from "./articles";
export {
  getApiConfigs, getDefaultApiConfig, createApiConfig, updateApiConfig, deleteApiConfig,
} from "./configs";
export {
  getPersonas, getPersona, createPersona, updatePersona, deletePersona,
  getStyles, getStyle, createStyle, updateStyle, deleteStyle,
  getKnowledgeBases, getKnowledgeBase, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase,
  getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  buildAIContext,
} from "./account-space";
export {
  getCategories, createCategory, deleteCategory,
  updateCategorySchedule, getScheduledCategories,
} from "./categories";
export {
  getReports, addReport, getReportById,
} from "./reports";
export {
  getPipelineRun, createPipelineRun, updatePipelineStep, updatePipelineStatus,
  updatePipelineRun, listPipelineRuns, deleteOldPipelineRuns,
} from "./pipeline";
export {
  getGeneratedContents, getGeneratedContent, createGeneratedContent,
  updateGeneratedContent, deleteGeneratedContent,
} from "./content";
export {
  getCollectionLogs, createCollectionLog,
  getDashboardArticleStats, getPlatformDistribution, getCollectionTrend,
  getGeneratedContentStats, getTopKeywords, getActivePipelineRun,
} from "./analytics";
