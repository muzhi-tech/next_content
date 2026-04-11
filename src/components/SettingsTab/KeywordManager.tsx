"use client";
import React, { useState } from "react";
import { Plus, Trash2, RefreshCw, Loader2, Check, Tag } from "lucide-react";
import EmptyState from "../EmptyState";
import LoadingState from "../LoadingState";
import type { Keyword, Platform, CollectionLog } from "@/lib/types";
import { PLATFORMS } from "@/lib/types";

interface KeywordManagerProps {
  categoryId: string;
  keywords: Keyword[];
  loading: boolean;
  saving: boolean;
  autoIngestEnabled: boolean;
  ingestTopN: number;
  loadKeywords: () => void;
  loadCollectionLogs: () => void;
  onAddKeyword: (name: string, platforms: Platform[]) => void;
  onDeleteKeyword: (id: string) => void;
  onUpdatePlatforms: (id: string, platforms: Platform[]) => void;
  onRefresh: (id: string, platforms: Platform[]) => void;
}

export default function KeywordManager({
  categoryId,
  keywords,
  loading,
  saving,
  autoIngestEnabled,
  ingestTopN,
  loadKeywords,
  loadCollectionLogs,
  onAddKeyword,
  onDeleteKeyword,
  onUpdatePlatforms,
  onRefresh,
}: KeywordManagerProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["xhs", "wx"]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlatforms, setEditPlatforms] = useState<Platform[]>([]);
  const [refreshingKeywordId, setRefreshingKeywordId] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<{ keywordId: string; results: Record<string, { success: boolean; count?: number; error?: string }>; autoIngest: boolean } | null>(null);

  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleAdd = () => {
    if (!newKeyword.trim()) return;
    onAddKeyword(newKeyword.trim(), selectedPlatforms);
    setNewKeyword("");
  };

  const handleRefresh = async (id: string, platforms: Platform[]) => {
    if (!confirm(`确认刷新 ${platforms.join(", ")} 平台的数据？`)) return;

    setRefreshingKeywordId(id);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordId: id,
          platforms,
          autoIngest: autoIngestEnabled,
          ingestTopN,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setRefreshResult({ keywordId: id, results: data.data, autoIngest: autoIngestEnabled });
        loadCollectionLogs();
      } else {
        alert("刷新失败: " + data.msg);
      }
    } catch (err) {
      console.error("Failed to refresh:", err);
      alert("刷新失败");
    } finally {
      setRefreshingKeywordId(null);
    }
  };

  const handleUpdatePlatforms = async (id: string) => {
    await onUpdatePlatforms(id, editPlatforms);
    setEditingId(null);
  };

  const platformInfo = PLATFORMS.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { id: Platform; name: string; icon: string }>);

  return (
    <>
      {/* 添加关键词 */}
      <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-4">添加新关键词</h4>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="输入关键词，如：AI编程"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newKeyword.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            添加
          </button>
        </div>

        {/* 平台选择 */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 mr-2">选择监控平台：</span>
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedPlatforms.includes(p.id)
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200"
              }`}
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>
      </section>

      {/* 关键词列表 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-700">
            关键词列表 ({keywords.length})
          </h4>
          <button
            onClick={loadKeywords}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw size={14} /> 刷新
          </button>
        </div>

        {loading ? (
          <LoadingState message="加载关键词..." size={24} />
        ) : keywords.length === 0 ? (
          <EmptyState
            icon={<Tag size={36} />}
            title="暂无关键词"
            description="请在上方输入关键词开始监控"
          />
        ) : (
          <div className="space-y-3">
            {keywords.map((keyword) => (
              <div
                key={keyword.id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-bold text-gray-900">{keyword.name}</h5>
                      <span className="text-xs text-gray-400">
                        {new Date(keyword.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* 平台标签 */}
                    <div className="flex flex-wrap gap-2">
                      {keyword.platforms.map((pId) => {
                        const p = platformInfo[pId];
                        return p ? (
                          <span
                            key={pId}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {p.icon} {p.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 ml-4">
                    {editingId === keyword.id ? (
                      <>
                        <button
                          onClick={() => handleUpdatePlatforms(keyword.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="保存"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="取消"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(keyword.id);
                            setEditPlatforms(keyword.platforms);
                          }}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="编辑平台"
                        >
                          编辑平台
                        </button>
                        <button
                          onClick={() => handleRefresh(keyword.id, keyword.platforms)}
                          disabled={refreshingKeywordId === keyword.id}
                          className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-1 disabled:opacity-50"
                          title="刷新数据"
                        >
                          {refreshingKeywordId === keyword.id ? (
                            <><Loader2 size={14} className="animate-spin" /> 采集中...</>
                          ) : (
                            <><RefreshCw size={14} /> 刷新</>
                          )}
                        </button>
                        <button
                          onClick={() => onDeleteKeyword(keyword.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="删除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 编辑平台时的选择 */}
                {editingId === keyword.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (editPlatforms.includes(p.id)) {
                              setEditPlatforms(editPlatforms.filter((x) => x !== p.id));
                            } else {
                              setEditPlatforms([...editPlatforms, p.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            editPlatforms.includes(p.id)
                              ? "bg-blue-100 text-blue-700 border border-blue-300"
                              : "bg-gray-100 text-gray-600 border border-transparent"
                          }`}
                        >
                          {p.icon} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 刷新结果显示 */}
                {refreshResult && refreshResult.keywordId === keyword.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-green-600 font-medium">采集完成</span>
                      {Object.entries(refreshResult.results).map(([platform, info]: [string, { success: boolean; count?: number; error?: string }]) => (
                        <span
                          key={platform}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            info.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {platform}: {info.success ? `${info.count} 篇` : info.error}
                        </span>
                      ))}
                      {refreshResult.autoIngest && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                          Wiki Ingest 已触发 (Top {ingestTopN})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
