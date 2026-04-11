"use client";
import React, { useCallback, useRef } from "react";
import { Play, Loader2 } from "lucide-react";
import { useSSEStream } from "@/hooks/useSSEStream";
import PipelineProgressPanel, { PipelineStepInfo } from "../PipelineProgressPanel";

const PIPELINE_STEP_ORDER = ["collect", "topic", "write", "score", "humanize", "review", "illustrate", "publish"];

interface PipelineRunnerProps {
  categoryId: string;
  contentTopic: string;
  defaultConfig: { apiUrl: string; apiKey: string; modelName: string } | null;
  useWiki: boolean;
  wikiMode: "index-only" | "full-context";

  // 管道状态（由主组件管理）
  showPipeline: boolean;
  pipelineSteps: PipelineStepInfo[];
  pipelineStatus: "idle" | "running" | "completed" | "failed";
  pipelineId: string;
  pipelineError: string;
  pipelineMatchedPages: string[];
  pipelineRunning: boolean;

  // 状态更新回调
  setShowPipeline: (val: boolean) => void;
  setPipelineSteps: React.Dispatch<React.SetStateAction<PipelineStepInfo[]>>;
  setPipelineStatus: (val: "idle" | "running" | "completed" | "failed") => void;
  setPipelineId: (val: string) => void;
  setPipelineError: (val: string) => void;
  setPipelineMatchedPages: (val: string[]) => void;
  setGeneratedContent: React.Dispatch<React.SetStateAction<string>>;
  setWikiHits: React.Dispatch<React.SetStateAction<string[]>>;
  setGeneratedTitles: React.Dispatch<React.SetStateAction<{ title: string; summary: string }[]>>;
}

export default function PipelineRunner({
  categoryId,
  contentTopic,
  defaultConfig,
  useWiki,
  wikiMode,
  showPipeline,
  pipelineSteps,
  pipelineStatus,
  pipelineId,
  pipelineError,
  pipelineMatchedPages,
  pipelineRunning,
  setShowPipeline,
  setPipelineSteps,
  setPipelineStatus,
  setPipelineId,
  setPipelineError,
  setPipelineMatchedPages,
  setGeneratedContent,
  setWikiHits,
  setGeneratedTitles,
}: PipelineRunnerProps) {
  const pipelineAbortRef = useRef<AbortController | null>(null);

  const { start: startSSE, abort: abortSSE } = useSSEStream({
    onEvent(evt) {
      // pipeline_id event
      if (evt.raw.pipelineId) setPipelineId(evt.raw.pipelineId as string);

      // step_started
      if (evt.type === "step_started" && evt.raw.step) {
        const now = new Date().toISOString();
        const step = evt.raw.step as string;
        setPipelineSteps((prev) =>
          prev.map((s) => (s.step === step ? { ...s, status: "running" as const, startedAt: now } : s))
        );
      }

      // step_completed
      if (evt.type === "step_completed" && evt.raw.step) {
        const now = new Date().toISOString();
        const step = evt.raw.step as string;
        setPipelineSteps((prev) =>
          prev.map((s) =>
            s.step === step
              ? {
                  ...s,
                  status: "completed" as const,
                  completedAt: now,
                  score: evt.raw.score as number | undefined,
                  feedback: evt.raw.feedback as string | undefined,
                }
              : s
          )
        );
        if (step === "write" && evt.raw.output) {
          setGeneratedContent(evt.raw.output as string);
        }
      }

      // step_failed
      if (evt.type === "step_failed" && evt.raw.step) {
        const step = evt.raw.step as string;
        setPipelineSteps((prev) =>
          prev.map((s) =>
            s.step === step
              ? { ...s, status: "failed" as const, feedback: (evt.raw.error || evt.raw.feedback || "步骤失败") as string }
              : s
          )
        );
      }

      // wiki_context
      if (evt.type === "wiki_context" && Array.isArray(evt.raw.pages)) {
        setPipelineMatchedPages(evt.raw.pages as string[]);
        setWikiHits(evt.raw.pages as string[]);
      }

      // pipeline_completed
      if (evt.type === "pipeline_completed") {
        setPipelineStatus("completed");
        if (evt.raw.output) setGeneratedContent(evt.raw.output as string);
      }

      // pipeline_failed
      if (evt.type === "pipeline_failed") {
        setPipelineStatus("failed");
        setPipelineError((evt.raw.error as string) || "管道执行失败");
      }
    },
    onDone() {
      // 流结束，直接设为 completed（pipeline_completed 事件已处理了实际状态）
    },
    onError(err) {
      if (err.name === "AbortError") return;
      setPipelineStatus("failed");
      setPipelineError(err.message);
    },
  });

  const startPipeline = useCallback(async () => {
    if (!contentTopic.trim()) {
      alert("请输入内容主题");
      return;
    }
    if (!defaultConfig) {
      alert("请先在「系统设置」中配置 API");
      return;
    }

    setShowPipeline(true);
    setPipelineStatus("running");
    setPipelineError("");
    setPipelineMatchedPages([]);
    setGeneratedContent("");
    setGeneratedTitles([]);
    setWikiHits([]);

    const initialSteps: PipelineStepInfo[] = PIPELINE_STEP_ORDER.map((s) => ({
      step: s,
      status: "pending" as const,
    }));
    setPipelineSteps(initialSteps);

    try {
      await startSSE("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          keyword: contentTopic,
          useWiki: useWiki || undefined,
          wikiMode: useWiki ? wikiMode : undefined,
          apiUrl: defaultConfig.apiUrl,
          apiKey: defaultConfig.apiKey,
          modelName: defaultConfig.modelName,
        }),
      });
    } catch {
      // useSSEStream 的 onError 已处理
    }
  }, [contentTopic, defaultConfig, categoryId, useWiki, wikiMode, startSSE, setShowPipeline, setPipelineStatus, setPipelineError, setPipelineMatchedPages, setGeneratedContent, setGeneratedTitles, setWikiHits, setPipelineSteps]);

  const handleCancelPipeline = useCallback(() => {
    abortSSE();
    setPipelineStatus("failed");
    setPipelineError("已取消");
  }, [abortSSE, setPipelineStatus, setPipelineError]);

  const handleRetryPipeline = useCallback(() => {
    startPipeline();
  }, [startPipeline]);

  return (
    <>
      {/* 管道启动按钮 - 在创建文章栏里 */}
      <button
        onClick={startPipeline}
        disabled={pipelineRunning || !defaultConfig}
        className="px-5 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
        title="启动完整管道：采集→选题→写作→评分→去AI化→审核→配图→发布"
      >
        {pipelineRunning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
        管道
      </button>

      {/* 管道进度面板 */}
      {showPipeline && pipelineSteps.length > 0 && (
        <div className="mb-6">
          <PipelineProgressPanel
            pipelineId={pipelineId}
            steps={pipelineSteps}
            currentStepIndex={pipelineSteps.findIndex((s) => s.status === "running")}
            overallStatus={pipelineStatus}
            error={pipelineError}
            matchedPages={pipelineMatchedPages}
            onRetry={pipelineStatus === "failed" ? handleRetryPipeline : undefined}
            onCancel={pipelineStatus === "running" ? handleCancelPipeline : undefined}
          />
        </div>
      )}
    </>
  );
}
