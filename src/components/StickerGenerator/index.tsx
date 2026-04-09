"use client";
import React, { useState, useRef, useCallback } from "react";
import { Download, Loader2, Check, AlertCircle } from "lucide-react";
import { TEMPLATE_LIST, DEFAULT_STICKER_DATA, ASPECT_RATIOS, type TemplateId, type AspectRatioId } from "./themes";
import { StickerTemplateRenderer, type StickerData } from "./StickerTemplate";

/**
 * 贴纸生成器主组件
 * 左侧：JSON 编辑器 + 模板选择
 * 右侧：实时预览面板
 */
export default function StickerGenerator() {
  const [templateId, setTemplateId] = useState<TemplateId>("quotes");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("1:1");
  const [stickerData, setStickerData] = useState<StickerData>(DEFAULT_STICKER_DATA);
  const [jsonText, setJsonText] = useState(JSON.stringify(DEFAULT_STICKER_DATA, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 解析 JSON
  const handleJsonChange = (value: string) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      setStickerData(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  // 应用 JSON 到贴纸数据
  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setStickerData(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  // 重置为默认数据
  const resetToDefault = () => {
    setJsonText(JSON.stringify(DEFAULT_STICKER_DATA, null, 2));
    setStickerData(DEFAULT_STICKER_DATA);
    setJsonError(null);
  };

  // 生成图片
  const handleGenerateImage = useCallback(async () => {
    if (!previewRef.current) return;

    setGenerating(true);
    setGenerated(false);

    try {
      // Dynamic import html-to-image
      const { toPng } = await import("html-to-image");

      // 获取预览容器的实际尺寸
      const originalElement = previewRef.current;
      const rect = originalElement.getBoundingClientRect();

      // 计算目标尺寸
      const scale = 2; // 2x 分辨率
      let width: number;
      let height: number;

      if (aspectRatio === "1:1") {
        width = 800;
        height = 800;
      } else {
        width = 600;
        height = 800;
      }

      // 添加时间戳避免缓存
      const timestamp = Date.now();
      const filename = `sticker-${templateId}-${timestamp}.png`;

      const dataUrl = await toPng(originalElement, {
        width,
        height,
        pixelRatio: scale,
        cacheBust: true,
        style: {
          transform: "none",
          transformOrigin: "top left",
        },
      });

      // 下载图片
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();

      setGenerated(true);
      setTimeout(() => setGenerated(false), 3000);
    } catch (err) {
      console.error("Failed to generate image:", err);
      alert("生成图片失败：" + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [aspectRatio, templateId]);

  // 计算预览容器样式
  const getPreviewContainerStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      width: "100%",
      aspectRatio: aspectRatio === "1:1" ? "1/1" : "3/4",
      maxHeight: "500px",
      overflow: "hidden",
      borderRadius: "12px",
    };
    return baseStyle;
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* 左侧：模板选择 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">模板：</span>
            <div className="flex gap-2">
              {TEMPLATE_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    templateId === t.id
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* 右侧：比例切换 + 操作按钮 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setAspectRatio(r.id)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    aspectRatio === r.id
                      ? "bg-white shadow-sm text-orange-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerateImage}
              disabled={generating || !!jsonError}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  生成中...
                </>
              ) : generated ? (
                <>
                  <Check size={16} />
                  已下载
                </>
              ) : (
                <>
                  <Download size={16} />
                  下载图片
                </>
              )}
            </button>
          </div>
        </div>

        {/* 模板说明 */}
        <div className="mt-2 text-xs text-gray-500">
          {TEMPLATE_LIST.find((t) => t.id === templateId)?.description}
        </div>
      </div>

      {/* 主体：编辑 + 预览 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：JSON 编辑器 */}
        <div className="w-[45%] border-r border-gray-200 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">JSON 数据</span>
              {jsonError && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  格式错误
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyJson}
                disabled={!!jsonError}
                className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 disabled:opacity-50"
              >
                应用
              </button>
              <button
                onClick={resetToDefault}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
              >
                重置
              </button>
            </div>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed bg-gray-50"
            placeholder="输入贴纸 JSON 数据..."
            spellCheck={false}
          />
          {jsonError && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
              <AlertCircle size={12} className="inline mr-1" />
              {jsonError}
            </div>
          )}
        </div>

        {/* 右侧：预览面板 */}
        <div className="w-[55%] flex flex-col bg-gray-100">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">实时预览</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
              {TEMPLATE_LIST.find((t) => t.id === templateId)?.name}
            </span>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
            <div
              className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300"
              style={getPreviewContainerStyle()}
            >
              <div
                ref={previewRef}
                className="w-full h-full"
              >
                <StickerTemplateRenderer
                  templateId={templateId}
                  data={stickerData}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JSON 结构说明 */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer font-medium">JSON 结构说明</summary>
          <pre className="mt-2 p-3 bg-gray-50 rounded-lg overflow-x-auto">
{`{
  "title": "主标题",
  "caption": "底部标语（可选）",
  "slides": [
    { "emoji": "😀", "text": "第一张内容" },
    { "emoji": "😀", "text": "第二张内容" },
    { "emoji": "😀", "text": "第三张内容" },
    { "emoji": "😀", "text": "第四张内容" }
  ]
}`}
          </pre>
        </details>
      </div>
    </div>
  );
}
