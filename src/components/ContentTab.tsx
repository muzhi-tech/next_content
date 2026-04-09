"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  Heart,
  MessageCircle,
  RefreshCw,
  Loader2,
  FileText,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Check,
  AlertTriangle,
} from "lucide-react";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";
import type { Article, Keyword, Platform } from "@/lib/types";
import { PLATFORMS } from "@/lib/types";

// 日期选择
const getDateOptions = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const yyyy = d.getFullYear();
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    dates.push({
      id: `date-${i}`,
      label: i === 0 ? "今天" : `${month}月${day}日`,
      value: i,
      dateStr: `${yyyy}-${mm}-${dd}`,
    });
  }
  return dates;
};

const dateOptions = getDateOptions();
const platformMap = PLATFORMS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, { id: Platform; name: string; icon: string }>);

export default function ContentTab({ categoryId }: { categoryId: string }) {
  const [activeDate, setActiveDate] = useState(dateOptions[0].id);
  const [activePlatform, setActivePlatform] = useState<string>("全部");
  const [articles, setArticles] = useState<Article[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showKeywordDropdown, setShowKeywordDropdown] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [selectedRefreshPlatform, setSelectedRefreshPlatform] = useState<string | null>(null);
  const [ingestResults, setIngestResults] = useState<Record<string, {
    status: 'idle' | 'submitting' | 'success' | 'error';
    updatedEntities?: string[];
    updatedTopics?: string[];
    createdPages?: string[];
    conflictCount?: number;
    message?: string;
  }>>({});
  const [expandedIngest, setExpandedIngest] = useState<string | null>(null);

  // 加载关键词
  const loadKeywords = useCallback(async () => {
    try {
      const res = await fetch(`/api/keywords?categoryId=${categoryId}`);
      const data = await res.json();
      if (data.code === 0) {
        setKeywords(data.data);
      }
    } catch (err) {
      console.error("Failed to load keywords:", err);
    }
  }, [categoryId]);

  // 加载文章
  const loadArticles = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        categoryId,
        page: pageNum.toString(),
        pageSize: "20",
      });

      if (activePlatform !== "全部") {
        params.set("platform", activePlatform);
      }

      if (selectedKeyword) {
        params.set("keywordId", selectedKeyword);
      }

      // Pass date filter
      const activeDateOption = dateOptions.find((d) => d.id === activeDate);
      if (activeDateOption) {
        params.set("date", activeDateOption.dateStr);
      }

      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json();

      if (data.code === 0) {
        setArticles(data.data);
        setTotal(data.total);
        setPage(data.page);
      } else {
        setError(data.msg || "获取文章失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取文章失败");
    } finally {
      setLoading(false);
    }
  }, [activePlatform, categoryId, selectedKeyword, activeDate]);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  useEffect(() => {
    loadArticles(1);
  }, [loadArticles]);

  // 快速刷新
  const handleQuickRefresh = async () => {
    if (!selectedKeyword || !selectedRefreshPlatform) {
      alert("请先选择要刷新的关键词和平台");
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordId: selectedKeyword,
          platforms: [selectedRefreshPlatform],
        }),
      });
      const data = await res.json();

      if (data.code === 0) {
        const result = data.data[selectedRefreshPlatform];
        if (result?.success) {
          alert(`刷新成功！新增 ${result.count} 篇文章`);
          loadArticles(1);
        } else {
          alert(`刷新失败: ${result?.error || "未知错误"}`);
        }
      } else {
        alert("刷新失败: " + data.msg);
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      alert("刷新失败");
    } finally {
      setRefreshing(false);
    }
  };

  // 处理文章点击
  const handleArticleClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // 提取到 Wiki
  const handleIngestToWiki = async (articleId: string) => {
    setIngestResults((prev) => ({ ...prev, [articleId]: { status: 'submitting' } }));
    try {
      const res = await fetch("/api/wiki/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, categoryId }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setIngestResults((prev) => ({
          ...prev,
          [articleId]: {
            status: 'success',
            updatedEntities: data.data?.updatedEntities || [],
            updatedTopics: data.data?.updatedTopics || [],
            createdPages: data.data?.createdPages || [],
            conflictCount: data.data?.conflicts?.length || 0,
          },
        }));
      } else {
        setIngestResults((prev) => ({ ...prev, [articleId]: { status: 'error' } }));
        alert("提取失败：" + (data.msg || "未知错误"));
      }
    } catch (err) {
      console.error("Ingest to wiki failed:", err);
      setIngestResults((prev) => ({ ...prev, [articleId]: { status: 'error' } }));
      alert("提取失败");
    }
  };

  // 平台筛选变化时重新加载
  const handlePlatformChange = (platform: string) => {
    setActivePlatform(platform);
    setPage(1);
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto">
      {/* 快速刷新区域 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 mb-6 border border-blue-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-blue-800 flex items-center gap-2">
            <RefreshCw size={16} /> 快速刷新
          </span>

          {/* 关键词选择 */}
          <div className="relative">
            <button
              onClick={() => setShowKeywordDropdown(!showKeywordDropdown)}
              className="px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-50"
            >
              {selectedKeyword
                ? keywords.find((k) => k.id === selectedKeyword)?.name || "选择关键词"
                : "选择关键词"}
              <ChevronDown size={14} />
            </button>
            {showKeywordDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[160px]">
                {keywords.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500">暂无关键词</div>
                ) : (
                  keywords.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => {
                        setSelectedKeyword(k.id);
                        setShowKeywordDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                    >
                      {k.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 平台选择 */}
          <div className="relative">
            <button
              onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
              className="px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm flex items-center gap-2 hover:bg-blue-50"
            >
              {selectedRefreshPlatform
                ? platformMap[selectedRefreshPlatform]?.icon +
                  " " +
                  platformMap[selectedRefreshPlatform]?.name
                : "选择平台"}
              <ChevronDown size={14} />
            </button>
            {showPlatformDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[140px]">
                {keywords
                  .find((k) => k.id === selectedKeyword)
                  ?.platforms.map((pId) => {
                    const p = platformMap[pId];
                    return p ? (
                      <button
                        key={pId}
                        onClick={() => {
                          setSelectedRefreshPlatform(pId);
                          setShowPlatformDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
                      >
                        {p.icon} {p.name}
                      </button>
                    ) : null;
                  })}
              </div>
            )}
          </div>

          <button
            onClick={handleQuickRefresh}
            disabled={refreshing || !selectedKeyword || !selectedRefreshPlatform}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {refreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {/* 日期选择 */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">
          时间线浏览 · 共 {total} 篇
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
          {dateOptions.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDate(d.id)}
              className={`flex-shrink-0 min-w-[100px] p-3 rounded-xl border transition-all text-left ${
                activeDate === d.id
                  ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="text-sm font-bold text-gray-900">{d.label}</div>
              <div className="text-xs text-gray-500 mt-1">
                {d.value === 0 ? "实时" : `${d.value}天前`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 平台筛选 */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => handlePlatformChange("全部")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activePlatform === "全部"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          全部
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePlatformChange(p.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activePlatform === p.id
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      {/* 加载状态 */}
      {loading && <LoadingState message="加载文章中..." />}

      {/* 错误状态 */}
      {error && !loading && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={() => loadArticles(1)} />
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && articles.length === 0 && (
        <EmptyState
          icon={<FileText size={48} />}
          title="暂无采集内容"
          description="请先在设置页添加关键词并触发采集"
          actionLabel="去设置"
          onAction={() => {
            const event = new CustomEvent("switchTab", { detail: "settings" });
            window.dispatchEvent(event);
          }}
        />
      )}

      {/* 文章列表 */}
      {!loading && articles.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {articles.map((article) => {
              const platform = platformMap[article.platform];
              return (
                <div
                  key={article.id}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleArticleClick(article.url)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {article.authorAvatar && (
                        <img
                          src={article.authorAvatar}
                          alt={article.author}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f3f4f6' width='100' height='100'/></svg>";
                          }}
                        />
                      )}
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md flex items-center gap-1">
                        {platform?.icon} {platform?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {ingestResults[article.id]?.status === 'success' ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium px-2 py-1 bg-green-50 rounded-md">
                          <Check size={14} /> 已提取
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIngestToWiki(article.id);
                          }}
                          disabled={ingestResults[article.id]?.status === 'submitting'}
                          className="text-gray-400 hover:text-purple-600 disabled:opacity-50 flex items-center gap-1 text-xs px-2 py-1 hover:bg-purple-50 rounded-md transition-colors"
                          title="提取到 Wiki"
                        >
                          {ingestResults[article.id]?.status === 'submitting' ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <BookOpen size={14} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArticleClick(article.url);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-gray-900 mb-2 line-clamp-2">
                    {article.title}
                  </h4>
                  <p className="text-sm text-gray-500 mb-2">@{article.author}</p>
                  {article.content && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                      {article.content}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Heart size={14} className="text-red-500" /> {article.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={14} /> {article.comments}
                      </span>
                    </div>
                    <span className="text-gray-400">
                      {new Date(article.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {article.isOriginal && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded">
                      原创
                    </span>
                  )}

                  {ingestResults[article.id]?.status === 'success' && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedIngest(expandedIngest === article.id ? null : article.id);
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        {expandedIngest === article.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <Check size={12} />
                        提取完成 新增 {ingestResults[article.id]?.updatedEntities?.length || 0} 个实体, {ingestResults[article.id]?.updatedTopics?.length || 0} 个主题
                        {(ingestResults[article.id]?.conflictCount ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-orange-600 ml-2">
                            <AlertTriangle size={12} />
                            发现 {ingestResults[article.id]?.conflictCount} 个观点冲突
                          </span>
                        )}
                      </button>
                      {expandedIngest === article.id && (
                        <div className="mt-2 space-y-2 bg-slate-800 rounded-lg p-3">
                          {ingestResults[article.id]?.updatedEntities && ingestResults[article.id]!.updatedEntities!.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-slate-400">实体:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ingestResults[article.id]?.updatedEntities?.map((e, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded">{e}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {ingestResults[article.id]?.updatedTopics && ingestResults[article.id]!.updatedTopics!.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-slate-400">主题:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ingestResults[article.id]?.updatedTopics?.map((t, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {ingestResults[article.id]?.createdPages && ingestResults[article.id]!.createdPages!.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-slate-400">新建页面:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ingestResults[article.id]?.createdPages?.map((pg, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">{pg}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          {total > 20 && (
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => loadArticles(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="px-4 py-2 text-gray-600">
                第 {page} / {Math.ceil(total / 20)} 页
              </span>
              <button
                onClick={() => loadArticles(page + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
