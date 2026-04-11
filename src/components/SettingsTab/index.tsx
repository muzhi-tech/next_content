"use client";
import React, { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { Keyword, Platform, CollectionLog } from "@/lib/types";
import ScheduleConfig from "./ScheduleConfig";
import KeywordManager from "./KeywordManager";
import ContentGeneratorSection from "./ContentGeneratorSection";
import CollectionLogs from "./CollectionLogs";

interface SettingsTabProps {
  categoryId: string;
}

export default function SettingsTab({ categoryId }: SettingsTabProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 定时任务状态
  const [autoIngestEnabled, setAutoIngestEnabled] = useState(true);
  const [ingestTopN, setIngestTopN] = useState(5);
  const [lintRunning, setLintRunning] = useState(false);
  const [lastLintResult, setLastLintResult] = useState<{ issues: unknown[]; timestamp: string } | null>(null);

  // 调度配置状态
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("1h");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (data.code === 0) {
          const cat = (data.data as { id: string; scheduleEnabled?: boolean; scheduleInterval?: string; autoIngest?: boolean; ingestTopN?: number }[]).find((c) => c.id === categoryId);
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
    } catch {
      setScheduleMsg({ type: "error", text: "网络错误" });
    } finally {
      setSavingSchedule(false);
      setTimeout(() => setScheduleMsg(null), 3000);
    }
  };

  // 添加关键词
  const handleAddKeyword = async (name: string, platforms: Platform[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          platforms,
          categoryId,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setKeywords([...keywords, data.data]);
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
  const handleUpdatePlatforms = async (id: string, platforms: Platform[]) => {
    try {
      const res = await fetch(`/api/keywords/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setKeywords(keywords.map((k) => (k.id === id ? data.data : k)));
      }
    } catch (err) {
      console.error("Failed to update keyword:", err);
    }
  };

  // 刷新关键词数据（由 KeywordManager 内部处理）
  const handleRefresh = async (_id: string, _platforms: Platform[]) => {
    // KeywordManager 内部自行处理刷新逻辑
  };

  return (
    <div className="max-w-4xl p-8 overflow-y-auto h-full">
      <h3 className="text-xl font-bold text-gray-900 mb-8">
        监控设置 · {categoryId}
      </h3>

      {/* 调度配置 */}
      <ScheduleConfig
        scheduleEnabled={scheduleEnabled}
        scheduleInterval={scheduleInterval}
        autoIngestEnabled={autoIngestEnabled}
        ingestTopN={ingestTopN}
        savingSchedule={savingSchedule}
        scheduleMsg={scheduleMsg}
        setScheduleEnabled={setScheduleEnabled}
        setScheduleInterval={setScheduleInterval}
        setAutoIngestEnabled={setAutoIngestEnabled}
        setIngestTopN={setIngestTopN}
        onSave={handleSaveSchedule}
      />

      {/* 关键词管理 */}
      <KeywordManager
        categoryId={categoryId}
        keywords={keywords}
        loading={loading}
        saving={saving}
        autoIngestEnabled={autoIngestEnabled}
        ingestTopN={ingestTopN}
        loadKeywords={loadKeywords}
        loadCollectionLogs={loadCollectionLogs}
        onAddKeyword={handleAddKeyword}
        onDeleteKeyword={handleDeleteKeyword}
        onUpdatePlatforms={handleUpdatePlatforms}
        onRefresh={handleRefresh}
      />

      {/* AI 内容生产 */}
      <ContentGeneratorSection />

      {/* 定时任务 & Wiki 维护 */}
      <section className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
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
                  } catch {
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
                    {(lastLintResult.issues as Array<{ severity: string; page: string; message: string }>).slice(0, 10).map((issue, i) => (
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
      <CollectionLogs
        collectionLogs={collectionLogs}
        logsLoading={logsLoading}
        onRefresh={loadCollectionLogs}
      />
    </div>
  );
}
