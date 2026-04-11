"use client";
import { useCallback, useRef } from "react";

// ==================== SSE 事件类型 ====================

/** SSE 流中解析出的统一事件 */
export interface SSEEvent {
  /** V2 格式的 type 字段（content/done/wiki/wiki_context/step_started/step_completed/step_failed/pipeline_completed/pipeline_failed 等） */
  type?: string;
  /** 文本内容增量（V1 或 V2 content 帧） */
  content?: string;
  /** 错误信息 */
  error?: string;
  /** 原始 JSON 对象，用于扩展字段（如 meta/pages/score/feedback/output/step 等） */
  raw: Record<string, unknown>;
}

/** SSE 事件回调集合 */
export interface SSEHandlers {
  /** 每解析出一个事件就调用 */
  onEvent?: (event: SSEEvent) => void;
  /** 流正常结束（[DONE] 或 done type） */
  onDone?: () => void;
  /** 发生错误 */
  onError?: (error: Error) => void;
}

// ==================== readSSEStream ====================

/**
 * 从 fetch Response 中读取 SSE 流，统一处理 V1/V2 格式。
 *
 * 使用方式：
 * ```ts
 * await readSSEStream(response, {
 *   onEvent(event) {
 *     if (event.type === "content") setContent(prev => prev + (event.content ?? ""));
 *   },
 *   onDone() { setGenerating(false); },
 *   onError(err) { alert(err.message); },
 * });
 * ```
 */
export async function readSSEStream(
  response: Response,
  handlers: SSEHandlers,
): Promise<void> {
  const { onEvent, onDone, onError } = handlers;

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    onError?.(err);
    throw err;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const err = new Error("无法读取响应流");
    onError?.(err);
    throw err;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const payload = trimmed.slice(6);
        if (payload === "[DONE]") {
          onDone?.();
          return;
        }

        try {
          const parsed: Record<string, unknown> = JSON.parse(payload);

          // 构造统一事件
          const event: SSEEvent = {
            type: parsed.type as string | undefined,
            content: parsed.content as string | undefined,
            error: parsed.error as string | undefined,
            raw: parsed,
          };

          // V2 done 信号
          if (parsed.type === "done") {
            onEvent?.(event);
            onDone?.();
            return;
          }

          onEvent?.(event);

          // 有 error 字段且无 type 时，视为致命错误
          if (parsed.error && !parsed.type) {
            const err = new Error(parsed.error as string);
            onError?.(err);
            throw err;
          }
        } catch (e) {
          if (e instanceof Error) throw e;
          // JSON 解析失败，跳过不完整数据
        }
      }
    }
    // 流自然结束
    onDone?.();
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}

// ==================== useSSEStream hook ====================

/**
 * React Hook，封装 fetch + SSE 流式读取。
 *
 * ```ts
 * const { start, abort } = useSSEStream({
 *   onEvent(event) { ... },
 *   onDone() { ... },
 *   onError(err) { ... },
 * });
 *
 * // 触发请求
 * start("/api/content/generate", { method: "POST", body: ... });
 *
 * // 取消
 * abort();
 * ```
 */
export function useSSEStream(handlers: SSEHandlers) {
  const abortRef = useRef<AbortController | null>(null);
  // 保持 handlers 引用最新
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const start = useCallback(
    async (url: string, init?: RequestInit) => {
      // 取消上一次未完成的请求
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        await readSSEStream(response, {
          onEvent: (e) => handlersRef.current.onEvent?.(e),
          onDone: () => handlersRef.current.onDone?.(),
          onError: (err) => handlersRef.current.onError?.(err),
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        throw err;
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { start, abort };
}
