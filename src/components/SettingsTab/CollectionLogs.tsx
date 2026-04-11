"use client";
import React from "react";
import { FileText, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import EmptyState from "../EmptyState";
import LoadingState from "../LoadingState";
import type { CollectionLog } from "@/lib/types";

interface CollectionLogsProps {
  collectionLogs: CollectionLog[];
  logsLoading: boolean;
  onRefresh: () => void;
}

export default function CollectionLogs({
  collectionLogs,
  logsLoading,
  onRefresh,
}: CollectionLogsProps) {
  return (
    <section className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <FileText size={16} className="text-blue-600" /> 采集日志
        </h4>
        <button
          onClick={onRefresh}
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
  );
}
