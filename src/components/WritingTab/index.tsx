"use client";
import React, { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { Persona, Style, KnowledgeBase } from "@/lib/types";
import { personaApi, styleApi, knowledgeApi } from "@/lib/api";
import type { ApiConfig } from "../ApiConfigSelector";
import type { PipelineStepInfo } from "../PipelineProgressPanel";
import { useSSEStream } from "@/hooks/useSSEStream";
import AccountSpaceSelectors from "./AccountSpaceSelectors";
import ContentDisplay from "./ContentDisplay";
import PipelineRunner from "./PipelineRunner";

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

  // 内容生成状态
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
  const [wikiHits, setWikiHits] = useState<string[]>([]);

  // 折叠状态
  const [showPersona, setShowPersona] = useState(false);
  const [showStyle, setShowStyle] = useState(true);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showWikiPanel, setShowWikiPanel] = useState(false);

  // 管道状态
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStepInfo[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [pipelineId, setPipelineId] = useState("");
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineMatchedPages, setPipelineMatchedPages] = useState<string[]>([]);

  const [publishing, setPublishing] = useState(false);

  // 加载账号空间数据
  useEffect(() => {
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
    loadAccountSpace();
  }, []);

  // ==================== 内容生成 SSE ====================
  const { start: startGenerateSSE, abort: abortGenerateSSE } = useSSEStream({
    onEvent(evt) {
      // V2: Wiki 帧 - meta.matchedPages
      if (evt.raw.meta && (evt.raw.meta as Record<string, unknown>).matchedPages) {
        setWikiHits((evt.raw.meta as Record<string, unknown>).matchedPages as string[]);
      }
      // V2: Wiki 帧 - type=wiki
      if (evt.type === "wiki" && Array.isArray(evt.raw.pages)) {
        setWikiHits(evt.raw.pages as string[]);
      }
      // V2 格式: type === "content"
      if (evt.type === "content" && evt.content) {
        setGeneratedContent((prev) => prev + evt.content!);
      }
      // V1 兼容: 直接有 content 字段但没有 type
      else if (evt.content && !evt.type) {
        setGeneratedContent((prev) => prev + evt.content!);
      }
    },
    onDone() {
      setGenerating(false);
      // 自动保存为草稿
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
          return currentContent;
        });
      }, 100);
    },
    onError(err) {
      setGenerating(false);
      alert("生成失败：" + err.message);
    },
  });

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
      await startGenerateSSE("/api/content/generate", {
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
    } catch {
      // useSSEStream onError 已处理
    }
  };

  // ==================== 标题生成 ====================
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

  // ==================== 编辑/复制/发布 ====================
  const handleEditContent = () => {
    setEditedContent(generatedContent);
    setIsEditing(true);
  };

  const handleSaveContent = () => {
    setGeneratedContent(editedContent);
    setIsEditing(false);
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

  const handlePublish = async () => {
    if (!generatedContent) return;
    setPublishing(true);
    try {
      if (savedContentId) {
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

  const handleToggleKnowledge = (id: string) => {
    setSelectedKnowledgeIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

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
          {/* 创建文章面板 */}
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

              {/* 管道按钮 */}
              <PipelineRunner
                categoryId={categoryId}
                contentTopic={contentTopic}
                defaultConfig={defaultConfig}
                useWiki={useWiki}
                wikiMode={wikiMode}
                showPipeline={showPipeline}
                pipelineSteps={pipelineSteps}
                pipelineStatus={pipelineStatus}
                pipelineId={pipelineId}
                pipelineError={pipelineError}
                pipelineMatchedPages={pipelineMatchedPages}
                pipelineRunning={pipelineStatus === "running"}
                setShowPipeline={setShowPipeline}
                setPipelineSteps={setPipelineSteps}
                setPipelineStatus={setPipelineStatus}
                setPipelineId={setPipelineId}
                setPipelineError={setPipelineError}
                setPipelineMatchedPages={setPipelineMatchedPages}
                setGeneratedContent={setGeneratedContent}
                setWikiHits={setWikiHits}
                setGeneratedTitles={setGeneratedTitles}
              />
            </div>

            {/* 账号空间选择器 */}
            <AccountSpaceSelectors
              personas={personas}
              styles={styles}
              knowledgeBases={knowledgeBases}
              selectedPersonaId={selectedPersonaId}
              selectedStyleId={selectedStyleId}
              selectedKnowledgeIds={selectedKnowledgeIds}
              useWiki={useWiki}
              wikiMode={wikiMode}
              showPersona={showPersona}
              showStyle={showStyle}
              showKnowledge={showKnowledge}
              showWikiPanel={showWikiPanel}
              onSelectPersona={setSelectedPersonaId}
              onSelectStyle={setSelectedStyleId}
              onToggleKnowledge={handleToggleKnowledge}
              onSetUseWiki={setUseWiki}
              onSetWikiMode={setWikiMode}
              onToggleShowPersona={() => setShowPersona(!showPersona)}
              onToggleShowStyle={() => setShowStyle(!showStyle)}
              onToggleShowKnowledge={() => setShowKnowledge(!showKnowledge)}
              onToggleShowWikiPanel={() => setShowWikiPanel(!showWikiPanel)}
              selectedLength={selectedLength}
              onSelectLength={setSelectedLength}
            />

            {!defaultConfig && !configLoading && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                ⚠️ 请先在侧边栏「系统设置」中配置 AI API
              </div>
            )}
          </div>

          {/* 内容展示 */}
          <ContentDisplay
            generatedContent={generatedContent}
            editedContent={editedContent}
            isEditing={isEditing}
            copied={copied}
            generatedTitles={generatedTitles}
            wikiHits={wikiHits}
            publishing={publishing}
            savingContent={savingContent}
            savedContentId={savedContentId}
            onEditContent={handleEditContent}
            onSaveContent={handleSaveContent}
            onCopyContent={handleCopyContent}
            onPublish={handlePublish}
            onGenerateTitles={handleGenerateTitles}
            setEditedContent={setEditedContent}
          />
        </div>
      </div>
    </div>
  );
}
