"use client";
import React, { useState, useEffect } from "react";
import { ImageIcon, Loader2, Copy, Check, Sparkles } from "lucide-react";
import type { ApiConfig } from "./ApiConfigSelector";

const IMAGE_STYLES = [
  { id: "tech", name: "科技感", icon: "💻", description: "未来科技风格" },
  { id: "business", name: "商务风", icon: "📈", description: "专业商务风格" },
  { id: "lifestyle", name: "生活感", icon: "🌿", description: "温馨生活风格" },
  { id: "minimal", name: "简约风", icon: "⬜", description: "极简主义风格" },
];

const ASPECT_RATIOS = [
  { id: "16:9", name: "横版 16:9", icon: "🖥️" },
  { id: "9:16", name: "竖版 9:16", icon: "📱" },
  { id: "1:1", name: "方形 1:1", icon: "⬜" },
];

interface Props {
  categoryId: string;
}

export default function ImageTab({ categoryId }: Props) {
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
  const [selectedStyle, setSelectedStyle] = useState("tech");
  const [selectedAspect, setSelectedAspect] = useState("16:9");
  const [generating, setGenerating] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState<{ prompt: string; negativePrompt: string } | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);

  const handleGenerateImage = async () => {
    if (!contentTopic.trim()) {
      alert("请输入内容主题");
      return;
    }
    if (!defaultConfig) {
      alert("请先在「系统设置」中配置 API");
      return;
    }

    setGenerating(true);
    setCoverPrompt(null);

    try {
      const res = await fetch("/api/content/cover/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: contentTopic,
          style: selectedStyle,
          aspectRatio: selectedAspect,
          apiUrl: defaultConfig.apiUrl,
          apiKey: defaultConfig.apiKey,
          modelName: defaultConfig.modelName,
        }),
      });
      const data = await res.json();
      if (data.code === 0) {
        setCoverPrompt(data.data);
      } else {
        alert("生成封面提示词失败：" + data.msg);
      }
    } catch (err) {
      console.error("Image generation error:", err);
      alert("生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPrompt = async (text: string, type: "prompt" | "negative") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "prompt") {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      } else {
        setCopiedNegative(true);
        setTimeout(() => setCopiedNegative(false), 2000);
      }
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6 mb-6">
              <h3 className="text-lg font-bold text-amber-800 mb-4">🖼️ 创建封面</h3>
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={contentTopic}
                  onChange={(e) => setContentTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateImage()}
                  placeholder="输入内容主题，如：2025年 AI 编程趋势分析"
                  className="flex-1 px-4 py-3 border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <button
                  onClick={handleGenerateImage}
                  disabled={generating || !defaultConfig}
                  className="px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {generating ? "生成中..." : "生成"}
                </button>
              </div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <label className="text-sm text-amber-700 mb-2 block">图片风格</label>
                  <div className="flex gap-2">
                    {IMAGE_STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStyle(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedStyle === s.id
                            ? "bg-amber-600 text-white"
                            : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                        }`}
                      >
                        {s.icon} {s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-amber-700 mb-2 block">图片比例</label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedAspect(r.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedAspect === r.id
                            ? "bg-amber-600 text-white"
                            : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                        }`}
                      >
                        {r.icon} {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {!defaultConfig && !configLoading && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  ⚠️ 请先在侧边栏「系统设置」中配置 AI API
                </div>
              )}
            </div>

            {coverPrompt && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📝 封面提示词</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-500 font-medium">正向提示词</label>
                      <button
                        onClick={() => handleCopyPrompt(coverPrompt.prompt, "prompt")}
                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
                        {copiedPrompt ? "已复制" : "复制"}
                      </button>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-gray-700 whitespace-pre-wrap">
                      {coverPrompt.prompt}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-500 font-medium">负向提示词</label>
                      <button
                        onClick={() => handleCopyPrompt(coverPrompt.negativePrompt, "negative")}
                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        {copiedNegative ? <Check size={14} /> : <Copy size={14} />}
                        {copiedNegative ? "已复制" : "复制"}
                      </button>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-gray-700 whitespace-pre-wrap">
                      {coverPrompt.negativePrompt}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  💡 提示：将上述提示词复制到 Midjourney、DALL-E、Stable Diffusion 等 AI 画图工具中使用
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
