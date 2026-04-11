"use client";
import React from "react";
import { Loader2, Sparkles, BarChart3 } from "lucide-react";
import type { PipelineRun, AgentStat } from "@/lib/types";

// ==================== 常量 ====================

const STEP_NAMES = ["采集", "选题", "写作", "打分", "去AI", "审核", "配图", "发布"];
const STEP_KEYS = ["collection", "topic", "writing", "score", "humanize", "review", "image", "publish"];

// ==================== 管道步骤组件 ====================

interface PipelineStepsProps {
  steps: PipelineRun["steps"];
  currentStepIndex: number;
  isRunning: boolean;
}

function PipelineSteps({ steps, currentStepIndex, isRunning }: PipelineStepsProps) {
  const getStepStatus = (key: string, index: number) => {
    const step = steps.find((s) => s.step === key);
    if (step) return step.status;
    if (isRunning && index === currentStepIndex) return "running";
    if (index < currentStepIndex) return "completed";
    return "pending";
  };

  const statusStyle = {
    pending: { bg: "#F3F4F6", color: "#9CA3AF", border: "#E5E7EB" },
    running: { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
    completed: { bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
    failed: { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEP_KEYS.map((key, i) => {
        const status = getStepStatus(key, i);
        const s = statusStyle[status as keyof typeof statusStyle] || statusStyle.pending;
        const isActive = status === "running";

        return (
          <React.Fragment key={key}>
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive ? "ring-2 ring-yellow-400 ring-offset-1" : ""
              }`}
              style={{ backgroundColor: s.bg, color: s.color, borderColor: s.border }}
            >
              <div className="flex items-center gap-1">
                {status === "completed" && <span>&#10003;</span>}
                {status === "running" && <Loader2 size={10} className="animate-spin" />}
                {status === "pending" && <span>&#9675;</span>}
                {status === "failed" && <span>&#10007;</span>}
                <span>{STEP_NAMES[i]}</span>
              </div>
            </div>
            {i < STEP_KEYS.length - 1 && <span className="text-gray-300 mx-0.5">&rarr;</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ==================== Agent 状态面板 ====================

interface AgentStatusPanelProps {
  pipeline: PipelineRun | null;
  hasActivePipeline: boolean;
  agentStats: AgentStat[];
}

export default function AgentStatusPanel({
  pipeline,
  hasActivePipeline,
  agentStats,
}: AgentStatusPanelProps) {
  const isPipelineRunning = pipeline?.status === "running";

  return (
    <>
      {/* Agent Pipeline Status */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-500" />
            Agent 状态监控
          </h4>
          {isPipelineRunning && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              运行中
            </span>
          )}
        </div>

        {!hasActivePipeline || !pipeline ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Sparkles size={32} className="mb-2 opacity-50" />
            <p className="text-sm">当前无运行中的管道</p>
            <p className="text-xs mt-1">在 AI 写作中启动管道后，这里将显示状态</p>
          </div>
        ) : (
          <div>
            <PipelineSteps
              steps={pipeline.steps}
              currentStepIndex={pipeline.currentStepIndex}
              isRunning={isPipelineRunning}
            />

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  当前: {STEP_NAMES[pipeline.currentStepIndex]} Agent
                  {isPipelineRunning && pipeline.steps[pipeline.currentStepIndex]?.status === "running"
                    ? " 执行中"
                    : ""}
                </span>
                <span>创建时间: {new Date(pipeline.createdAt).toLocaleString()}</span>
              </div>
              {pipeline.status === "completed" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                  <span>&#10003;</span> 管道已完成
                </div>
              )}
              {pipeline.status === "failed" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                  <span>&#10007;</span> 管道失败: {pipeline.error || "未知错误"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agent 执行统计 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" />
          Agent 执行统计
        </h4>
        {agentStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <BarChart3 size={32} className="mb-2 opacity-50" />
            <p className="text-sm">暂无 Agent 执行数据</p>
            <p className="text-xs mt-1">执行管道后将显示统计信息</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agentStats.map((stat) => (
              <div key={stat.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-16">{stat.name}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stat.successRate}%`,
                      backgroundColor: stat.successRate >= 80 ? "#10B981" : stat.successRate >= 50 ? "#F59E0B" : "#EF4444",
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-800 w-10">{stat.successRate}%</span>
                <span className="text-xs text-gray-400 w-20">
                  {stat.avgDuration > 0 ? `平均 ${stat.avgDuration}s` : "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
