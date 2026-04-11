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
} from "@/lib/db";
import type { PipelineRun, PipelineStepResult } from "@/lib/types";

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
  status: "running" | "completed" | "failed";
  history: StepResult[];
  retryCount: number;
  stickerData?: StickerOutput;  // 贴图模式输出
}

interface AIConfig {
  apiUrl?: string;
  apiKey?: string;
  modelName?: string;
}

const STEP_ORDER: PipelineStep[] = ["collect", "topic", "write", "score", "humanize", "review", "illustrate", "publish"];

const MAX_WRITE_RETRIES = 3;

const STEP_TIMEOUT_MS = 60_000;
const PIPELINE_TIMEOUT_MS = 10 * 60_000;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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
    status: run.status === "paused" ? "failed" : run.status,
    history: run.steps.map((s) => ({
      step: s.step as PipelineStep,
      status: (s.status === "completed" ? "success" : s.status === "running" ? "success" : s.status === "pending" ? "skipped" : "failed") as StepResult["status"],
      timestamp: s.completedAt || s.startedAt || run.createdAt,
      ...(s.output ? { data: { output: s.output } } : {}),
      ...(s.feedback ? { error: s.feedback } : {}),
    })),
    retryCount: 0,
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

    // Step 5: Review
    if (skipUntil <= 5) {
      checkTimeout();
      ctx.currentStep = "review";
      emitEvent(onEvent, "step_start", ctx.id, { step: "review", stepIndex: 5 });
      await persistStep(ctx.id, 5, { status: "running", startedAt: new Date().toISOString() });
      try {
        const review = await withTimeout(
          reviewContent(params.apiConfig, ctx.content || ""),
          STEP_TIMEOUT_MS, "review"
        );
        ctx.history.push(stepResult("review", review.approved ? "success" : "failed", { approved: review.approved, riskLevel: review.riskLevel, issues: review.issues }));
        await persistStep(ctx.id, 5, { status: review.approved ? "completed" : "failed", output: review.approved ? "approved" : "rejected", feedback: review.approved ? undefined : `risk=${review.riskLevel}, issues=${review.issues.length}`, completedAt: new Date().toISOString() });
        if (review.approved) {
          emitEvent(onEvent, "step_complete", ctx.id, { step: "review", stepIndex: 5, data: { approved: true } });
        } else {
          emitEvent(onEvent, "step_failed", ctx.id, { step: "review", stepIndex: 5, error: `Review rejected: risk=${review.riskLevel}` });
          ctx.status = "failed";
          await updatePipelineStatus(ctx.id, "failed", undefined, "Review rejected");
          emitEvent(onEvent, "pipeline_failed", ctx.id, { error: "Review rejected" });
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

    // Step 6: Illustrate
    if (skipUntil <= 6) {
      checkTimeout();
      ctx.currentStep = "illustrate";
      emitEvent(onEvent, "step_start", ctx.id, { step: "illustrate", stepIndex: 6 });
      await persistStep(ctx.id, 6, { status: "running", startedAt: new Date().toISOString() });
      try {
        const coverPrompt = await withTimeout(
          executeIllustrate(params.apiConfig, ctx.topic || "", ctx.content || ""),
          STEP_TIMEOUT_MS, "illustrate"
        );
        ctx.coverPrompt = coverPrompt;
        ctx.history.push(stepResult("illustrate", "success", { coverPrompt }));
        await persistStep(ctx.id, 6, { status: "completed", output: coverPrompt, completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_complete", ctx.id, { step: "illustrate", stepIndex: 6, data: { coverPrompt } });
      } catch (error) {
        ctx.history.push(stepResult("illustrate", "failed", undefined, error instanceof Error ? error.message : String(error)));
        await persistStep(ctx.id, 6, { status: "completed", feedback: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
        emitEvent(onEvent, "step_complete", ctx.id, { step: "illustrate", stepIndex: 6, data: { error: error instanceof Error ? error.message : String(error) } });
      }
    }

    // Step 7: Publish
    if (skipUntil <= 7) {
      checkTimeout();
      ctx.currentStep = "publish";
      emitEvent(onEvent, "step_start", ctx.id, { step: "publish", stepIndex: 7 });
      await persistStep(ctx.id, 7, { status: "running", startedAt: new Date().toISOString() });
      try {
        const publishResult = await withTimeout(
          executePublish(ctx.topic || "", ctx.content || "", ctx.coverPrompt || ""),
          STEP_TIMEOUT_MS, "publish"
        );
        ctx.history.push(stepResult("publish", "success", { topic: ctx.topic, contentLength: ctx.content?.length || 0, coverPrompt: ctx.coverPrompt, url: publishResult.url }));
        ctx.status = "completed";
        await persistStep(ctx.id, 7, { status: "completed", output: JSON.stringify({ topic: ctx.topic, contentLength: ctx.content?.length || 0, url: publishResult.url }), completedAt: new Date().toISOString() });
        await updatePipelineStatus(ctx.id, "completed", ctx.content);
        emitEvent(onEvent, "step_complete", ctx.id, { step: "publish", stepIndex: 7, data: { topic: ctx.topic, contentLength: ctx.content?.length || 0, url: publishResult.url } });
        emitEvent(onEvent, "pipeline_complete", ctx.id, { status: "completed", data: { topic: ctx.topic, contentLength: ctx.content?.length || 0, score: ctx.score, coverPrompt: ctx.coverPrompt, url: publishResult.url } });
        // Auto-save generated content as draft
        saveGeneratedContentFromPipeline(ctx).catch((err) => {
          console.error("[pipeline] Auto-save generated content failed:", err);
        });
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
    { role: "system", content: `你是一位深谙卡兹克（Khazix）爆款逻辑的内容策略分析师。请根据以下热门文章数据，运用 HKR质检法 分析出一个最有价值的公众号长文选题方向。
HKR质检法要求：
- H (Happy)：足够有趣、有悬念，标题能让人好奇想点开。
- K (Knowledge)：有信息量，看完能学到新东西或新视角。
- R (Resonance)：能戳中情绪，让人产生共鸣。

请直接返回选题标题，不要返回其他内容。标题要具体、有吸引力、自带"活人感"和口语化特征，拒绝宏大叙事和套话。` },
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
      const slugs = await resolveRelevantWikiPages(categoryId, topic, config as any);
      matchedPages = slugs;
      wikiContext = await buildWikiContext(categoryId, topic, config as any);
      if (ctx) ctx.matchedPages = matchedPages;
    } catch (e) {
      console.error('Wiki context not available:', e);
    }
  }

  let systemPrompt = `你正在以「数字生命卡兹克」的身份写一篇公众号长文。文章风格一句话概括："有见识的普通人在认真聊一件打动他的事。"

【核心价值观】
- 永远对世界保持好奇。
- 讲人话，像个活人。大胆使用"我觉得"、"我认为"，拥抱不完美。
- 真诚，不骗人。

【文章原型与叙事结构】
- 判断这属于哪种文章原型，并侧重不同写法：
  1. 调查实验型：核心是"我替你去做了这件事"，重在踩坑和发现的层层递进。
  2. 产品体验型：核心是"跟我一起玩"，重在场景演示和真实感受。
  3. 现象解读型：核心是"你注意到了吗？背后是什么？"，重在观察->好奇->研究->哲学升维。
  4. 工具分享型：核心是"我发现了一个好东西"，重在故事铺垫->展示->效果惊艳。
  5. 方法论分享型：核心是"我把压箱底的东西掏给你了"，必须有可执行建议和坦诚的失败点。
- 英雄之旅叙事弧：先说困境或好奇 -> 尝试踩坑 -> 秀出让人「卧槽」的结果。
- 逐一展示法（升番逻辑）：展示多个案例时，一轮比一轮离谱、惊喜，遵循sketch喜剧升番逻辑。

【写作内核与节奏】
- 节奏感：像跟朋友聊天。句子时长时短，用逗号制造口语化的停顿感。必须高频加入"扣主线句"。
- 故意打破：在论述中加入口语打断（如"我当时就..."），省略主语。
- 知识掉落：知识是"聊着聊着顺手掏出来"的。
- 亲自下场：让读者感觉到你真的做了这件事。
- 回环呼应（契诃夫之枪）：前面埋钩子，结尾callback呼应。
- 推荐使用口语词："坦率的讲"、"说真的"、"我当时就愣住了"、"这玩意"、"不是哥们"。

【绝对禁区（必须遵守）】
1. 禁用套话："首先...其次...最后"、"综上所述"、"值得注意的是"、"本质上"、"换句话说"。
2. 禁用冒号"："，用逗号代替；禁用破折号"——"；不用双引号，强调时用「」。
3. 避免过度结构化，不使用 bullet point 罗列观点（除非是分步教程）。
4. 拒绝教科书开头，必须从具体的事件或场景切入。

字数要求：1500-2500 字。
请根据给定选题，融合以上风格完成创作。不要返回除了文章正文外的多余对话。`;

  if (wikiContext) {
    systemPrompt += `\n\n【Wiki知识库参考资料】\n你可以从以下知识库检索到的信息中提取论据或佐证，但请用你自己的卡兹克风格内化表达，绝不直接复制拼凑：\n\n${wikiContext}`;
  }

  if (scoreFeedback) {
    systemPrompt += `\n\n【上轮评审反馈（必须针对改进）】\n上一轮写作未通过质量评审，以下是评审反馈。请针对反馈中指出的所有问题进行改进重写：\n${scoreFeedback}`;
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

interface WechatConfig {
  appId: string;
  appSecret: string;
}

interface PublishResult {
  url?: string;
  mediaId?: string;
}

const MAX_PUBLISH_RETRIES = 3;
const PUBLISH_RETRY_DELAY_MS = 2000;

async function executePublish(topic: string, content: string, coverPrompt: string): Promise<PublishResult> {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("未配置公众号 AppID/AppSecret (环境变量 WECHAT_APP_ID 和 WECHAT_APP_SECRET)，无法发布。");
  }

  // Parse content to check if it's sticker JSON
  let stickerData: { title: string; slides: { heading: string; content: string }[]; caption: string } | null = null;
  try {
    stickerData = JSON.parse(content);
    if (!stickerData.title || !stickerData.slides) {
      stickerData = null;
    }
  } catch {
    stickerData = null;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PUBLISH_RETRIES; attempt++) {
    try {
      const { fetchAccessToken, publishDraft, publishStickerDraft, uploadImageMaterial } = await import("@/lib/wechat");
      const accessToken = await fetchAccessToken(appId, appSecret);

      if (stickerData) {
        // Sticker mode: publish multi-article sticker draft
        const imageUrls = coverPrompt ? coverPrompt.split(',').filter(Boolean) : [];

        // Upload images if provided
        const uploadedImageIds: string[] = [];
        for (const imageUrl of imageUrls) {
          try {
            const result = await uploadImageMaterial(accessToken, imageUrl.trim());
            if (result.media_id) {
              uploadedImageIds.push(result.media_id);
            }
          } catch (uploadError) {
            console.warn(`[publish] Failed to upload image ${imageUrl}:`, uploadError);
          }
        }

        // Build sticker HTML content
        const buildHtml = (title: string, text: string, imgUrl?: string): string => {
          let html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:675px;margin:0 auto;padding:20px 16px;background:#fff;box-sizing:border-box;">`;
          if (imgUrl) {
            html += `<img src="${imgUrl}" style="width:100%;max-width:675px;border-radius:8px;margin-bottom:16px;display:block;" />`;
          }
          html += `<h2 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 12px 0;line-height:1.4;">${title}</h2>`;
          html += `<p style="font-size:16px;color:#333;line-height:1.8;margin:0;">${text}</p>`;
          html += `</div>`;
          return html;
        };

        const articles = [];

        // Cover article with summary of all slides
        const summaryContent = stickerData.slides
          .map((s, i) => `<p style="font-size:15px;color:#555;margin:8px 0;">📌 ${s.heading}: ${s.content}</p>`)
          .join("");
        articles.push({
          title: stickerData.title,
          content: buildHtml(stickerData.title, summaryContent, imageUrls[0]),
          thumbMediaId: uploadedImageIds[0] || "",
          author: "",
          needOpenComment: 1,
          onlyFansCanComment: 0,
        });

        // Each slide as a separate article
        for (let i = 1; i < stickerData.slides.length; i++) {
          const slide = stickerData.slides[i - 1];
          articles.push({
            title: slide.heading,
            content: buildHtml(slide.heading, `<p style="font-size:16px;color:#333;line-height:1.8;">${slide.content}</p>`, imageUrls[i]),
            thumbMediaId: uploadedImageIds[i] || "",
            author: "",
            needOpenComment: 1,
            onlyFansCanComment: 0,
          });
        }

        // Final article with caption/hook
        articles.push({
          title: "👇 点击查看更多",
          content: buildHtml("互动话题", `<p style="font-size:16px;color:#333;line-height:1.8;">${stickerData.caption}</p>`),
          thumbMediaId: uploadedImageIds[stickerData.slides.length] || "",
          author: "",
          needOpenComment: 1,
          onlyFansCanComment: 0,
        });

        const result = await publishStickerDraft(accessToken, articles);
        if (result.errcode && result.errcode !== 0) {
          throw new Error(`贴图发布失败: ${result.errmsg}`);
        }

        const mediaId = result.media_id || "";
        return {
          url: mediaId ? `https://mp.weixin.qq.com/s/${mediaId}` : undefined,
          mediaId,
        };
      } else {
        // Long article mode: publish single article draft
        const thumbMediaId = "placeholder"; // In production, upload cover image first
        const result = await publishDraft(accessToken, topic, content, thumbMediaId);
        if (result.errcode && result.errcode !== 0) {
          throw new Error(`长文发布失败: ${result.errmsg}`);
        }

        const mediaId = result.media_id || "";
        return {
          url: mediaId ? `https://mp.weixin.qq.com/s/${mediaId}` : undefined,
          mediaId,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[publish] Attempt ${attempt}/${MAX_PUBLISH_RETRIES} failed:`, err.message);

      if (attempt < MAX_PUBLISH_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, PUBLISH_RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw new Error(`公众号发布失败，已重试 ${MAX_PUBLISH_RETRIES} 次: ${lastError?.message || "未知错误"}`);
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
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    categoryId: params.categoryId,
    currentStep: "collect",
    status: "running",
    history: [],
    retryCount: 0,
  };

  let collectedArticles: Array<{ title: string; content: string; platform: string }> = [];

  const PIPELINE_TIMEOUT_MS = 10 * 60_000;
  const STEP_TIMEOUT_MS = 60_000;

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

    // Step 3: Publish (组装发布)
    checkTimeout();
    ctx.currentStep = "publish";
    emitEvent(onEvent, "step_start", ctx.id, { step: "publish", stepIndex: 3 });
    const publishResult = await withTimeout(
      executePublish(ctx.topic || stickerData.title, JSON.stringify(stickerData), ""),
      STEP_TIMEOUT_MS, "publish"
    );
    ctx.history.push(stepResult("publish", "success", { stickerData, url: publishResult.url }));
    ctx.status = "completed";
    emitEvent(onEvent, "step_complete", ctx.id, { step: "publish", stepIndex: 3, data: { url: publishResult.url } });
    emitEvent(onEvent, "pipeline_complete", ctx.id, { status: "completed", data: { stickerData, url: publishResult.url } });

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
