import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, TrendingUp, Lightbulb, Loader2, FileText, Shield, AlertTriangle, CheckCircle, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";
import type { WikiLintIssue } from "@/lib/types";

interface ReportTopic {
  title: string;
  why: string;
  boom: string;
  growth: string;
}

interface Report {
  id: string;
  date: string;
  summary: string;
  topics: ReportTopic[];
}

interface WikiLintResult {
  totalPages: number;
  issues: WikiLintIssue[];
}

export default function ReportTab({ categoryId }: { categoryId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wiki lint state
  const [wikiLintResult, setWikiLintResult] = useState<WikiLintResult | null>(null);
  const [wikiLinting, setWikiLinting] = useState(false);
  const [wikiLintError, setWikiLintError] = useState<string | null>(null);
  const [showWikiLint, setShowWikiLint] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [lastLintTime, setLastLintTime] = useState<string>("");

  const handleWikiLint = async () => {
    setWikiLinting(true);
    setWikiLintError(null);
    setWikiLintResult(null);
    setShowWikiLint(true);
    try {
      const res = await fetch("/api/wiki/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setWikiLintResult(data.data || { totalPages: 0, issues: [] });
        setLastLintTime(new Date().toLocaleString());
      } else {
        setWikiLintError(data.msg || "Wiki 健康检查失败");
      }
    } catch (err) {
      console.error("Wiki lint failed:", err);
      setWikiLintError("检查请求失败");
    } finally {
      setWikiLinting(false);
    }
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/list?categoryId=${categoryId}`);
      const data = await res.json();
      if (data.code === 0 && Array.isArray(data.data)) {
        setReports(data.data);
        if (data.data.length > 0) {
          setActiveReport(data.data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const data = await res.json();
      if (data.code === 0 && data.data) {
        const newReport: Report = data.data;
        setReports((prev) => [newReport, ...prev]);
        setActiveReport(newReport);
      } else {
        setError(data.msg || "生成报告失败");
      }
    } catch (err) {
      console.error("Generate report error:", err);
      setError("生成报告失败，请检查 API 配置");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* 左侧：时间线与报告摘要 */}
      <div className="w-80 border-r border-gray-100 p-4 overflow-y-auto bg-gray-50/50 hide-scrollbar flex flex-col">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">近期报告</h3>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? "生成中..." : "生成报告"}
          </button>
        </div>

        {/* Wiki 健康检查 */}
        <div className="mx-2 mb-3">
          <button
            onClick={handleWikiLint}
            disabled={wikiLinting}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {wikiLinting ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            {wikiLinting ? "检查中..." : "Wiki 健康检查"}
          </button>
          {lastLintTime && (
            <p className="text-xs text-slate-400 mt-1 px-1">上次检查: {lastLintTime}</p>
          )}
          {showWikiLint && !wikiLinting && (
            <div className="mt-2">
              {wikiLintError && (
                <p className="text-xs text-red-600 p-2 bg-red-50 rounded-lg">{wikiLintError}</p>
              )}
              {wikiLintResult && wikiLintResult.issues.length === 0 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <CheckCircle size={14} className="text-green-600" />
                  <span className="text-xs text-green-700 font-medium">
                    Wiki 知识库健康 ✓ {wikiLintResult.totalPages} 个页面
                  </span>
                </div>
              )}
              {wikiLintResult && wikiLintResult.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                    <AlertTriangle size={14} className="text-orange-600" />
                    <span className="text-xs text-orange-700 font-medium">
                      发现 {wikiLintResult.issues.length} 个问题
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {["all", "critical", "high", "medium", "low"].map((sev) => {
                      const count = sev === "all"
                        ? wikiLintResult.issues.length
                        : wikiLintResult.issues.filter((i) => i.severity === sev).length;
                      if (sev !== "all" && count === 0) return null;
                      return (
                        <button
                          key={sev}
                          onClick={() => setSeverityFilter(sev)}
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            severityFilter === sev
                              ? sev === "critical" ? "bg-red-600 text-white"
                                : sev === "high" ? "bg-orange-600 text-white"
                                : sev === "medium" ? "bg-yellow-500 text-white"
                                : sev === "low" ? "bg-gray-500 text-white"
                                : "bg-slate-800 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {sev === "all" ? "全部" : sev} ({count})
                        </button>
                      );
                    })}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {wikiLintResult.issues
                      .filter((i) => severityFilter === "all" || i.severity === severityFilter)
                      .map((issue, idx) => (
                        <div key={idx} className="p-3 rounded-lg text-xs bg-slate-800 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                              issue.severity === "critical" ? "bg-red-500"
                                : issue.severity === "high" ? "bg-orange-500"
                                : issue.severity === "medium" ? "bg-yellow-500"
                                : "bg-gray-500"
                            }`} />
                            <span className="font-medium text-slate-200 font-mono">{issue.page}</span>
                          </div>
                          <div className="text-slate-400 mt-1 ml-5">{issue.message}</div>
                          <div className="text-slate-500 mt-0.5 ml-5">→ {issue.suggestion}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-2 mb-3">
            <ErrorState message={error} />
          </div>
        )}

        {/* 加载状态 */}
        {loading && <LoadingState message="加载报告中..." size={24} />}

        {/* 空状态 */}
        {!loading && reports.length === 0 && (
          <EmptyState
            icon={<BarChart3 size={36} />}
            title="暂无选题报告"
            description="点击上方按钮生成选题报告"
          />
        )}

        {/* 报告列表 */}
        {!loading && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveReport(r)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeReport?.id === r.id
                    ? "bg-white border-blue-200 ring-1 ring-blue-600 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-300"
                }`}
              >
                <div className="font-bold text-gray-900 text-sm mb-1.5">{r.date}</div>
                <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{r.summary}</div>
                {r.topics.length > 0 && (
                  <div className="mt-2 text-xs text-blue-600 font-medium">{r.topics.length} 个推荐选题</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 右侧：报告详情与选题拆解 */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {!activeReport ? (
            <EmptyState
              icon={<Sparkles size={48} />}
              title="选择或生成一份选题报告"
              description="AI 将分析当前分类下的文章趋势，生成选题建议"
            />
          ) : (
            <>
              {generating && !activeReport.summary && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
                  <div className="ml-4">
                    <p className="text-lg font-medium text-gray-700">AI 正在分析文章趋势...</p>
                    <p className="text-sm text-gray-500 mt-1">这可能需要几分钟时间</p>
                  </div>
                </div>
              )}

              {activeReport.summary && (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Sparkles size={24} /></div>
                    <h2 className="text-2xl font-bold text-gray-900">{activeReport.date} 选题洞察</h2>
                  </div>

                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl text-white mb-10 shadow-lg">
                    <h3 className="flex items-center gap-2 text-lg font-bold mb-2"><TrendingUp size={20} className="text-blue-400" /> AI 整体趋势研判</h3>
                    <p className="text-gray-300 leading-relaxed">{activeReport.summary}</p>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Lightbulb className="text-yellow-500" /> 推荐选题清单
                  </h3>

                  <div className="space-y-6">
                    {activeReport.topics.length === 0 ? (
                      <div className="text-gray-500 text-center py-10 bg-gray-50 rounded-xl border border-dashed">暂无高价值选题推荐</div>
                    ) : (
                      activeReport.topics.map((topic, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm hover:border-blue-300 transition-colors">
                          <h4 className="text-lg font-bold text-gray-900 mb-4">{topic.title}</h4>
                          <div className="space-y-4">
                            <div>
                              <span className="inline-block px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded mb-1">为什么做这个选题？</span>
                              <p className="text-sm text-gray-600">{topic.why}</p>
                            </div>
                            <div>
                              <span className="inline-block px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded mb-1">爆点在哪里？</span>
                              <p className="text-sm text-gray-600">{topic.boom}</p>
                            </div>
                            <div>
                              <span className="inline-block px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded mb-1">增长空间</span>
                              <p className="text-sm text-gray-600">{topic.growth}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
