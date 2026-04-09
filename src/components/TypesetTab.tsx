"use client";
import React, { useState, useMemo, useCallback } from "react";
import { Copy, Check, Monitor, Smartphone, FileText } from "lucide-react";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

// Create marked instance with highlight.js support
const markedInstance = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch {
          // Fall through
        }
      }
      try {
        return hljs.highlightAuto(code).value;
      } catch {
        return code;
      }
    },
  })
);
markedInstance.setOptions({ breaks: true, gfm: true });

type ViewMode = "pc" | "mobile";
type ThemeId = "default" | "minimalist" | "business";

// Theme definitions with inline CSS
const THEMES: Record<ThemeId, { name: string; css: string; fontFamily: string; primaryColor: string }> = {
  default: {
    name: "默认",
    primaryColor: "#1a1a1a",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    css: `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
        font-size: 16px;
        line-height: 1.8;
        color: #1a1a1a;
        padding: 20px;
      }
      h1, h2, h3, h4, h5, h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: bold;
        line-height: 1.4;
      }
      h1 { font-size: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; }
      h2 { font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
      h3 { font-size: 18px; }
      p { margin: 12px 0; }
      img { max-width: 100%; height: auto; display: block; margin: 16px auto; }
      blockquote {
        margin: 16px 0;
        padding: 12px 20px;
        background: #f8f8f8;
        border-left: 4px solid #ddd;
        color: #666;
      }
      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 14px;
      }
      pre {
        background: #f8f8f8;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 16px 0;
      }
      pre code {
        background: none;
        padding: 0;
      }
      ul, ol { margin: 12px 0; padding-left: 24px; }
      li { margin: 4px 0; }
      a { color: #576b95; text-decoration: none; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
      th { background: #f8f8f8; font-weight: bold; }
      hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    `,
  },
  minimalist: {
    name: "极简",
    primaryColor: "#333333",
    fontFamily: "'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    css: `
      body {
        font-family: 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 15px;
        line-height: 2;
        color: #333;
        padding: 16px;
      }
      h1, h2, h3, h4, h5, h6 {
        margin-top: 20px;
        margin-bottom: 12px;
        font-weight: 500;
        line-height: 1.5;
      }
      h1 { font-size: 22px; }
      h2 { font-size: 18px; }
      h3 { font-size: 16px; }
      p { margin: 10px 0; }
      img { max-width: 100%; height: auto; display: block; margin: 12px auto; }
      blockquote {
        margin: 12px 0;
        padding: 8px 16px;
        background: #fafafa;
        border-left: 2px solid #ccc;
        color: #888;
        font-style: italic;
      }
      code {
        background: #f5f5f5;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 13px;
      }
      pre {
        background: #fafafa;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        margin: 12px 0;
      }
      pre code { background: none; padding: 0; }
      ul, ol { margin: 10px 0; padding-left: 20px; }
      li { margin: 3px 0; }
      a { color: #666; text-decoration: underline; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { border: 1px solid #eee; padding: 8px; }
      th { background: #fafafa; }
      hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    `,
  },
  business: {
    name: "商务",
    primaryColor: "#1e3a5f",
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
    css: `
      body {
        font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
        font-size: 14px;
        line-height: 1.8;
        color: #2c2c2c;
        padding: 24px;
        background: #fff;
      }
      h1, h2, h3, h4, h5, h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.4;
        color: #1e3a5f;
      }
      h1 { font-size: 22px; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; }
      h2 { font-size: 18px; border-bottom: 1px solid #d0d7de; padding-bottom: 6px; }
      h3 { font-size: 16px; }
      p { margin: 14px 0; text-align: justify; }
      img { max-width: 100%; height: auto; display: block; margin: 16px auto; }
      blockquote {
        margin: 16px 0;
        padding: 12px 20px;
        background: #f0f4f8;
        border-left: 4px solid #1e3a5f;
        color: #4a5568;
      }
      code {
        background: #f0f4f8;
        color: #1e3a5f;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 13px;
      }
      pre {
        background: #f6f8fa;
        border: 1px solid #d0d7de;
        border-radius: 6px;
        padding: 16px;
        overflow-x: auto;
        margin: 16px 0;
      }
      pre code { background: none; padding: 0; }
      ul, ol { margin: 14px 0; padding-left: 24px; }
      li { margin: 6px 0; }
      a { color: #1e3a5f; text-decoration: none; border-bottom: 1px solid #1e3a5f; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      th, td { border: 1px solid #d0d7de; padding: 10px 14px; text-align: left; }
      th { background: #f6f8fa; font-weight: 600; }
      hr { border: none; border-top: 1px solid #d0d7de; margin: 24px 0; }
    `,
  },
};

// Default markdown content
const DEFAULT_MARKDOWN = `# 公众号文章标题

这是一段示例文字，用于展示不同主题的排版效果。

## 二级标题

支持 **加粗**、*斜体*和\`行内代码\`等多种格式。

### 列表

- 第一个列表项
- 第二个列表项
- 第三个列表项

### 代码块

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### 引用

> 这是一段引用文字，可以用来引用他人的观点或重要内容。

### 图片

![示例图片](https://via.placeholder.com/400x200)

## 总结

以上就是公众号排版的基本示例，支持多种 Markdown 语法。
`;

export default function TypesetTab() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [theme, setTheme] = useState<ThemeId>("default");
  const [viewMode, setViewMode] = useState<ViewMode>("pc");
  const [copied, setCopied] = useState(false);

  // Parse markdown to HTML
  const htmlContent = useMemo(() => {
    try {
      return markedInstance.parse(markdown) as string;
    } catch {
      return "<p>解析错误</p>";
    }
  }, [markdown]);

  // Generate styled HTML for clipboard (inline CSS)
  const generateRichHtml = useCallback(() => {
    const themeData = THEMES[theme];
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${themeData.css}
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  }, [htmlContent, theme]);

  // Copy to clipboard as rich text
  const handleCopyRichText = async () => {
    try {
      const richHtml = generateRichHtml();
      const plainText = markdown;

      await navigator.clipboard.write([
        new ClipboardItem({
          ["text/html"]: new Blob([richHtml], { type: "text/html" }),
          ["text/plain"]: new Blob([plainText], { type: "text/plain" }),
        }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      // Fallback: copy plain text
      try {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("复制失败，请手动复制");
      }
    }
  };

  const themeData = THEMES[theme];

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左侧：主题切换 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">主题：</span>
            <div className="flex gap-2">
              {(Object.keys(THEMES) as ThemeId[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    theme === t
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {THEMES[t].name}
                </button>
              ))}
            </div>
          </div>

          {/* 右侧：视图切换 */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("pc")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "pc" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
              title="PC 视图"
            >
              <Monitor size={18} />
            </button>
            <button
              onClick={() => setViewMode("mobile")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "mobile" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
              title="移动端视图"
            >
              <Smartphone size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 主体：编辑 + 预览 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：Markdown 编辑器 */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Markdown 编辑器</span>
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed bg-gray-50"
            placeholder="在此输入 Markdown 内容..."
            spellCheck={false}
          />
        </div>

        {/* 右侧：预览面板 */}
        <div className="w-1/2 flex flex-col bg-gray-100">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">预览</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: themeData.primaryColor + "15", color: themeData.primaryColor }}
            >
              {themeData.name} 主题
            </span>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div
              className={`mx-auto bg-white shadow-lg overflow-hidden ${
                viewMode === "mobile" ? "max-w-[375px] rounded-xl" : "max-w-3xl rounded-lg"
              }`}
            >
              <style>{themeData.css}</style>
              <style>{`
                .preview-body img { max-width: 100%; height: auto; display: block; margin: 16px auto; }
                .preview-body code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
                .preview-body pre { background: #f8f8f8; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
                .preview-body pre code { background: none; padding: 0; }
                .preview-body table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                .preview-body th, .preview-body td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                .preview-body blockquote { margin: 16px 0; padding: 12px 20px; background: #f8f8f8; border-left: 4px solid #ddd; }
              `}</style>
              <div
                className="preview-body"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                style={{ fontFamily: themeData.fontFamily }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 底部：复制按钮 */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            支持复制到微信公众号编辑器，保持原有格式
          </div>
          <button
            onClick={handleCopyRichText}
            className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
              copied
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            }`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "已复制到剪贴板" : "复制富文本到公众号"}
          </button>
        </div>
      </div>
    </div>
  );
}
