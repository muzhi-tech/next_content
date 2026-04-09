"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Loader2, Copy, Check, Save, ChevronDown, ChevronRight, User, Palette, BookOpen, Zap, Play, Edit3, Send } from "lucide-react";
import { Persona, Style, KnowledgeBase } from "@/lib/types";
import { personaApi, styleApi, knowledgeApi } from "@/lib/api";
import type { ApiConfig } from "./ApiConfigSelector";
import PipelineProgressPanel, { PipelineStepInfo } from "./PipelineProgressPanel";

const LENGTH_OPTIONS = [
  { id: "short", name: "短文", icon: "📝" },
  { id: "medium", name: "中等", icon: "📄" },
  { id: "long", name: "长文", icon: "📚" },
];

interface Props {
  categoryId: string;
}

export default function WritingTab({ categoryId }: Props) {
  const [defaultConfig, setDefaultConfig] = useState<ApiConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // 从后端加载默认 API 配置
  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        if (data.code === 0 && data.data?.defaultConfig) {
          setDefaultConfig(data.data.defaultConfig);
        }
      } catch (err) {
        console.error("Failed to load API config:", err);
      } finally {
        setConfigLoading(false);
      }
    };
    loadConfig();
  }, []);

  const [contentTopic, setContentTopic] = useState("");
  const [selectedLength, setSelectedLength] = useState<"short" | "medium" | "long">("medium");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedTitles, setGeneratedTitles] = useState<{ title: string; summary: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedContentId, setSavedContentId] = useState<string | null>(null);
  const [savingContent, setSavingContent] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 账号空间数据
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedStyleId, setSelectedStyleId] = useState<string>("");
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);

  // Wiki 增强
  const [useWiki, setUseWiki] = useState(false);
  const [wikiMode, setWikiMode] = useState<"index-only" | "full-context">("index-only");
  const [showWikiPanel, setShowWikiPanel] = useState(false);
  const [wikiHits, setWikiHits] = useState<string[]>([]);

  // 折叠状态：风格默认展开，人设和知识库默认折叠
  const [showPersona, setShowPersona] = useState(false);
  const [showStyle, setShowStyle] = useState(true);
  const [showKnowledge, setShowKnowledge] = useState(false);

  // 管道状态
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStepInfo[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [pipelineId, setPipelineId] = useState("");
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineMatchedPages, setPipelineMatchedPages] = useState<string[]>([]);
  const [showPipeline, setShowPipeline] = useState(false);
  const pipelineAbortRef = useRef<AbortController | null>(null);

  const loadAccountSpace = async () => {
    try {
      const [p, s, k] = await Promise.all([
        personaApi.list(),
        styleApi.list(),
        knowledgeApi.list(),
      ]);
      setPersonas(p);
      setStyles(s);
      setKnowledgeBases(k);
    } catch (err) {
      console.error("Failed to load account space data:", err);
    }
  };

  useEffect(() => {
    loadAccountSpace();
  }, []);

  const handleToggleKnowledge = (id: string) => {
    setSelectedKnowledgeIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!generatedContent) return;
    setPublishing(true);
    try {
      if (savedContentId) {
        // 更新已有内容：同步最新内容 + 状态改为 published
        await fetch(`/api/contents/${savedContentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: contentTopic,
            content: generatedContent,
            style: selectedStyleId || selectedLength,
            personaId: selectedPersonaId || undefined,
            wikiContext: wikiHits.length > 0 ? wikiHits.join("\n") : undefined,
            titles: generatedTitles.length > 0 ? JSON.stringify(generatedTitles) : undefined,
            status: "published",
          }),
        });
        showToast("success", "已标记为发布状态");
      } else {
        // 先保存再标记发布
        const res = await fetch("/api/contents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: contentTopic,
            content: generatedContent,
            categoryId,
            style: selectedStyleId || selectedLength,
            personaId: selectedPersonaId || undefined,
            status: "published",
            sourceType: "manual",
            wikiContext: wikiHits.length > 0 ? wikiHits.join("\n") : undefined,
            titles: generatedTitles.length > 0 ? JSON.stringify(generatedTitles) : undefined,
            coverPrompt: undefined,
          }),
        });
        const data = await res.json();
        if (data.code === 0) {
          setSavedContentId(data.data.id);
          showToast("success", "已保存并标记为发布状态");
        }
      }
    } catch (error) {
      showToast("error", "操作失败：" + (error instanceof Error ? error.message : String(error)));
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!contentTopic.trim()) {
      alert("请输入内容主题");
      return;
    }
    if (!defaultConfig) {
      alert("请先在「系统设置」中配置 API");
      return;
    }

    setGenerating(true);
    setGeneratedContent("");
    setGeneratedTitles([]);
    setWikiHits([]);
    setSavedContentId(null);

    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: contentTopic,
          style: selectedStyleId,
          length: selectedLength,
          personaId: selectedPersonaId || undefined,
          styleId: selectedStyleId || undefined,
          knowledgeIds: selectedKnowledgeIds.length > 0 ? selectedKnowledgeIds : undefined,
          categoryId,
          useWiki: useWiki || undefined,
          wikiMode: useWiki ? wikiMode : undefined,
          apiUrl: defaultConfig.apiUrl,
          apiKey: defaultConfig.apiKey,
          modelName: defaultConfig.modelName,
        }),
      });

      if (!response.ok) throw new Error("生成失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);

              // V2: Wiki 帧 - meta.matchedPages
              if (parsed.meta && parsed.meta.matchedPages) {
                setWikiHits(parsed.meta.matchedPages);
              }
              // V2: Wiki 帧 - type=wiki
              if (parsed.type === "wiki" && Array.isArray(parsed.pages)) {
                setWikiHits(parsed.pages);
              }
              // V2 格式: type === "content"
              if (parsed.type === "content" && parsed.content) {
                setGeneratedContent((prev) => prev + parsed.content);
              }
              // V1 兼容: 直接有 content 字段但没有 type
              else if (parsed.content && !parsed.type) {
                setGeneratedContent((prev) => prev + parsed.content);
              }
              // V2 完成信号
              if (parsed.type === "done") {
                break;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error) throw e;
            }
          }
        }
      }
    } catch (err) {
      console.error("Generation error:", err);
      alert("生成失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setGenerating(false);
      // 自动保存为草稿（流结束后）
      // Use a small delay to let state settle with final content
      setTimeout(() => {
        setGeneratedContent((currentContent) => {
          if (currentContent.trim()) {
            setSavingContent(true);
            fetch("/api/contents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                topic: contentTopic,
                content: currentContent,
                categoryId,
                style: selectedStyleId || selectedLength,
                personaId: selectedPersonaId || undefined,
                status: "draft",
                sourceType: "manual",
                wikiContext: wikiHits.length > 0 ? wikiHits.join("\n") : undefined,
                titles: generatedTitles.length > 0 ? JSON.stringify(generatedTitles) : undefined,
                coverPrompt: undefined,
              }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.code === 0) {
                  setSavedContentId(data.data.id);
                  showToast("success", "已保存为草稿");
                }
              })
              .catch(() => {})
              .finally(() => setSavingContent(false));
          }
          return currentContent; // don't modify content, just read it
        });
      }, 100);
    }
  };

  const handleGenerateTitles = async () => {
    if (!generatedContent.trim() || !defaultConfig) {
      alert("先生成文章正文");
      return;
    }
    try {
      const res = await fetch("/api/content/titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: generatedContent,
          apiUrl: defaultConfig.apiUrl,
          apiKey: defaultConfig.apiKey,
          modelName: defaultConfig.modelName,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        const titles = data.data?.titles || data.data;
        setGeneratedTitles(Array.isArray(titles) ? titles : []);
      } else {
        alert("生成标题失败：" + data.msg);
      }
    } catch (err) {
      console.error("Titles generation error:", err);
      alert("生成标题失败");
    }
  };

  const handleEditContent = () => {
    setEditedContent(generatedContent);
    setIsEditing(true);
  };

  const handleSaveContent = () => {
    setGeneratedContent(editedContent);
    setIsEditing(false);
    // 新编辑内容后，同步到草稿（如果已有 savedContentId）
    if (savedContentId && editedContent.trim()) {
      fetch(`/api/contents/${savedContentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent }),
      }).catch(() => {});
    }
  };

  const handleCopyContent = async () => {
    const textToCopy = isEditing ? editedContent : generatedContent;
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const PIPELINE_STEP_ORDER = ["collect", "topic", "write", "score", "humanize", "review", "illustrate", "publish"];

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

    const abortController = new AbortController();
    pipelineAbortRef.current = abortController;

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
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

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.msg || errData?.error || `HTTP ${res.status}`);
      }

      const pipelineIdHeader = res.headers.get("x-pipeline-id") || "";
      if (pipelineIdHeader) setPipelineId(pipelineIdHeader);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

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
          if (payload === "[DONE]") continue;

          try {
            const evt = JSON.parse(payload);

            // pipeline_id event
            if (evt.pipelineId) setPipelineId(evt.pipelineId);

            // step_started
            if (evt.type === "step_started" && evt.step) {
              const now = new Date().toISOString();
              setPipelineSteps((prev) =>
                prev.map((s) => (s.step === evt.step ? { ...s, status: "running" as const, startedAt: now } : s))
              );
            }

            // step_completed
            if (evt.type === "step_completed" && evt.step) {
              const now = new Date().toISOString();
              setPipelineSteps((prev) =>
                prev.map((s) =>
                  s.step === evt.step
                    ? {
                        ...s,
                        status: "completed" as const,
                        completedAt: now,
                        score: evt.score,
                        feedback: evt.feedback,
                      }
                    : s
                )
              );
              // If write step produced content, show it
              if (evt.step === "write" && evt.output) {
                setGeneratedContent(evt.output);
              }
            }

            // step_failed
            if (evt.type === "step_failed" && evt.step) {
              setPipelineSteps((prev) =>
                prev.map((s) =>
                  s.step === evt.step
                    ? { ...s, status: "failed" as const, feedback: evt.error || evt.feedback || "步骤失败" }
                    : s
                )
              );
            }

            // wiki_context
            if (evt.type === "wiki_context" && Array.isArray(evt.pages)) {
              setPipelineMatchedPages(evt.pages);
              setWikiHits(evt.pages);
            }

            // pipeline_completed
            if (evt.type === "pipeline_completed") {
              setPipelineStatus("completed");
              if (evt.output) setGeneratedContent(evt.output);
            }

            // pipeline_failed
            if (evt.type === "pipeline_failed") {
              setPipelineStatus("failed");
              setPipelineError(evt.error || "管道执行失败");
            }

            // Generic error field
            if (evt.error && !evt.type) {
              throw new Error(evt.error);
            }
          } catch (e) {
            if (e instanceof Error) throw e;
            // Ignore JSON parse errors for partial data
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Pipeline error:", err);
      setPipelineStatus("failed");
      setPipelineError((err instanceof Error ? err.message : "未知错误"));
    } finally {
      pipelineAbortRef.current = null;
    }
  }, [contentTopic, defaultConfig, categoryId, useWiki, wikiMode]);

  const handleCancelPipeline = useCallback(() => {
    pipelineAbortRef.current?.abort();
    setPipelineStatus("failed");
    setPipelineError("已取消");
  }, []);

  const handleRetryPipeline = useCallback(() => {
    startPipeline();
  }, [startPipeline]);

  return (
    <div className="h-full flex flex-col">
      {/* Toast 通知 */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right ${
          toastMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {toastMsg.text}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6 mb-6">
              <h3 className="text-lg font-bold text-purple-800 mb-4">📝 创建文章</h3>
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={contentTopic}
                  onChange={(e) => setContentTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateContent()}
                  placeholder="输入内容主题，如：2025年 AI 编程趋势分析"
                  className="flex-1 px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleGenerateContent}
                  disabled={generating || !defaultConfig}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {generating ? "生成中..." : "生成"}
                </button>
                {savingContent && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Loader2 size={14} className="animate-spin" /> 保存中...
                  </span>
                )}
                {savedContentId && !savingContent && !generating && (
                  <span className="text-sm text-green-600">已保存为草稿</span>
                )}
                <button
                  onClick={startPipeline}
                  disabled={pipelineStatus === "running" || !defaultConfig}
                  className="px-5 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2"
                  title="启动完整管道：采集→选题→写作→评分→去AI化→审核→配图→发布"
                >
                  {pipelineStatus === "running" ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  管道
                </button>
              </div>

              {/* 人设选择器 - 可折叠 */}
              <div className="mb-3">
                <button
                  onClick={() => setShowPersona(!showPersona)}
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 mb-2"
                >
                  {showPersona ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <User size={14} />
                  人设选择
                  {selectedPersonaId && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      已选
                    </span>
                  )}
                </button>
                {showPersona && (
                  <div className="ml-6">
                    {personas.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">请先在「账号空间」中创建人设</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedPersonaId("")}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedPersonaId === ""
                              ? "bg-purple-600 text-white"
                              : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                          }`}
                        >
                          不使用人设
                        </button>
                        {personas.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPersonaId(p.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              selectedPersonaId === p.id
                                ? "bg-purple-600 text-white"
                                : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                            }`}
                            title={p.description}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 写作风格 - 默认展开，从 API 加载 */}
              <div className="mb-3">
                <button
                  onClick={() => setShowStyle(!showStyle)}
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 mb-2"
                >
                  {showStyle ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Palette size={14} />
                  写作风格
                  {selectedStyleId && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      已选
                    </span>
                  )}
                </button>
                {showStyle && (
                  <div className="ml-6">
                    {styles.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">请先在「账号空间」中创建写作风格</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedStyleId("")}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedStyleId === ""
                              ? "bg-purple-600 text-white"
                              : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                          }`}
                        >
                          默认风格
                        </button>
                        {styles.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedStyleId(s.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              selectedStyleId === s.id
                                ? "bg-purple-600 text-white"
                                : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                            }`}
                          >
                            {s.icon} {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 知识库多选 - 可折叠 */}
              <div className="mb-3">
                <button
                  onClick={() => setShowKnowledge(!showKnowledge)}
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 mb-2"
                >
                  {showKnowledge ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <BookOpen size={14} />
                  知识库
                  {selectedKnowledgeIds.length > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                      已选 {selectedKnowledgeIds.length}
                    </span>
                  )}
                </button>
                {showKnowledge && (
                  <div className="ml-6">
                    {knowledgeBases.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">请先在「账号空间」中创建知识库</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {knowledgeBases.map((k) => (
                          <label
                            key={k.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                              selectedKnowledgeIds.includes(k.id)
                                ? "bg-purple-600 text-white"
                                : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedKnowledgeIds.includes(k.id)}
                              onChange={() => handleToggleKnowledge(k.id)}
                              className="sr-only"
                            />
                            {k.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wiki 知识增强 - 可折叠 */}
              <div className="mb-3">
                <button
                  onClick={() => setShowWikiPanel(!showWikiPanel)}
                  className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 mb-2"
                >
                  {showWikiPanel ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Zap size={14} />
                  Wiki 知识增强
                  {useWiki && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">已启用</span>
                  )}
                </button>
                {showWikiPanel && (
                  <div className="ml-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useWiki}
                          onChange={(e) => setUseWiki(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                      <span className="text-sm text-purple-700">启用 Wiki 上下文</span>
                    </div>
                    {useWiki && (
                      <div>
                        <label className="text-xs text-purple-600 mb-1.5 block">检索模式</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setWikiMode("index-only")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              wikiMode === "index-only"
                                ? "bg-blue-600 text-white"
                                : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                            }`}
                          >
                            仅索引
                          </button>
                          <button
                            onClick={() => setWikiMode("full-context")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              wikiMode === "full-context"
                                ? "bg-blue-600 text-white"
                                : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                            }`}
                          >
                            完整上下文
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      开启后，AI 写作时会自动检索知识库中的相关实体和主题，增强内容深度
                    </p>
                  </div>
                )}
              </div>

              {/* 文章长度 */}
              <div>
                <label className="text-sm text-purple-700 mb-2 block">文章长度</label>
                <div className="flex gap-2">
                  {LENGTH_OPTIONS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedLength(l.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedLength === l.id
                          ? "bg-purple-600 text-white"
                          : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-50"
                      }`}
                    >
                      {l.icon} {l.name}
                    </button>
                  ))}
                </div>
              </div>

              {!defaultConfig && !configLoading && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  ⚠️ 请先在侧边栏「系统设置」中配置 AI API
                </div>
              )}
            </div>

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

            {generatedContent && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">📄 生成的正文</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                      {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {publishing ? "发布中..." : "发布到公众号"}
                    </button>
                    {isEditing ? (
                      <button
                        onClick={handleSaveContent}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Save size={14} /> 保存
                      </button>
                    ) : (
                      <button
                        onClick={handleEditContent}
                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Edit3 size={14} /> 编辑
                      </button>
                    )}
                    <button
                      onClick={handleCopyContent}
                      className="px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium flex items-center gap-1"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "已复制" : "复制"}
                    </button>
                  </div>
                </div>
                {isEditing ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                  />
                ) : (
                  <div className="prose prose-purple max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{generatedContent}</p>
                  </div>
                )}
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleGenerateTitles}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    生成标题摘要
                  </button>
                </div>
              </div>
            )}

            {wikiHits.length > 0 && (
              <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    检索到 {wikiHits.length} 个知识页面
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {wikiHits.map((page, i) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                      {page}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {generatedTitles.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📌 标题与摘要</h3>
                <div className="space-y-4">
                  {generatedTitles.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-600">{item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
