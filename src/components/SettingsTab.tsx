"use client";
import React, { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, Loader2, Check, Sparkles, Edit3, Save, Copy, Tag, Clock, FileText, AlertCircle } from "lucide-react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import type { Keyword, Platform, CollectionLog } from "@/lib/types";
import { PLATFORMS } from "@/lib/types";

// 风格列表（从 lib/styles 导入）
const STYLES: Array<{ id: string; name: string; description: string }> = [
  { id: "tech", name: "科技媒体评论", description: "犀利的科技媒体视角" },
  { id: "business", name: "商业财经", description: "专业的商业分析" },
  { id: "lifestyle", name: "生活美学", description: "温暖的生活方式" },
  { id: "news", name: "新闻资讯", description: "客观的热点报道" },
];

interface SettingsTabProps {
  categoryId: string;
}

export default function SettingsTab({ categoryId }: SettingsTabProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["xhs", "wx"]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlatforms, setEditPlatforms] = useState<Platform[]>([]);

  // 定时任务状态
  const [autoIngestEnabled, setAutoIngestEnabled] = useState(true);
  const [ingestTopN, setIngestTopN] = useState(5);
  const [lintRunning, setLintRunning] = useState(false);
  const [lastLintResult, setLastLintResult] = useState<{ issues: any[]; timestamp: string } | null>(null);

  // 内容生产状态
  const [contentTopic, setContentTopic] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string>("tech");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [showContentSection, setShowContentSection] = useState(false);

  // 调度配置状态
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("1h");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 刷新状态
  const [refreshingKeywordId, setRefreshingKeywordId] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] = useState<{ keywordId: string; results: any; autoIngest: boolean } | null>(null);

  // 采集日志状态
  const [collectionLogs, setCollectionLogs] = useState<CollectionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 加载关键词
  const loadKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/keywords?categoryId=${categoryId}`);
      const data = await res.json();
      if (data.code === 0) {
        setKeywords(data.data);
      }
    } catch (err) {
      console.error("Failed to load keywords:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeywords();
  }, [categoryId]);

  // 加载调度配置和采集日志
  useEffect(() => {
    const loadScheduleAndLogs = async () => {
      // 加载分类信息（含调度配置）
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (data.code === 0) {
          const cat = data.data.find((c: any) => c.id === categoryId);
          if (cat) {
            setScheduleEnabled(cat.scheduleEnabled || false);
            setScheduleInterval(cat.scheduleInterval || "1h");
            setAutoIngestEnabled(cat.autoIngest !== undefined ? cat.autoIngest : true);
            setIngestTopN(cat.ingestTopN || 5);
          }
        }
      } catch (err) {
        console.error("Failed to load schedule config:", err);
      }

      // 加载采集日志
      loadCollectionLogs();
    };
    loadScheduleAndLogs();
  }, [categoryId]);

  const loadCollectionLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/collection-logs?categoryId=${categoryId}&limit=20`);
      const data = await res.json();
      if (data.code === 0) {
        setCollectionLogs(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load collection logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleMsg(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          scheduleEnabled,
          scheduleInterval,
          autoIngest: autoIngestEnabled,
          ingestTopN,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setScheduleMsg({ type: "success", text: "调度配置已保存" });
      } else {
        setScheduleMsg({ type: "error", text: data.msg || "保存失败" });
      }
    } catch (err) {
      setScheduleMsg({ type: "error", text: "网络错误" });
    } finally {
      setSavingSchedule(false);
      setTimeout(() => setScheduleMsg(null), 3000);
    }
  };

  // 添加关键词
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyword.trim(),
          platforms: selectedPlatforms,
          categoryId,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setKeywords([...keywords, data.data]);
        setNewKeyword("");
      }
    } catch (err) {
      console.error("Failed to add keyword:", err);
    } finally {
      setSaving(false);
    }
  };

  // 删除关键词
  const handleDeleteKeyword = async (id: string) => {
    if (!confirm("确定要删除这个关键词吗？")) return;

    try {
      const res = await fetch(`/api/keywords/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.code === 0) {
        setKeywords(keywords.filter((k) => k.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete keyword:", err);
    }
  };

  // 更新关键词平台
  const handleUpdatePlatforms = async (id: string) => {
    try {
      const res = await fetch(`/api/keywords/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: editPlatforms }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setKeywords(keywords.map((k) => (k.id === id ? data.data : k)));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to update keyword:", err);
    }
  };

  // 刷新关键词数据
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
        // 刷新后重新加载采集日志
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

  // 切换平台选择
  const togglePlatform = (platform: Platform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  // 生成内容
  const handleGenerateContent = async () => {
    if (!contentTopic.trim()) {
      alert("请输入内容主题");
      return;
    }

    setGenerating(true);
    setGeneratedContent("");

    try {
      const style = STYLES.find((s) => s.id === selectedStyle);
      if (!style) {
        alert("请选择写作风格");
        return;
      }

      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: contentTopic,
          style: selectedStyle,
        }),
      });

      if (!response.ok) throw new Error("生成失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              // V2 格式: type === "content"
              if (parsed.type === "content" && parsed.content) {
                setGeneratedContent((prev) => prev + parsed.content);
              }
              // V1 兼容: 直接有 content 字段但没有 type
              else if (parsed.content && !parsed.type) {
                setGeneratedContent((prev) => prev + parsed.content);
              }
              // V2 完成信号
              if (parsed.type === "done") {
                break;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error) throw e;
            }
          }
        }
      }
    } catch (err) {
      console.error("Generation error:", err);
      alert("生成失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setGenerating(false);
    }
  };

  // 编辑内容
  const handleEditContent = () => {
    setEditedContent(generatedContent);
    setIsEditing(true);
  };

  // 保存编辑
  const handleSaveContent = () => {
    setGeneratedContent(editedContent);
    setIsEditing(false);
  };

  // 复制内容
  const handleCopyContent = async () => {
    const textToCopy = isEditing ? editedContent : generatedContent;
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const platformInfo = PLATFORMS.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { id: Platform; name: string; icon: string }>);

  return (
    <div className="max-w-4xl p-8 overflow-y-auto h-full">
      <h3 className="text-xl font-bold text-gray-900 mb-8">
        监控设置 · {categoryId}
      </h3>

      {/* 调度配置 */}
      <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-blue-600" /> 调度配置
        </h4>

        <div className="space-y-4">
          {/* 定时采集开关 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">定时采集</p>
              <p className="text-xs text-gray-500">按设定间隔自动执行关键词采集</p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">{scheduleEnabled ? "已启用" : "未启用"}</span>
            </label>
          </div>

          {/* 采集间隔 */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">采集间隔</p>
            <select
              value={scheduleInterval}
              onChange={(e) => setScheduleInterval(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="30m">30 分钟</option>
              <option value="1h">1 小时</option>
              <option value="2h">2 小时</option>
              <option value="6h">6 小时</option>
              <option value="12h">12 小时</option>
              <option value="24h">24 小时</option>
            </select>
          </div>

          {/* 采集后自动 Ingest */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">采集后自动 Ingest</p>
              <p className="text-xs text-gray-500">采集完成后自动将 Top N 文章摄入 Wiki 知识库</p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoIngestEnabled}
                onChange={(e) => setAutoIngestEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Top</span>
              <input
                type="number"
                min={1}
                max={20}
                value={ingestTopN}
                onChange={(e) => setIngestTopN(parseInt(e.target.value) || 5)}
                className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-center"
              />
            </label>
          </div>

          {/* 保存按钮 */}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingSchedule ? "保存中..." : "保存调度配置"}
            </button>
            {scheduleMsg && (
              <span className={`text-sm ${scheduleMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                {scheduleMsg.text}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 添加关键词 */}
      <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-4">添加新关键词</h4>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
            placeholder="输入关键词，如：AI编程"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAddKeyword}
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
                          onClick={() => handleDeleteKeyword(keyword.id)}
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
                      {Object.entries(refreshResult.results).map(([platform, info]: [string, any]) => (
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

      {/* 内容生产区块 */}
      <section className="mt-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-purple-700 flex items-center gap-2">
            <Sparkles size={16} /> AI 内容生产
          </h4>
          <button
            onClick={() => setShowContentSection(!showContentSection)}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            {showContentSection ? "收起" : "展开"}
          </button>
        </div>

        {showContentSection && (
          <div>
            {/* 主题输入和生成 */}
            <div className="mb-4">
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={contentTopic}
                  onChange={(e) => setContentTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateContent()}
                  placeholder="输入内容主题，如：2025年 AI 编程趋势分析"
                  className="flex-1 px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleGenerateContent}
                  disabled={generating || !contentTopic.trim()}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {generating ? "生成中..." : "生成"}
                </button>
              </div>

              {/* 风格选择下拉 */}
              <div className="mb-3">
                <label className="text-sm text-purple-700 mb-1 block">选择写作风格</label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name} - {style.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 生成的正文预览 */}
            {generatedContent && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-bold text-gray-900">生成的正文</h5>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <button
                        onClick={handleSaveContent}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Save size={14} /> 保存
                      </button>
                    ) : (
                      <button
                        onClick={handleEditContent}
                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Edit3 size={14} /> 编辑
                      </button>
                    )}
                    <button
                      onClick={handleCopyContent}
                      className="px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "已复制" : "复制"}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-48 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                  />
                ) : (
                  <div className="prose prose-purple max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm">
                      {generatedContent}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 定时任务 & Wiki 维护 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">定时任务 & Wiki 维护</h3>

        <div className="space-y-4">
          {/* Auto-ingest 配置 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">采集后自动 Ingest</p>
              <p className="text-xs text-gray-500">刷新采集后自动将 Top N 文章摄入 Wiki 知识库</p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoIngestEnabled}
                onChange={(e) => setAutoIngestEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Top</span>
              <input
                type="number"
                min={1}
                max={20}
                value={ingestTopN}
                onChange={(e) => setIngestTopN(parseInt(e.target.value) || 5)}
                className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-center"
              />
            </label>
          </div>

          {/* Wiki 健康检查 */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Wiki 健康检查</p>
                <p className="text-xs text-gray-500">检测孤立页面、重复主题、过时结论</p>
              </div>
              <button
                onClick={async () => {
                  setLintRunning(true);
                  try {
                    const res = await fetch('/api/wiki/lint', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ categoryId }),
                    });
                    const data = await res.json();
                    setLastLintResult({
                      issues: data.data?.issues || [],
                      timestamp: new Date().toLocaleTimeString(),
                    });
                  } catch (err) {
                    setLastLintResult({ issues: [], timestamp: '检查失败' });
                  } finally {
                    setLintRunning(false);
                  }
                }}
                disabled={lintRunning}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
              >
                {lintRunning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {lintRunning ? "检查中..." : "运行检查"}
              </button>
            </div>
            {lastLintResult && (
              <div className="bg-gray-50 rounded-lg p-3 mt-2">
                <p className="text-xs text-gray-500 mb-2">
                  最后检查: {lastLintResult.timestamp} | 发现 {lastLintResult.issues.length} 个问题
                </p>
                {lastLintResult.issues.length === 0 ? (
                  <p className="text-sm text-green-600">Wiki 健康状况良好</p>
                ) : (
                  <ul className="space-y-1">
                    {lastLintResult.issues.slice(0, 10).map((issue: any, i: number) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-white text-[10px] font-medium ${
                          issue.severity === 'critical' ? 'bg-red-500' :
                          issue.severity === 'high' ? 'bg-orange-500' :
                          issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-gray-700">{issue.page}: {issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 采集日志 */}
      <section className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" /> 采集日志
          </h4>
          <button
            onClick={loadCollectionLogs}
            disabled={logsLoading}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={14} className={logsLoading ? "animate-spin" : ""} /> 刷新
          </button>
        </div>

        {logsLoading && collectionLogs.length === 0 ? (
          <LoadingState message="加载日志..." size={20} />
        ) : collectionLogs.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} />}
            title="暂无采集日志"
            description="执行关键词刷新后，采集记录将显示在这里"
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {collectionLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {/* 状态标签 */}
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                    log.status === "success"
                      ? "bg-green-100 text-green-700"
                      : log.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {log.status === "success" ? "成功" : log.status === "failed" ? "失败" : "部分"}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">
                      {log.keywordName || "未知关键词"}
                    </span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                      {log.platform}
                    </span>
                    <span className="text-xs text-gray-400">
                      采集 {log.articleCount} 篇
                    </span>
                  </div>
                  {log.errorMsg && (
                    <div className="flex items-start gap-1 mt-1">
                      <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-red-500">{log.errorMsg}</span>
                    </div>
                  )}
                </div>

                <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                  {new Date(log.startedAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
