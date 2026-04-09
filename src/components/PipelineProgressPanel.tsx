"use client";
import React from "react";
import {
  CheckCircle,
  Circle,
  XCircle,
  Loader2,
  AlertTriangle,
  RotateCcw,
  X,
  BookOpen,
} from "lucide-react";

export interface PipelineStepInfo {
  step: string; // 'collect' | 'topic' | 'write' | 'score' | 'humanize' | 'review' | 'illustrate' | 'publish'
  status: "pending" | "running" | "completed" | "failed";
  score?: number;
  feedback?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineProgressPanelProps {
  pipelineId: string;
  steps: PipelineStepInfo[];
  currentStepIndex: number;
  overallStatus: "idle" | "running" | "completed" | "failed";
  error?: string;
  matchedPages?: string[];
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
  onRetry,
  onCancel,
}: PipelineProgressPanelProps) {
  const totalSteps = steps.length;
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPercent = totalSteps > 0 ? Math.round(((currentStepIndex + (overallStatus === "completed" ? 1 : 0)) / totalSteps) * 100) : 0;

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
            {onCancel && overallStatus === "running" && (
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
