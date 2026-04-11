"use client";
import React, { useState } from "react";
import {
  CheckCircle,
  Circle,
  XCircle,
  Loader2,
  AlertTriangle,
  RotateCcw,
  X,
  BookOpen,
  MessageSquare,
  Image as ImageIcon,
  ZoomIn,
} from "lucide-react";

export interface PipelineStepInfo {
  step: string; // 'collect' | 'topic' | 'write' | 'score' | 'humanize' | 'review' | 'illustrate' | 'publish'
  status: "pending" | "running" | "completed" | "failed";
  score?: number;
  feedback?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface IllustrationData {
  coverUrl?: string;
  illustrations?: Array<{ url: string; caption?: string }>;
}

export interface PipelineProgressPanelProps {
  pipelineId: string;
  steps: PipelineStepInfo[];
  currentStepIndex: number;
  overallStatus: "idle" | "running" | "completed" | "failed" | "paused";
  error?: string;
  matchedPages?: string[];
  /** Human-in-the-loop: the topic proposed by AI (set when paused) */
  pausedTopic?: string;
  /** Human-in-the-loop: editable topic text */
  editedTopic?: string;
  /** Human-in-the-loop: loading state while approving */
  approvingTopic?: boolean;
  /** Human-in-the-loop: called when user confirms topic */
  onApproveTopic?: (topic: string) => void;
  /** Human-in-the-loop: called when user rejects/abandons pipeline */
  onRejectTopic?: () => void;
  /** Human-in-the-loop: called when user edits the topic text */
  onTopicChange?: (topic: string) => void;
  /** Illustration data to preview when pipeline completes */
  illustrations?: IllustrationData;
  onRetry?: () => void;
  onCancel?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  collect: "采集",
  topic: "选题",
  write: "写作",
  score: "评分",
  humanize: "去AI化",
  review: "审核",
  illustrate: "配图",
  publish: "发布",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "等待中",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  paused: "等待确认",
};

function formatDuration(start?: string, end?: string): string | null {
  if (!start) return null;
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.round((endTime - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function StepIcon({ status }: { status: PipelineStepInfo["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle size={18} className="text-green-500 shrink-0" />;
    case "running":
      return <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />;
    case "failed":
      return <XCircle size={18} className="text-red-500 shrink-0" />;
    default:
      return <Circle size={18} className="text-gray-400 shrink-0" />;
  }
}

export default function PipelineProgressPanel({
  pipelineId,
  steps,
  currentStepIndex,
  overallStatus,
  error,
  matchedPages,
  pausedTopic,
  editedTopic,
  approvingTopic,
  onApproveTopic,
  onRejectTopic,
  onTopicChange,
  illustrations,
  onRetry,
  onCancel,
}: PipelineProgressPanelProps) {
  const totalSteps = steps.length;
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPercent = totalSteps > 0 ? Math.round(((currentStepIndex + (overallStatus === "completed" ? 1 : 0)) / totalSteps) * 100) : 0;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header: pipeline ID, status, progress bar */}
      <div className="px-5 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Pipeline</h3>
            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-md font-mono">
              {pipelineId.slice(0, 8)}
            </span>
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              overallStatus === "running"
                ? "bg-blue-500/20 text-blue-400"
                : overallStatus === "completed"
                  ? "bg-green-500/20 text-green-400"
                  : overallStatus === "failed"
                    ? "bg-red-500/20 text-red-400"
                    : overallStatus === "paused"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-gray-600/30 text-gray-400"
            }`}
          >
            {STATUS_LABELS[overallStatus]}
          </span>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallStatus === "failed"
                  ? "bg-red-500"
                  : overallStatus === "completed"
                    ? "bg-green-500"
                    : overallStatus === "paused"
                      ? "bg-amber-500"
                      : "bg-blue-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums">
            {completedCount}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Step list: vertical timeline */}
      <div className="px-5 py-4 space-y-1">
        {steps.map((stepInfo, idx) => {
          const isLast = idx === steps.length - 1;
          const isActive = idx === currentStepIndex;
          const label = STEP_LABELS[stepInfo.step] || stepInfo.step;

          return (
            <div key={stepInfo.step} className="flex items-start gap-3">
              {/* Timeline column */}
              <div className="flex flex-col items-center w-[18px] shrink-0">
                <StepIcon status={stepInfo.status} />
                {!isLast && (
                  <div
                    className={`w-px flex-1 min-h-[20px] ${
                      stepInfo.status === "completed"
                        ? "bg-green-500/40"
                        : "bg-gray-700"
                    }`}
                  />
                )}
              </div>

              {/* Step content */}
              <div className={`pb-3 flex-1 min-w-0 ${!isLast ? "" : ""}`}>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      isActive
                        ? "text-white"
                        : stepInfo.status === "completed"
                          ? "text-gray-300"
                          : stepInfo.status === "failed"
                            ? "text-red-400"
                            : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>

                  {/* Running: show elapsed */}
                  {stepInfo.status === "running" && (
                    <span className="text-xs text-blue-400 tabular-nums">
                      {formatDuration(stepInfo.startedAt)}
                    </span>
                  )}

                  {/* Completed: show duration + score if present */}
                  {stepInfo.status === "completed" && (
                    <span className="text-xs text-gray-500 tabular-nums">
                      {formatDuration(stepInfo.startedAt, stepInfo.completedAt)}
                    </span>
                  )}
                </div>

                {/* Score badge */}
                {stepInfo.status === "completed" && stepInfo.score != null && (
                  <div className="mt-1">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        stepInfo.score >= 80
                          ? "bg-green-500/15 text-green-400"
                          : stepInfo.score >= 60
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      Score: {stepInfo.score}
                    </span>
                  </div>
                )}

                {/* Feedback */}
                {stepInfo.feedback && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{stepInfo.feedback}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Wiki matched pages */}
      {matchedPages && matchedPages.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-blue-400" />
            <span className="text-xs font-medium text-blue-400">
              Wiki 命中 {matchedPages.length} 页
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {matchedPages.map((page, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-blue-500/10 text-blue-300 text-xs rounded-full"
              >
                {page}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Auto-save indicator when pipeline completes */}
      {overallStatus === "completed" && (
        <div className="px-5 py-2.5 border-t border-gray-700 bg-green-500/5">
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <CheckCircle size={12} />
            已自动保存为草稿
          </p>
        </div>
      )}

      {/* Human-in-the-loop: Topic approval panel */}
      {overallStatus === "paused" && pausedTopic && (
        <div className="px-5 py-4 border-t border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={16} className="text-amber-400" />
            <span className="text-sm font-medium text-amber-300">AI 建议的选题</span>
          </div>
          <div className="bg-gray-800 rounded-lg px-3 py-2 mb-3">
            <p className="text-sm text-gray-200 leading-relaxed">{pausedTopic}</p>
          </div>
          <label className="text-xs text-amber-300/70 mb-1.5 block">修改选题（可选）</label>
          <textarea
            value={editedTopic ?? pausedTopic}
            onChange={(e) => onTopicChange?.(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-amber-400 resize-none mb-3"
            placeholder="在此修改选题..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => onApproveTopic?.(editedTopic ?? pausedTopic)}
              disabled={approvingTopic}
              className="flex-1 px-3 py-2 bg-amber-500 text-gray-900 text-sm font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {approvingTopic ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {approvingTopic ? "确认中..." : "确认继续"}
            </button>
            <button
              onClick={() => onRejectTopic?.()}
              disabled={approvingTopic}
              className="px-3 py-2 bg-gray-700 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <X size={14} /> 放弃
            </button>
          </div>
        </div>
      )}

      {/* Illustration preview when pipeline completes */}
      {overallStatus === "completed" && illustrations && (
        <div className="px-5 py-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon size={14} className="text-green-400" />
            <span className="text-xs font-medium text-green-400">配图预览</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {illustrations.coverUrl && (
              <div
                className="relative group cursor-pointer rounded-lg overflow-hidden border border-gray-600 hover:border-green-400 transition-colors"
                onClick={() => setLightboxUrl(illustrations.coverUrl!)}
              >
                <img
                  src={illustrations.coverUrl}
                  alt="封面图"
                  className="w-40 h-24 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn size={20} className="text-white" />
                </div>
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">封面</span>
              </div>
            )}
            {illustrations.illustrations?.map((img, i) => (
              <div
                key={i}
                className="relative group cursor-pointer rounded-lg overflow-hidden border border-gray-600 hover:border-green-400 transition-colors"
                onClick={() => setLightboxUrl(img.url)}
              >
                <img
                  src={img.url}
                  alt={img.caption || `插图 ${i + 1}`}
                  className="w-40 h-24 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn size={20} className="text-white" />
                </div>
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                  {img.caption || `插图 ${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 z-10"
            >
              <X size={16} />
            </button>
            <img
              src={lightboxUrl}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}

      {/* Error + action buttons */}
      {(error || onRetry || onCancel) && (
        <div className="px-5 py-3 border-t border-gray-700 bg-gray-800/50">
          {error && (
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            {onRetry && overallStatus === "failed" && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> 重试
              </button>
            )}
            {onCancel && (overallStatus === "running" || overallStatus === "paused") && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1.5"
              >
                <X size={12} /> 取消
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
