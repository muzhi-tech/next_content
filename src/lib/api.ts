/**
 * 账号空间 API 服务
 * 封装所有账号空间相关的 API 调用
 */

import { Persona, Style, KnowledgeBase, WxTemplate } from "./types";

const API_BASE = "/api/account-space";

interface ApiResponse<T> {
  code: number;
  data?: T;
  msg?: string;
  total?: number;
}

// 通用请求封装
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const result: ApiResponse<T> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.msg || "API 请求失败");
  }

  return result.data as T;
}

// ==================== Persona（人设）API ====================

export const personaApi = {
  /** 获取人设列表 */
  list: () => request<Persona[]>("/personas"),

  /** 获取单个 */
  get: (id: string) => request<Persona>(`/personas/${id}`),

  /** 创建 */
  create: (data: Omit<Persona, "id" | "createdAt" | "updatedAt">) =>
    request<Persona>("/personas", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 更新 */
  update: (id: string, data: Partial<Omit<Persona, "id" | "createdAt" | "updatedAt">>) =>
    request<Persona>(`/personas/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** 删除 */
  delete: (id: string) =>
    request<{ msg: string }>(`/personas/${id}`, {
      method: "DELETE",
    }),
};

// ==================== Style（风格）API ====================

export const styleApi = {
  /** 获取风格列表 */
  list: () => request<Style[]>("/styles"),

  /** 获取单个 */
  get: (id: string) => request<Style>(`/styles/${id}`),

  /** 创建 */
  create: (data: Omit<Style, "id" | "createdAt" | "updatedAt">) =>
    request<Style>("/styles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 更新 */
  update: (id: string, data: Partial<Omit<Style, "id" | "createdAt" | "updatedAt">>) =>
    request<Style>(`/styles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** 删除 */
  delete: (id: string) =>
    request<{ msg: string }>(`/styles/${id}`, {
      method: "DELETE",
    }),
};

// ==================== KnowledgeBase（知识库）API ====================

export const knowledgeApi = {
  /** 获取知识库列表 */
  list: () => request<KnowledgeBase[]>("/knowledge"),

  /** 获取单个 */
  get: (id: string) => request<KnowledgeBase>(`/knowledge/${id}`),

  /** 创建 */
  create: (data: Omit<KnowledgeBase, "id" | "createdAt" | "updatedAt">) =>
    request<KnowledgeBase>("/knowledge", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 更新 */
  update: (id: string, data: Partial<Omit<KnowledgeBase, "id" | "createdAt" | "updatedAt">>) =>
    request<KnowledgeBase>(`/knowledge/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** 删除 */
  delete: (id: string) =>
    request<{ msg: string }>(`/knowledge/${id}`, {
      method: "DELETE",
    }),
};

// ==================== WxTemplate（公众号模板）API ====================

export const templateApi = {
  /** 获取模板列表 */
  list: () => request<WxTemplate[]>("/templates"),

  /** 获取单个 */
  get: (id: string) => request<WxTemplate>(`/templates/${id}`),

  /** 创建 */
  create: (data: Omit<WxTemplate, "id" | "createdAt" | "updatedAt">) =>
    request<WxTemplate>("/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 更新 */
  update: (id: string, data: Partial<Omit<WxTemplate, "id" | "createdAt" | "updatedAt">>) =>
    request<WxTemplate>(`/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** 删除 */
  delete: (id: string) =>
    request<{ msg: string }>(`/templates/${id}`, {
      method: "DELETE",
    }),
};
