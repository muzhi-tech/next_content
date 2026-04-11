/**
 * 8 大 Agent 协同管道
 * collect -> topic -> write -> score -> humanize -> review -> illustrate -> publish
 *
 * 管道状态持久化到 db.json，重启后不丢失。
 * 支持事件回调用于 SSE 流式推送。
 * 支持断点恢复、并发控制、超时保护。
 */

import { createChatCompletionJSON, parseJSON } from "@/lib/content-generator";
import { humanizeContent } from "./agents/humanize";
import { scoreContent } from "./agents/score";
import { reviewContent } from "./agents/review";
import { generateStickerContent, type StickerOutput } from "./agents/sticker-writer";
import {
  getPipelineRun,
  createPipelineRun,
  updatePipelineStep,
  updatePipelineStatus,
  updatePipelineRun,
  listPipelineRuns,
  createGeneratedContent,
  createStickerContent,
  getDefaultApiConfig,
} from "@/lib/db";
import type { PipelineRun, PipelineStepResult, AIConfig, StyleProfile } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { TOPIC_SYSTEM_PROMPT, WRITE_SYSTEM_PROMPT } from "./prompts/topic";
import { extractStyleProfile } from "./agents/style-extractor";
import { generateIllustrations, type IllustrationResult } from "./agents/illustrate";
import { publishContent, type PublishResults } from "./agents/publisher";

export type PipelineStep = "collect" | "topic" | "write" | "score" | "humanize" | "review" | "illustrate" | "publish" | "microwriting" | "visualrender";

export interface StepResult {
  step: PipelineStep;
  status: "success" | "failed" | "skipped";
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

export interface PipelineContext {
  id: string;
  categoryId: string;
  topic?: string;
  content?: string;
  score?: number;
  coverPrompt?: string;
  matchedPages?: string[];
  currentStep: PipelineStep;
  status: "running" | "completed" | "failed" | "paused";
  history: StepResult[];
  retryCount: number;
  stickerData?: StickerOutput;  // 贴图模式输出
  reviewRetryCount: number;     // 审核重试次数
  reviewIssues?: string[];      // 审核反馈问题
  styleProfile?: StyleProfile;  // 采集文章的风格基因
  coverUrl?: string;              // 生成的封面图 URL
  illustrations?: Array<{ label: string; url?: string; prompt: string }>;  // 插图
  publishResults?: PublishResults;  // 多平台发布结果
}

const STEP_ORDER: PipelineStep[] = ["collect", "topic", "write", "score", "humanize", "review", "illustrate", "publish"];

const MAX_WRITE_RETRIES = 3;
const MAX_REVIEW_RETRIES = 2;

const STEP_TIMEOUT_MS = 60_000;
const PIPELINE_TIMEOUT_MS = 10 * 60_000;

function stepResult(step: PipelineStep, status: "success" | "failed" | "skipped", data?: Record<string, unknown>, error?: string): StepResult {
  return { step, status, data, error, timestamp: new Date().toISOString() };
}

function buildInitialSteps(): PipelineStepResult[] {
  return STEP_ORDER.map((step) => ({
    step,
    status: "pending" as const,
  }));
}

export type PipelineEventType =
  | "pipeline_start"
  | "step_start"
  | "step_complete"
  | "step_failed"
  | "wiki_context"
  | "pipeline_complete"
  | "pipeline_failed"
  | "pipeline_paused"
  | "sticker_data";

export interface PipelineEvent {
  type: PipelineEventType;
  pipelineId: string;
  step?: string;
  stepIndex?: number;
  status?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

export type PipelineEventHandler = (event: PipelineEvent) => void;

function withTimeout<T>(promise: Promise<T>, ms: number, stepName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`步骤 ${stepName} 超时 (${ms / 1000}s)`)), ms)
    ),
  ]);
}

export async function getPipeline(id: string): Promise<PipelineContext | undefined> {
  const run = await getPipelineRun(id);
  if (!run) return undefined;

  const ctx: PipelineContext = {
    id: run.id,
    categoryId: run.categoryId,
    currentStep: STEP_ORDER[run.currentStepIndex] || "publish",
    status: run.status === "paused" ? "paused" : run.status,
    history: run.steps.map((s) => ({
      step: s.step as PipelineStep,
      status: (s.status === "completed" ? "success" : s.status === "running" ? "success" : s.status === "pending" ? "skipped" : "failed") as StepResult["status"],
      timestamp: s.completedAt || s.startedAt || run.createdAt,
      ...(s.output ? { data: { output: s.output } } : {}),
      ...(s.feedback ? { error: s.feedback } : {}),
    })),
    retryCount: 0,
    reviewRetryCount: 0,
    topic: run.steps.find((s) => s.step === "topic")?.output,
    content: run.steps.find((s) => s.step === "write")?.output,
    score: run.steps.find((s) => s.step === "score")?.score,
    coverPrompt: run.steps.find((s) => s.step === "illustrate")?.output,
    matchedPages: [],
  };

  return ctx;
}

async function persistStep(id: string, stepIndex: number, update: Partial<PipelineStepResult>): Promise<void> {
  await updatePipelineStep(id, stepIndex, update);
}

