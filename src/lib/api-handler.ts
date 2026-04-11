/**
 * 统一 API 路由处理器
 * 标准化错误响应格式: { code, msg, data? }
 */

import { NextRequest, NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ code: 0, data }, { status });
}

export function error(msg: string, code = 500, status?: number): NextResponse<ApiResponse> {
  return NextResponse.json({ code, msg }, { status: status || (code >= 400 && code < 500 ? code : 500) });
}

/**
 * 包装 API 路由处理器，自动捕获异常
 */
export function apiHandler(
  handler: (request: NextRequest, context?: { params: Promise<{ id: string }> }) => Promise<NextResponse>
): (request: NextRequest, context?: { params: Promise<{ id: string }> }) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      console.error("API Error:", err);
      const msg = err instanceof Error ? err.message : "服务器内部错误";
      return error(msg);
    }
  };
}

/**
 * 解析请求 JSON body
 */
export async function parseBody<T>(request: NextRequest): Promise<T> {
  return (await request.json()) as T;
}
