"use client";
import React, { useState } from "react";
import { Sparkles, Loader2, Save, Edit3, Copy, Check } from "lucide-react";
import { useSSEStream } from "@/hooks/useSSEStream";

// 风格列表（与原 SettingsTab 一致）
const STYLES: Array<{ id: string; name: string; description: string }> = [
  { id: "tech", name: "科技媒体评论", description: "犀利的科技媒体视角" },
  { id: "business", name: "商业财经", description: "专业的商业分析" },
  { id: "lifestyle", name: "生活美学", description: "温暖的生活方式" },
  { id: "news", name: "新闻资讯", description: "客观的热点报道" },
];

export default function ContentGeneratorSection() {
  const [contentTopic, setContentTopic] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("tech");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [showContentSection, setShowContentSection] = useState(false);

  const { start: startGenerateSSE } = useSSEStream({
    onEvent(evt) {
      // V2 格式: type === "content"
      if (evt.type === "content" && evt.content) {
        setGeneratedContent((prev) => prev + evt.content!);
      }
      // V1 兼容
      else if (evt.content && !evt.type) {
        setGeneratedContent((prev) => prev + evt.content!);
      }
    },
    onDone() {
      setGenerating(false);
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

    const style = STYLES.find((s) => s.id === selectedStyle);
    if (!style) {
      alert("请选择写作风格");
      return;
    }

    setGenerating(true);
    setGeneratedContent("");

    try {
      await startGenerateSSE("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: contentTopic,
          style: selectedStyle,
        }),
      });
    } catch {
      // useSSEStream onError 已处理
    }
  };

  const handleEditContent = () => {
    setEditedContent(generatedContent);
    setIsEditing(true);
  };

  const handleSaveContent = () => {
    setGeneratedContent(editedContent);
    setIsEditing(false);
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

  return (
    <section className="mt-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-purple-700 flex items-center gap-2">
          <Sparkles size={16} /> AI 内容生产
        </h4>
        <button
          onClick={() => setShowContentSection(!showContentSection)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          {showContentSection ? "收起" : "展开"}
        </button>
      </div>

      {showContentSection && (
        <div>
          {/* 主题输入和生成 */}
          <div className="mb-4">
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={contentTopic}
                onChange={(e) => setContentTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateContent()}
                placeholder="输入内容主题，如：2025年 AI 编程趋势分析"
                className="flex-1 px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleGenerateContent}
                disabled={generating || !contentTopic.trim()}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {generating ? "生成中..." : "生成"}
              </button>
            </div>

            {/* 风格选择下拉 */}
            <div className="mb-3">
              <label className="text-sm text-purple-700 mb-1 block">选择写作风格</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                {STYLES.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name} - {style.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 生成的正文预览 */}
          {generatedContent && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-bold text-gray-900">生成的正文</h5>
                <div className="flex gap-2">
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
                  className="w-full h-48 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                />
              ) : (
                <div className="prose prose-purple max-w-none">
                  <p className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm">
                    {generatedContent}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
