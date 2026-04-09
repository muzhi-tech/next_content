"use client";
import React, { useState, useEffect } from "react";
import { FileText, Search, Trash2, Edit3, Copy, Check, Loader2, ChevronDown, ChevronRight, Archive, Eye, Send, Folder } from "lucide-react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import type { ContentStatus } from "@/lib/types";

interface GeneratedContent {
  id: string;
  categoryId?: string;
  topic: string;
  content: string;
  style?: string;
  personaId?: string;
  status: ContentStatus;
  wikiContext?: string;
  titles?: string;
  coverPrompt?: string;
  sourceType: string;
  createdAt: number;
  updatedAt: number;
}

interface Category {
  id: string;
  name: string;
}

const STATUS_OPTIONS: { id: ContentStatus | "all"; name: string; color: string }[] = [
  { id: "all", name: "全部", color: "bg-gray-100 text-gray-600" },
  { id: "draft", name: "草稿", color: "bg-yellow-100 text-yellow-700" },
  { id: "reviewed", name: "已审核", color: "bg-blue-100 text-blue-700" },
  { id: "published", name: "已发布", color: "bg-green-100 text-green-700" },
  { id: "archived", name: "已归档", color: "bg-gray-200 text-gray-500" },
];

const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: "草稿",
  reviewed: "已审核",
  published: "已发布",
  archived: "已归档",
};

const NEXT_STATUS: Record<ContentStatus, ContentStatus | null> = {
  draft: "reviewed",
  reviewed: "published",
  published: "archived",
  archived: null,
};

export default function ContentHistoryTab() {
  const [items, setItems] = useState<GeneratedContent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 分类筛选
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const pageSize = 20;

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (categoryFilter) params.set("categoryId", categoryFilter);

      const res = await fetch(`/api/contents?${params}`);
      const data = await res.json();
      if (data.code === 0) {
        setItems(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to load contents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadItems();
  }, [page, statusFilter, categoryFilter]);

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.code === 0) setCategories(data.data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此内容？")) return;
    try {
      await fetch(`/api/contents/${id}`, { method: "DELETE" });
      loadItems();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleStatusChange = async (id: string, status: ContentStatus) => {
    try {
      await fetch(`/api/contents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      loadItems();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/contents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      setEditingId(null);
      loadItems();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const parseTitles = (titlesStr?: string): { title: string; summary: string }[] => {
    if (!titlesStr) return [];
    try { return JSON.parse(titlesStr); } catch { return []; }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-5xl p-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">内容历史</h3>
        <span className="text-sm text-gray-500">共 {total} 篇</span>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* 分类筛选 */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => { setStatusFilter(s.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s.id ? s.color + " ring-2 ring-offset-1 ring-gray-300" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s.name}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索主题..."
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-48"
          />
          <button onClick={handleSearch} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* 内容列表 */}
      {loading ? (
        <LoadingState message="加载内容..." />
      ) : items.length === 0 ? (
        <EmptyState icon={<FileText size={36} />} title="暂无内容" description="AI 生成的内容会自动保存在这里" />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const parsedTitles = parseTitles(item.titles);
            const nextStatus = NEXT_STATUS[item.status];
            const statusColor = STATUS_OPTIONS.find(s => s.id === item.status)?.color || "bg-gray-100";

            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                {/* 卡片头部 */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 truncate">{item.topic}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                        {item.sourceType === "pipeline" && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">管道</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {item.content.slice(0, 120)}...
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                        {item.style && <span>风格: {item.style}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4">
                    {/* 正文 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-bold text-gray-700">正文</h5>
                        <div className="flex gap-1">
                          {editingId === item.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={saving}
                                className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                              >
                                {saving ? "保存中..." : "保存"}
                              </button>
                              <button onClick={() => setEditingId(null)} className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded-lg text-xs">
                                取消
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setEditingId(item.id); setEditContent(item.content); }}
                              className="px-3 py-1 text-gray-500 hover:bg-gray-100 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Edit3 size={12} /> 编辑
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(item.id, item.content)}
                            className="px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg text-xs flex items-center gap-1"
                          >
                            {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === item.id ? "已复制" : "复制"}
                          </button>
                        </div>
                      </div>
                      {editingId === item.id ? (
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-64 p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
                        />
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {item.content}
                        </div>
                      )}
                    </div>

                    {/* 标题 */}
                    {parsedTitles.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-bold text-gray-700 mb-2">标题建议</h5>
                        <div className="space-y-2">
                          {parsedTitles.map((t, i) => (
                            <div key={i} className="p-2 bg-blue-50 rounded-lg">
                              <p className="text-sm font-medium text-gray-900">{t.title}</p>
                              <p className="text-xs text-gray-500">{t.summary}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 状态操作 */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(item.id, nextStatus)}
                          className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-1"
                        >
                          {nextStatus === "reviewed" && <><Eye size={14} /> 标记已审核</>}
                          {nextStatus === "published" && <><Send size={14} /> 标记已发布</>}
                          {nextStatus === "archived" && <><Archive size={14} /> 归档</>}
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