function emitEvent(
  handler: PipelineEventHandler | undefined,
  type: PipelineEventType,
  pipelineId: string,
  extra?: Partial<PipelineEvent>
): void {
  if (!handler) return;
  handler({
    type,
    pipelineId,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

/**
 * Run the full pipeline with resume support
 */
export async function runPipeline(params: {
  categoryId: string;
  keywordId?: string;
  apiConfig: AIConfig;
  useWiki?: boolean;
  wikiMode?: "off" | "index-only" | "full-context";
  onEvent?: PipelineEventHandler;
  resumeFromPipelineId?: string;
  type?: "long-article" | "sticker";  // 管道类型：长文 or 贴图
  humanApproval?: boolean;  // 选题后暂停等待人工确认
  targetPlatforms?: string[];  // 目标发布平台，默认 ["wx"]
}): Promise<PipelineContext> {
  const pipelineType = params.type || "long-article";

  // 贴图模式走独立流程
  if (pipelineType === "sticker") {
    return runStickerPipeline(params);
  }
  const { onEvent } = params;
  const pipelineStart = Date.now();

  let skipUntil = 0;
  let ctx: PipelineContext = {
    id: generateId(),
    categoryId: params.categoryId,
    currentStep: "collect",
    status: "running",
    history: [],
    retryCount: 0,
    reviewRetryCount: 0,
  };

  let collectedArticles: Array<{ title: string; content: string; platform: string }> = [];

  if (params.resumeFromPipelineId) {
    const prevRun = await getPipelineRun(params.resumeFromPipelineId);
    if (prevRun) {
      ctx.id = prevRun.id;
      ctx.categoryId = prevRun.categoryId;
      const failedIdx = prevRun.steps.findIndex((s: PipelineStepResult) => s.status !== 'completed' && s.status !== 'pending');
      skipUntil = failedIdx >= 0 ? failedIdx : prevRun.steps.length;
      for (let i = 0; i < skipUntil && i < prevRun.steps.length; i++) {
        const step = prevRun.steps[i];
        if (step.step === 'topic' && step.output) ctx.topic = step.output;
        if (step.step === 'write' && step.output) ctx.content = step.output;
        if (step.step === 'score' && step.score != null) ctx.score = step.score;
        if (step.step === 'illustrate' && step.output) ctx.coverPrompt = step.output;
      }
    }
  }

  const now = new Date().toISOString();
  const run: PipelineRun = {
    id: ctx.id,
    categoryId: params.categoryId,
    type: pipelineType,
    status: "running",
    steps: buildInitialSteps(),
    currentStepIndex: skipUntil,
    createdAt: now,
    updatedAt: now,
  };

  if (params.resumeFromPipelineId) {
    await updatePipelineStatus(ctx.id, "running");
    for (let i = 0; i < skipUntil; i++) {
      run.steps[i] = { ...run.steps[i], status: "completed", completedAt: now };
    }
  } else {
    await createPipelineRun(run);
  }

  const checkTimeout = () => {
    if (Date.now() - pipelineStart > PIPELINE_TIMEOUT_MS) {
      throw new Error('管道整体超时 (10min)');
    }
  };

  emitEvent(onEvent, "pipeline_start", ctx.id, { status: "running" });

  try {
    // Step 0: Collect
    if (skipUntil <= 0) {
      checkTimeout();
      ctx.currentStep = "collect";
      emitEvent(onEvent, "step_start", ctx.id, { step: "collect", stepIndex: 0 });
      await persistStep(ctx.id, 0, { status: "running", startedAt: new Date().toISOString() });
      collectedArticles = await withTimeout(
        executeCollect(params.categoryId, params.keywordId),
        STEP_TIMEOUT_MS, "collect"
      );
      ctx.history.push(stepResult("collect", "success", { count: collectedArticles.length }));
      await persistStep(ctx.id, 0, { status: "completed", output: `${collectedArticles.length} articles`, completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_complete", ctx.id, { step: "collect", stepIndex: 0, data: { count: collectedArticles.length } });

      if (collectedArticles.length === 0) {
        ctx.history.push(stepResult("topic", "skipped"));
        ctx.history.push(stepResult("write", "skipped"));
        ctx.status = "failed";
        await updatePipelineStatus(ctx.id, "failed", undefined, "No articles collected");
        emitEvent(onEvent, "pipeline_failed", ctx.id, { error: "No articles collected" });
        return ctx;
      }

      // Extract style profile from collected articles
      try {
        ctx.styleProfile = await withTimeout(
          extractStyleProfile(params.apiConfig, collectedArticles),
          STEP_TIMEOUT_MS, "style-extract"
        );
      } catch (e) {
        console.warn("[pipeline] Style extraction failed, continuing without:", e);
      }
    } else {
      collectedArticles = await executeCollect(params.categoryId, params.keywordId);
    }

    // Step 1: Topic
    if (skipUntil <= 1) {
      checkTimeout();
      ctx.currentStep = "topic";
      emitEvent(onEvent, "step_start", ctx.id, { step: "topic", stepIndex: 1 });
      await persistStep(ctx.id, 1, { status: "running", startedAt: new Date().toISOString() });
      const topic = await withTimeout(
        executeTopic(params.apiConfig, collectedArticles),
        STEP_TIMEOUT_MS, "topic"
      );
      ctx.topic = topic;
      ctx.history.push(stepResult("topic", "success", { topic }));
      await persistStep(ctx.id, 1, { status: "completed", output: topic, completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_complete", ctx.id, { step: "topic", stepIndex: 1, data: { topic } });

      // Human-in-the-loop: pause after topic if humanApproval is enabled
      if (params.humanApproval) {
        ctx.status = "paused";
        await updatePipelineStatus(ctx.id, "paused");
        emitEvent(onEvent, "pipeline_paused", ctx.id, { status: "paused", data: { topic } });
        return ctx;
      }
    }

    // Step 2-3: Write + Score
    if (skipUntil <= 2) {
      ctx.currentStep = "write";
      emitEvent(onEvent, "step_start", ctx.id, { step: "write", stepIndex: 2 });
      await persistStep(ctx.id, 2, { status: "running", startedAt: new Date().toISOString() });
      await executeWriteLoop(ctx, params.apiConfig, collectedArticles, params.useWiki, params.wikiMode, onEvent);

      if (ctx.status === "failed") {
        await updatePipelineStatus(ctx.id, "failed", undefined, "Write/score loop failed");
        emitEvent(onEvent, "pipeline_failed", ctx.id, { error: "Write/score loop failed" });
        return ctx;
      }
    }

    // Step 4: Humanize
    if (skipUntil <= 4) {
      checkTimeout();
      ctx.currentStep = "humanize";
      emitEvent(onEvent, "step_start", ctx.id, { step: "humanize", stepIndex: 4 });
      await persistStep(ctx.id, 4, { status: "running", startedAt: new Date().toISOString() });
      try {
        const humanized = await withTimeout(
          humanizeContent(params.apiConfig, ctx.content || ""),
          STEP_TIMEOUT_MS, "humanize"
        );
        ctx.content = humanized.content;
        ctx.history.push(stepResult("humanize", "success", { score: humanized.score, changes: humanized.changes.length }));
        await persistStep(ctx.id, 4, { status: "completed", output: `humanized, score=${humanized.score}`, score: humanized.score, completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_complete", ctx.id, { step: "humanize", stepIndex: 4, data: { score: humanized.score } });
      } catch (error) {
        ctx.history.push(stepResult("humanize", "failed", undefined, error instanceof Error ? error.message : String(error)));
        await persistStep(ctx.id, 4, { status: "completed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_complete", ctx.id, { step: "humanize", stepIndex: 4, data: { error: error instanceof Error ? error.message : String(error) } });
      }
    }

    // Step 5: Review (with retry loop: reject -> humanize with feedback -> re-review)
    if (skipUntil <= 5) {
      checkTimeout();
      ctx.currentStep = "review";
      ctx.reviewRetryCount = 0;
      emitEvent(onEvent, "step_start", ctx.id, { step: "review", stepIndex: 5 });
      await persistStep(ctx.id, 5, { status: "running", startedAt: new Date().toISOString() });
      try {
        const reviewPassed = await executeReviewLoop(ctx, params.apiConfig, onEvent, checkTimeout);
        if (!reviewPassed) {
          ctx.status = "failed";
          await updatePipelineStatus(ctx.id, "failed", undefined, "Review rejected after max retries");
          emitEvent(onEvent, "pipeline_failed", ctx.id, { error: "Review rejected after max retries" });
          return ctx;
        }
      } catch (error) {
        ctx.history.push(stepResult("review", "failed", undefined, error instanceof Error ? error.message : String(error)));
        await persistStep(ctx.id, 5, { status: "failed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_failed", ctx.id, { step: "review", stepIndex: 5, error: error instanceof Error ? error.message : String(error) });
        ctx.status = "failed";
        await updatePipelineStatus(ctx.id, "failed", undefined, error instanceof Error ? error.message : String(error));
        emitEvent(onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
        return ctx;
      }
    }

    // Step 6: Illustrate (prompts + actual image generation via FAL)
    if (skipUntil <= 6) {
      checkTimeout();
      ctx.currentStep = "illustrate";
      emitEvent(onEvent, "step_start", ctx.id, { step: "illustrate", stepIndex: 6 });
      await persistStep(ctx.id, 6, { status: "running", startedAt: new Date().toISOString() });
      try {
        const illResult = await withTimeout(
          generateIllustrations(params.apiConfig, ctx.topic || "", ctx.content || ""),
          STEP_TIMEOUT_MS * 2, "illustrate"  // longer timeout for image generation
        );
        ctx.coverPrompt = illResult.coverPrompt;
        ctx.coverUrl = illResult.coverUrl;
        ctx.illustrations = illResult.illustrations;
        ctx.history.push(stepResult("illustrate", "success", {
          coverPrompt: illResult.coverPrompt,
          coverUrl: illResult.coverUrl,
          illustrationCount: illResult.illustrations.length,
        }));
        await persistStep(ctx.id, 6, {
          status: "completed",
          output: JSON.stringify({ coverPrompt: illResult.coverPrompt, coverUrl: illResult.coverUrl, illustrations: illResult.illustrations }),
          completedAt: new Date().toISOString()
        });
        emitEvent(onEvent, "step_complete", ctx.id, {
          step: "illustrate", stepIndex: 6,
          data: { coverPrompt: illResult.coverPrompt, coverUrl: illResult.coverUrl, illustrationCount: illResult.illustrations.length }
        });
      } catch (error) {
        ctx.history.push(stepResult("illustrate", "failed", undefined, error instanceof Error ? error.message : String(error)));
        await persistStep(ctx.id, 6, { status: "completed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_complete", ctx.id, { step: "illustrate", stepIndex: 6, data: { error: error instanceof Error ? error.message : String(error) } });
      }
    }

    // Step 7: Publish (multi-platform via unified publisher)
    if (skipUntil <= 7) {
      checkTimeout();
      ctx.currentStep = "publish";
      emitEvent(onEvent, "step_start", ctx.id, { step: "publish", stepIndex: 7 });
      await persistStep(ctx.id, 7, { status: "running", startedAt: new Date().toISOString() });
      try {
        // Use unified multi-platform publisher (defaults to WeChat if no platforms specified)
        const targetPlatforms: import("@/lib/types").Platform[] = (params.targetPlatforms as import("@/lib/types").Platform[]) || ["wx"];
        const publishResults = await withTimeout(
          publishContent(targetPlatforms, {
            topic: ctx.topic || "",
            content: ctx.content || "",
            coverPrompt: ctx.coverPrompt,
            coverUrl: ctx.coverUrl,
          }),
          STEP_TIMEOUT_MS, "publish"
        );
        ctx.publishResults = publishResults;
        const wxResult = publishResults.find(r => r.platform === "wx");
        const publishUrl = wxResult?.url;
        const publishSuccess = publishResults.some(r => r.success);

        ctx.history.push(stepResult("publish", publishSuccess ? "success" : "failed", {
          topic: ctx.topic,
          contentLength: ctx.content?.length || 0,
          platforms: publishResults.map(r => `${r.platform}:${r.success ? "ok" : "fail"}`).join(","),
          url: publishUrl,
        }));

        if (publishSuccess) {
          ctx.status = "completed";
          await persistStep(ctx.id, 7, {
            status: "completed",
            output: JSON.stringify({ topic: ctx.topic, contentLength: ctx.content?.length || 0, url: publishUrl, platforms: publishResults }),
            completedAt: new Date().toISOString()
          });
          await updatePipelineStatus(ctx.id, "completed", ctx.content);
          emitEvent(onEvent, "step_complete", ctx.id, { step: "publish", stepIndex: 7, data: { topic: ctx.topic, url: publishUrl, platforms: publishResults } });
          emitEvent(onEvent, "pipeline_complete", ctx.id, { status: "completed", data: { topic: ctx.topic, contentLength: ctx.content?.length || 0, score: ctx.score, coverPrompt: ctx.coverPrompt, url: publishUrl, coverUrl: ctx.coverUrl } });
          // Auto-save generated content as draft
          saveGeneratedContentFromPipeline(ctx).catch((err) => {
            console.error("[pipeline] Auto-save generated content failed:", err);
          });
        } else {
          const errorMsg = publishResults.map(r => `${r.platform}: ${r.error}`).join("; ");
          await persistStep(ctx.id, 7, { status: "failed", feedback: errorMsg, completedAt: new Date().toISOString() });
          emitEvent(onEvent, "step_failed", ctx.id, { step: "publish", stepIndex: 7, error: errorMsg });
          ctx.status = "failed";
          await updatePipelineStatus(ctx.id, "failed", undefined, errorMsg);
          emitEvent(onEvent, "pipeline_failed", ctx.id, { error: errorMsg });
          return ctx;
        }
      } catch (error) {
        ctx.history.push(stepResult("publish", "failed", undefined, error instanceof Error ? error.message : String(error)));
        await persistStep(ctx.id, 7, { status: "failed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_failed", ctx.id, { step: "publish", stepIndex: 7, error: error instanceof Error ? error.message : String(error) });
        ctx.status = "failed";
        await updatePipelineStatus(ctx.id, "failed", undefined, error instanceof Error ? error.message : String(error));
        emitEvent(onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
        return ctx;
      }
    }

  } catch (error) {
    ctx.status = "failed";
    ctx.history.push(stepResult(ctx.currentStep, "failed", undefined, error instanceof Error ? error.message : String(error)));
    await updatePipelineStatus(ctx.id, "failed", undefined, error instanceof Error ? error.message : String(error));
    emitEvent(onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
  }

  return ctx;
}

/**
 * Resume a paused pipeline from the topic approval step.
 * Called after user confirms/approves the topic via PATCH /api/pipeline/[id].
 */
export async function resumePipeline(params: {
  pipelineId: string;
  approvedTopic?: string;
  targetPlatforms?: string[];
  onEvent?: PipelineEventHandler;
}): Promise<PipelineContext> {
  const run = await getPipelineRun(params.pipelineId);
  if (!run) throw new Error("管道不存在");
  if (run.status !== "paused") throw new Error("管道不在暂停状态");

  const apiConfig = await getDefaultApiConfig();
  if (!apiConfig) throw new Error("未配置 AI API");

  const ctx: PipelineContext = {
    id: run.id,
    categoryId: run.categoryId,
    topic: params.approvedTopic || run.steps.find(s => s.step === "topic")?.output || "",
    currentStep: "write",
    status: "running",
    history: [],
    retryCount: 0,
    reviewRetryCount: 0,
    matchedPages: [],
  };

  // Restore collected articles and re-extract style profile
  const collectedArticles = await executeCollect(ctx.categoryId);
  try {
    ctx.styleProfile = await extractStyleProfile({ apiUrl: apiConfig.apiUrl, apiKey: apiConfig.apiKey, modelName: apiConfig.modelName }, collectedArticles);
  } catch (e) {
    console.warn("[resumePipeline] Style extraction failed, continuing without:", e);
  }

  // Update pipeline status back to running
  await updatePipelineStatus(ctx.id, "running");

  // If topic was modified, update step 1
  if (params.approvedTopic) {
    ctx.topic = params.approvedTopic;
    await persistStep(ctx.id, 1, { status: "completed", output: params.approvedTopic, completedAt: new Date().toISOString() });
  }

  emitEvent(params.onEvent, "pipeline_start", ctx.id, { status: "running", data: { resumed: true, topic: ctx.topic } });

  const pipelineStart = Date.now();
  const checkTimeout = () => {
    if (Date.now() - pipelineStart > PIPELINE_TIMEOUT_MS) {
      throw new Error("管道整体超时 (10min)");
    }
  };

  try {
    // Continue from Step 2: Write + Score
    ctx.currentStep = "write";
    emitEvent(params.onEvent, "step_start", ctx.id, { step: "write", stepIndex: 2 });
    await persistStep(ctx.id, 2, { status: "running", startedAt: new Date().toISOString() });
    await executeWriteLoop(ctx, { apiUrl: apiConfig.apiUrl, apiKey: apiConfig.apiKey, modelName: apiConfig.modelName }, collectedArticles, undefined, undefined, params.onEvent);

    if (ctx.status === "failed") {
      await updatePipelineStatus(ctx.id, "failed", undefined, "Write/score loop failed");
      emitEvent(params.onEvent, "pipeline_failed", ctx.id, { error: "Write/score loop failed" });
      return ctx;
    }

    // Step 4: Humanize
    checkTimeout();
    ctx.currentStep = "humanize";
    emitEvent(params.onEvent, "step_start", ctx.id, { step: "humanize", stepIndex: 4 });
    await persistStep(ctx.id, 4, { status: "running", startedAt: new Date().toISOString() });
    try {
      const humanized = await withTimeout(
        humanizeContent({ apiUrl: apiConfig.apiUrl, apiKey: apiConfig.apiKey, modelName: apiConfig.modelName }, ctx.content || ""),
        STEP_TIMEOUT_MS, "humanize"
      );
      ctx.content = humanized.content;
      ctx.history.push(stepResult("humanize", "success", { score: humanized.score, changes: humanized.changes.length }));
      await persistStep(ctx.id, 4, { status: "completed", output: `humanized, score=${humanized.score}`, score: humanized.score, completedAt: new Date().toISOString() });
      emitEvent(params.onEvent, "step_complete", ctx.id, { step: "humanize", stepIndex: 4, data: { score: humanized.score } });
    } catch (error) {
      ctx.history.push(stepResult("humanize", "failed", undefined, error instanceof Error ? error.message : String(error)));
      await persistStep(ctx.id, 4, { status: "completed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
      emitEvent(params.onEvent, "step_complete", ctx.id, { step: "humanize", stepIndex: 4, data: { error: error instanceof Error ? error.message : String(error) } });
    }

    // Step 5: Review loop
    checkTimeout();
    ctx.currentStep = "review";
    ctx.reviewRetryCount = 0;
    emitEvent(params.onEvent, "step_start", ctx.id, { step: "review", stepIndex: 5 });
    await persistStep(ctx.id, 5, { status: "running", startedAt: new Date().toISOString() });
    try {
      const reviewPassed = await executeReviewLoop(ctx, { apiUrl: apiConfig.apiUrl, apiKey: apiConfig.apiKey, modelName: apiConfig.modelName }, params.onEvent, checkTimeout);
      if (!reviewPassed) {
        ctx.status = "failed";
        await updatePipelineStatus(ctx.id, "failed", undefined, "Review rejected after max retries");
        emitEvent(params.onEvent, "pipeline_failed", ctx.id, { error: "Review rejected after max retries" });
        return ctx;
      }
    } catch (error) {
      ctx.status = "failed";
      await updatePipelineStatus(ctx.id, "failed", undefined, error instanceof Error ? error.message : String(error));
      emitEvent(params.onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
      return ctx;
    }

    // Step 6: Illustrate
    checkTimeout();
    ctx.currentStep = "illustrate";
    emitEvent(params.onEvent, "step_start", ctx.id, { step: "illustrate", stepIndex: 6 });
    await persistStep(ctx.id, 6, { status: "running", startedAt: new Date().toISOString() });
    try {
      const illResult = await withTimeout(
        generateIllustrations({ apiUrl: apiConfig.apiUrl, apiKey: apiConfig.apiKey, modelName: apiConfig.modelName }, ctx.topic || "", ctx.content || ""),
        STEP_TIMEOUT_MS * 2, "illustrate"
      );
      ctx.coverPrompt = illResult.coverPrompt;
      ctx.coverUrl = illResult.coverUrl;
      ctx.illustrations = illResult.illustrations;
      ctx.history.push(stepResult("illustrate", "success", { coverUrl: illResult.coverUrl, illustrationCount: illResult.illustrations.length }));
      await persistStep(ctx.id, 6, { status: "completed", output: JSON.stringify({ coverUrl: illResult.coverUrl, illustrations: illResult.illustrations }), completedAt: new Date().toISOString() });
      emitEvent(params.onEvent, "step_complete", ctx.id, { step: "illustrate", stepIndex: 6, data: { coverUrl: illResult.coverUrl, illustrationCount: illResult.illustrations.length } });
    } catch (error) {
      ctx.history.push(stepResult("illustrate", "failed", undefined, error instanceof Error ? error.message : String(error)));
      await persistStep(ctx.id, 6, { status: "completed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
      emitEvent(params.onEvent, "step_complete", ctx.id, { step: "illustrate", stepIndex: 6, data: { error: error instanceof Error ? error.message : String(error) } });
    }

    // Step 7: Publish
    checkTimeout();
    ctx.currentStep = "publish";
    emitEvent(params.onEvent, "step_start", ctx.id, { step: "publish", stepIndex: 7 });
    await persistStep(ctx.id, 7, { status: "running", startedAt: new Date().toISOString() });
    try {
      const targetPlatforms: import("@/lib/types").Platform[] = (params.targetPlatforms as import("@/lib/types").Platform[]) || ["wx"];
      const publishResults = await withTimeout(
        publishContent(targetPlatforms, {
          topic: ctx.topic || "",
          content: ctx.content || "",
          coverPrompt: ctx.coverPrompt,
          coverUrl: ctx.coverUrl,
        }),
        STEP_TIMEOUT_MS, "publish"
      );
      ctx.publishResults = publishResults;
      const publishSuccess = publishResults.some(r => r.success);

      if (publishSuccess) {
        ctx.status = "completed";
        const wxResult = publishResults.find(r => r.platform === "wx");
        await persistStep(ctx.id, 7, { status: "completed", output: JSON.stringify({ url: wxResult?.url, platforms: publishResults }), completedAt: new Date().toISOString() });
        await updatePipelineStatus(ctx.id, "completed", ctx.content);
        emitEvent(params.onEvent, "step_complete", ctx.id, { step: "publish", stepIndex: 7, data: { topic: ctx.topic, url: wxResult?.url } });
        emitEvent(params.onEvent, "pipeline_complete", ctx.id, { status: "completed", data: { topic: ctx.topic, coverUrl: ctx.coverUrl } });
        saveGeneratedContentFromPipeline(ctx).catch(() => {});
      } else {
        const errorMsg = publishResults.map(r => `${r.platform}: ${r.error}`).join("; ");
        ctx.status = "failed";
        await updatePipelineStatus(ctx.id, "failed", undefined, errorMsg);
        emitEvent(params.onEvent, "pipeline_failed", ctx.id, { error: errorMsg });
        return ctx;
      }
    } catch (error) {
      ctx.status = "failed";
      await updatePipelineStatus(ctx.id, "failed", undefined, error instanceof Error ? error.message : String(error));
      emitEvent(params.onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
      return ctx;
    }
  } catch (error) {
    ctx.status = "failed";
    await updatePipelineStatus(ctx.id, "failed", undefined, error instanceof Error ? error.message : String(error));
    emitEvent(params.onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
  }

  return ctx;
}

/**
 * Review loop: review -> (reject) -> humanize with feedback -> re-review
 * Max retries: MAX_REVIEW_RETRIES
 * Returns true if review passed, false if exhausted retries
 */
async function executeReviewLoop(
  ctx: PipelineContext,
  config: AIConfig,
  onEvent?: PipelineEventHandler,
  checkTimeout?: () => void,
): Promise<boolean> {
  while (ctx.reviewRetryCount <= MAX_REVIEW_RETRIES) {
    checkTimeout?.();
    const review = await withTimeout(
      reviewContent(config, ctx.content || ""),
      STEP_TIMEOUT_MS, "review"
    );

    if (review.approved) {
      ctx.history.push(stepResult("review", "success", { approved: true, riskLevel: review.riskLevel, retryCount: ctx.reviewRetryCount }));
      await persistStep(ctx.id, 5, { status: "completed", output: `approved (retry ${ctx.reviewRetryCount})`, completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_complete", ctx.id, { step: "review", stepIndex: 5, data: { approved: true, retryCount: ctx.reviewRetryCount } });
      return true;
    }

    // Review rejected
    ctx.reviewIssues = review.issues;
    ctx.history.push(stepResult("review", "failed", { approved: false, riskLevel: review.riskLevel, issues: review.issues, retry: ctx.reviewRetryCount }));
    emitEvent(onEvent, "step_failed", ctx.id, { step: "review", stepIndex: 5, error: `Review rejected (attempt ${ctx.reviewRetryCount + 1}/${MAX_REVIEW_RETRIES + 1}): risk=${review.riskLevel}` });

    if (ctx.reviewRetryCount >= MAX_REVIEW_RETRIES) {
      await persistStep(ctx.id, 5, { status: "failed", output: "rejected", feedback: `risk=${review.riskLevel}, issues=${review.issues.length}, retries exhausted`, completedAt: new Date().toISOString() });
      return false;
    }

    // Re-humanize with review feedback
    ctx.reviewRetryCount++;
    emitEvent(onEvent, "step_start", ctx.id, { step: "humanize", stepIndex: 4, data: { reason: "review_feedback", retry: ctx.reviewRetryCount } });
    await persistStep(ctx.id, 4, { status: "running", startedAt: new Date().toISOString(), output: undefined, completedAt: undefined });
    try {
      const humanized = await withTimeout(
        humanizeContent(config, ctx.content || "", review.issues),
        STEP_TIMEOUT_MS, "humanize"
      );
      ctx.content = humanized.content;
      ctx.history.push(stepResult("humanize", "success", { score: humanized.score, changes: humanized.changes.length, retry: ctx.reviewRetryCount, reason: "review_feedback" }));
      await persistStep(ctx.id, 4, { status: "completed", output: `re-humanized (review retry ${ctx.reviewRetryCount}), score=${humanized.score}`, score: humanized.score, completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_complete", ctx.id, { step: "humanize", stepIndex: 4, data: { score: humanized.score, retry: ctx.reviewRetryCount, reason: "review_feedback" } });
    } catch (error) {
      ctx.history.push(stepResult("humanize", "failed", undefined, error instanceof Error ? error.message : String(error)));
      await persistStep(ctx.id, 4, { status: "completed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_complete", ctx.id, { step: "humanize", stepIndex: 4, data: { error: error instanceof Error ? error.message : String(error) } });
      // Continue to retry review even if re-humanize had issues
    }

    // Re-prepare review step for next iteration
    await persistStep(ctx.id, 5, { status: "running", startedAt: new Date().toISOString(), output: undefined, completedAt: undefined });
    emitEvent(onEvent, "step_start", ctx.id, { step: "review", stepIndex: 5, data: { retry: ctx.reviewRetryCount } });
  }

  return false;
}

async function executeWriteLoop(
  ctx: PipelineContext,
  config: AIConfig,
  articles: Array<{ title: string; content: string; platform: string }>,
  useWiki?: boolean,
  wikiMode?: "off" | "index-only" | "full-context",
  onEvent?: PipelineEventHandler,
): Promise<void> {
  let lastScoreFeedback: string | undefined;

  for (let attempt = 0; attempt <= MAX_WRITE_RETRIES; attempt++) {
    try {
      const content = await withTimeout(
        executeWrite(config, ctx.topic || "", articles, ctx.categoryId, useWiki, wikiMode, ctx, lastScoreFeedback),
        STEP_TIMEOUT_MS, "write"
      );
      ctx.content = content;
      if (ctx.matchedPages && ctx.matchedPages.length > 0) {
        emitEvent(onEvent, "wiki_context", ctx.id, { data: { pages: ctx.matchedPages } });
      }
      ctx.history.push(stepResult("write", "success", { attempt: attempt + 1, length: content.length }));
      await persistStep(ctx.id, 2, { status: "completed", output: content, completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_complete", ctx.id, { step: "write", stepIndex: 2, data: { attempt: attempt + 1, length: content.length } });
    } catch (error) {
      ctx.history.push(stepResult("write", "failed", undefined, error instanceof Error ? error.message : String(error)));
      await persistStep(ctx.id, 2, { status: "failed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_failed", ctx.id, { step: "write", stepIndex: 2, error: error instanceof Error ? error.message : String(error) });
      ctx.status = "failed";
      return;
    }

    emitEvent(onEvent, "step_start", ctx.id, { step: "score", stepIndex: 3 });
    await persistStep(ctx.id, 3, { status: "running", startedAt: new Date().toISOString() });
    try {
      const scoreResult = await withTimeout(
        scoreContent(config, ctx.topic || "", ctx.content || ""),
        STEP_TIMEOUT_MS, "score"
      );
      ctx.score = scoreResult.score;
      ctx.history.push(stepResult("score", scoreResult.passed ? "success" : "failed", { score: scoreResult.score, passed: scoreResult.passed, feedback: scoreResult.feedback }));
      await persistStep(ctx.id, 3, { status: scoreResult.passed ? "completed" : "failed", score: scoreResult.score, feedback: scoreResult.feedback, completedAt: new Date().toISOString() });

      if (scoreResult.passed) {
        emitEvent(onEvent, "step_complete", ctx.id, { step: "score", stepIndex: 3, data: { score: scoreResult.score, passed: true } });
        return;
      }

      emitEvent(onEvent, "step_failed", ctx.id, { step: "score", stepIndex: 3, error: scoreResult.feedback || "Score below threshold" });

      // Store feedback for next rewrite attempt
      lastScoreFeedback = scoreResult.feedback;

      if (attempt >= MAX_WRITE_RETRIES - 1) {
        ctx.status = "failed";
        return;
      }

      await persistStep(ctx.id, 2, { status: "running", startedAt: new Date().toISOString(), output: undefined, completedAt: undefined });
      emitEvent(onEvent, "step_start", ctx.id, { step: "write", stepIndex: 2 });
    } catch (error) {
      ctx.history.push(stepResult("score", "failed", undefined, error instanceof Error ? error.message : String(error)));
      await persistStep(ctx.id, 3, { status: "failed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
      emitEvent(onEvent, "step_failed", ctx.id, { step: "score", stepIndex: 3, error: error instanceof Error ? error.message : String(error) });
      ctx.status = "failed";
      return;
    }
  }
}

async function executeCollect(categoryId: string, keywordId?: string): Promise<Array<{ title: string; content: string; platform: string }>> {
  const { getArticles } = await import("@/lib/db");
  const { articles } = await getArticles({ categoryId, pageSize: 30, keywordId: keywordId || undefined });
  return articles.map((a) => ({ title: a.title, content: a.content, platform: a.platform }));
}

async function executeTopic(config: AIConfig, articles: Array<{ title: string; content: string; platform: string }>): Promise<string> {
  const summaries = articles.slice(0, 20).map((a, i) => `${i + 1}. [${a.platform}] ${a.title}`).join("\n");
  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: TOPIC_SYSTEM_PROMPT },
    { role: "user", content: `热门文章：\n${summaries}` },
  ]);
  return raw.trim();
}

async function executeWrite(config: AIConfig, topic: string, articles: Array<{ title: string; content: string; platform: string }>, categoryId: string, useWiki?: boolean, wikiMode?: "off" | "index-only" | "full-context", ctx?: PipelineContext, scoreFeedback?: string): Promise<string> {
  let wikiContext = '';
  let matchedPages: string[] = [];

  if (useWiki && categoryId) {
    try {
      const { buildWikiContext, resolveRelevantWikiPages } = await import('./wiki-query');
      const slugs = await resolveRelevantWikiPages(categoryId, topic, config);
      matchedPages = slugs;
      wikiContext = await buildWikiContext(categoryId, topic, config);
      if (ctx) ctx.matchedPages = matchedPages;
    } catch (e) {
      console.error('Wiki context not available:', e);
    }
  }

  let systemPrompt = WRITE_SYSTEM_PROMPT;

  if (wikiContext) {
    systemPrompt += `\n\n【Wiki知识库参考资料】\n你可以从以下知识库检索到的信息中提取论据或佐证，但请用你自己的卡兹克风格内化表达，绝不直接复制拼凑：\n\n${wikiContext}`;
  }

  if (scoreFeedback) {
    systemPrompt += `\n\n【上轮评审反馈（必须针对改进）】\n上一轮写作未通过质量评审，以下是评审反馈。请针对反馈中指出的所有问题进行改进重写：\n${scoreFeedback}`;
  }

  if (ctx?.styleProfile?.guidelines) {
    systemPrompt += `\n\n【目标风格基因（从优质素材中提取）】\n- 风格指导：${ctx.styleProfile.guidelines}\n- 典型表达：${ctx.styleProfile.samples}\n- 风格约束：${ctx.styleProfile.constraints}`;
  }

  const articlesContext = articles.slice(0, 5).map((a, i) => `[材料${i + 1}] 标题：${a.title}\n内容：${a.content.substring(0, 2000)}...`).join("\n\n");

  const raw = await createChatCompletionJSON(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: `选题：${topic}\n\n【采集素材】\n请基于以下素材，提炼观点和细节，写出符合卡兹克风格的文章：\n\n${articlesContext}` },
  ]);
  return raw.trim();
}

async function executeIllustrate(config: AIConfig, topic: string, content: string): Promise<string> {
  const { generateCoverPrompt } = await import("@/lib/content-generator");
  const result = await generateCoverPrompt(config, topic);
  return result.prompt;
}

/**
 * Auto-save pipeline output to generated_contents table as draft.
 * Wrapped in try/catch so failure does not affect pipeline status.
 */
async function saveGeneratedContentFromPipeline(ctx: PipelineContext): Promise<void> {
  try {
    await createGeneratedContent({
      categoryId: ctx.categoryId,
      topic: ctx.topic || "untitled",
      content: ctx.content || "",
      status: "draft",
      sourceType: "pipeline",
      coverPrompt: ctx.coverPrompt,
    });
    console.log(`[pipeline] Auto-saved generated content for pipeline ${ctx.id}`);
  } catch (err) {
    console.error("[pipeline] Failed to auto-save generated content:", err);
  }
}

/**
 * 贴图模式管道 (4步)
 * Collect -> MicroWriting -> VisualRendering -> Publish
 */
async function runStickerPipeline(params: {
  categoryId: string;
  keywordId?: string;
  apiConfig: AIConfig;
  useWiki?: boolean;
  wikiMode?: "off" | "index-only" | "full-context";
  onEvent?: PipelineEventHandler;
  resumeFromPipelineId?: string;
}): Promise<PipelineContext> {
  const { onEvent } = params;
  const pipelineStart = Date.now();

  const ctx: PipelineContext = {
    id: generateId(),
    categoryId: params.categoryId,
    currentStep: "collect",
    status: "running",
    history: [],
    retryCount: 0,
    reviewRetryCount: 0,
  };

  let collectedArticles: Array<{ title: string; content: string; platform: string }> = [];

  const checkTimeout = () => {
    if (Date.now() - pipelineStart > PIPELINE_TIMEOUT_MS) {
      throw new Error("管道整体超时 (10min)");
    }
  };

  emitEvent(onEvent, "pipeline_start", ctx.id, { status: "running", data: { type: "sticker" } });

  try {
    // Step 0: Collect (采集)
    checkTimeout();
    ctx.currentStep = "collect";
    emitEvent(onEvent, "step_start", ctx.id, { step: "collect", stepIndex: 0 });
    collectedArticles = await withTimeout(
      executeCollect(params.categoryId, params.keywordId),
      STEP_TIMEOUT_MS, "collect"
    );
    ctx.history.push(stepResult("collect", "success", { count: collectedArticles.length }));
    emitEvent(onEvent, "step_complete", ctx.id, { step: "collect", stepIndex: 0, data: { count: collectedArticles.length } });

    if (collectedArticles.length === 0) {
      ctx.status = "failed";
      emitEvent(onEvent, "pipeline_failed", ctx.id, { error: "No articles collected" });
      return ctx;
    }

    // Step 1: MicroWriting (调用 sticker-writer，输出 JSON)
    checkTimeout();
    ctx.currentStep = "microwriting";
    emitEvent(onEvent, "step_start", ctx.id, { step: "microwriting", stepIndex: 1 });
    const sourceContent = collectedArticles
      .slice(0, 5)
      .map((a, i) => `[素材${i + 1}] ${a.title}\n${a.content.substring(0, 500)}`)
      .join("\n\n");
    const stickerData = await withTimeout(
      generateStickerContent(params.apiConfig, sourceContent),
      STEP_TIMEOUT_MS, "microwriting"
    );
    ctx.stickerData = stickerData;
    ctx.history.push(stepResult("microwriting", "success", {
      title: stickerData.title,
      slidesCount: stickerData.slides.length,
      captionLength: stickerData.caption.length
    }));
    emitEvent(onEvent, "step_complete", ctx.id, { step: "microwriting", stepIndex: 1, data: { stickerData } });

    // Step 2: VisualRendering (前端渲染生图 - 此处标记完成，前端负责渲染)
    checkTimeout();
    ctx.currentStep = "visualrender";
    emitEvent(onEvent, "step_start", ctx.id, { step: "visualrender", stepIndex: 2 });
    ctx.history.push(stepResult("visualrender", "success", { message: "Visual rendering handled by frontend" }));
    emitEvent(onEvent, "step_complete", ctx.id, { step: "visualrender", stepIndex: 2, data: { message: "Sticker data ready for visual rendering" } });

    // Step 3: Publish (组装发布 - 使用统一多平台发布器)
    checkTimeout();
    ctx.currentStep = "publish";
    emitEvent(onEvent, "step_start", ctx.id, { step: "publish", stepIndex: 3 });
    const publishResults = await withTimeout(
      publishContent(["wx"], {
        topic: ctx.topic || stickerData.title,
        content: JSON.stringify(stickerData),
        extra: { stickerMode: true, slides: stickerData.slides, caption: stickerData.caption },
      }),
      STEP_TIMEOUT_MS, "publish"
    );
    const wxResult = publishResults.find(r => r.platform === "wx");
    const publishSuccess = publishResults.some(r => r.success);
    ctx.publishResults = publishResults;
    if (!publishSuccess) throw new Error(publishResults.map(r => `${r.platform}: ${r.error}`).join("; "));
    ctx.history.push(stepResult("publish", "success", { stickerData, url: wxResult?.url, platforms: publishResults }));
    ctx.status = "completed";
    emitEvent(onEvent, "step_complete", ctx.id, { step: "publish", stepIndex: 3, data: { url: wxResult?.url } });
    emitEvent(onEvent, "pipeline_complete", ctx.id, { status: "completed", data: { stickerData, url: wxResult?.url } });

    // Auto-save sticker content as draft
    saveStickerContentFromPipeline(ctx).catch((err) => {
      console.error("[pipeline] Auto-save sticker content failed:", err);
    });

  } catch (error) {
    ctx.status = "failed";
    ctx.history.push(stepResult(ctx.currentStep, "failed", undefined, error instanceof Error ? error.message : String(error)));
    emitEvent(onEvent, "pipeline_failed", ctx.id, { error: error instanceof Error ? error.message : String(error) });
  }

  return ctx;
}

/**
 * Auto-save sticker output to sticker_contents table as draft.
 */
async function saveStickerContentFromPipeline(ctx: PipelineContext): Promise<void> {
  if (!ctx.stickerData) return;
  try {
    await createStickerContent({
      categoryId: ctx.categoryId,
      title: ctx.stickerData.title,
      slides: ctx.stickerData.slides,
      caption: ctx.stickerData.caption,
      status: "draft",
    });
    console.log(`[pipeline] Auto-saved sticker content for pipeline ${ctx.id}`);
  } catch (err) {
    console.error("[pipeline] Failed to auto-save sticker content:", err);
  }
}

export { listPipelineRuns };
