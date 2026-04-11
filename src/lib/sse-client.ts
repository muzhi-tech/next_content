/**
 * SSE 客户端工具 — 纯函数，无 React 依赖。
 *
 * re-export 自 useSSEStream hook 中的 readSSEStream 和类型。
 * React 组件用 useSSEStream hook；非组件代码（如测试工具）直接用 readSSEStream。
 */
export { readSSEStream } from "@/hooks/useSSEStream";
export type { SSEEvent, SSEHandlers } from "@/hooks/useSSEStream";
