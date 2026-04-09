"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, Loader2, List, ScrollText, ChevronRight, Upload } from "lucide-react";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

interface WikiEntry {
  title: string;
  content: string;
}

export default function WikiTab({ categoryId }: { categoryId: string }) {
  const [indexMd, setIndexMd] = useState<string>("");
  const [logMd, setLogMd] = useState<string>("");
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<WikiEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("categoryId", categoryId);

      const res = await fetch("/api/wiki/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.code === 0) {
        alert("上传并提取到 Wiki 成功！");
        await loadWiki();
      } else {
        alert(data.msg || "上传失败");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("上传失败，请检查网络或配置");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const loadWiki = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wiki/${categoryId}`);
      const data = await res.json();
      if (data.code === 0 && data.data) {
        const { index, log } = data.data;
        setIndexMd(index || "");
        setLogMd(log || "");

        // Parse index markdown into entries by headings
        if (index) {
          const parsed = parseMarkdownEntries(index);
          setEntries(parsed);
          if (parsed.length > 0) {
            setActiveEntry(parsed[0]);
          }
        } else {
          setEntries([]);
          setActiveEntry(null);
        }
      } else {
        setIndexMd("");
        setLogMd("");
        setEntries([]);
        setActiveEntry(null);
      }
    } catch (err) {
      console.error("Failed to load wiki:", err);
      setError("加载知识库失败");
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadWiki();
  }, [loadWiki]);

  // Parse markdown by ## headings into separate entries
  const parseMarkdownEntries = (md: string): WikiEntry[] => {
    const lines = md.split("\n");
    const result: WikiEntry[] = [];
    let currentTitle = "";
    let currentLines: string[] = [];

    for (const line of lines) {
      const h2Match = line.match(/^##\s+(.+)/);
      const h1Match = line.match(/^#\s+(.+)/);
      if (h2Match) {
        if (currentTitle) {
          result.push({ title: currentTitle, content: currentLines.join("\n").trim() });
        }
        currentTitle = h2Match[1].trim();
        currentLines = [];
      } else if (h1Match && !currentTitle) {
        // Use h1 as the first entry if no h2 yet
        currentTitle = h1Match[1].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentTitle) {
      result.push({ title: currentTitle, content: currentLines.join("\n").trim() });
    }

    // If no headings found, treat entire content as one entry
    if (result.length === 0 && md.trim()) {
      result.push({ title: "知识库内容", content: md.trim() });
    }

    return result;
  };

  // Split a line into safe React elements, handling bold, inline code, and links.
  // No dangerouslySetInnerHTML — all text is escaped by React's JSX rendering.
  const renderInlineMarkdown = (text: string, keyPrefix: string): React.ReactNode[] => {
    // Tokenize: **bold**, `code`, [text](url), and plain text
    const tokens: { type: "text" | "bold" | "code" | "link"; value: string; href?: string }[] = [];
    const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // Push plain text before this match
      if (match.index > lastIndex) {
        tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      if (match[2]) {
        // **bold**
        tokens.push({ type: "bold", value: match[2] });
      } else if (match[3]) {
        // `code`
        tokens.push({ type: "code", value: match[3] });
      } else if (match[4] && match[5]) {
        // [text](url) — only allow http/https links
        const href = match[5];
        if (href.startsWith("http://") || href.startsWith("https://")) {
          tokens.push({ type: "link", value: match[4], href });
        } else {
          tokens.push({ type: "text", value: match[0] });
        }
      }
      lastIndex = regex.lastIndex;
    }
    // Remaining text
    if (lastIndex < text.length) {
      tokens.push({ type: "text", value: text.slice(lastIndex) });
    }

    return tokens.map((token, idx) => {
      switch (token.type) {
        case "bold":
          return <strong key={`${keyPrefix}-b-${idx}`}>{token.value}</strong>;
        case "code":
          return <code key={`${keyPrefix}-c-${idx}`} className="px-1.5 py-0.5 bg-gray-100 text-blue-700 rounded text-xs">{token.value}</code>;
        case "link":
          return <a key={`${keyPrefix}-a-${idx}`} href={token.href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{token.value}</a>;
        default:
          return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{token.value}</React.Fragment>;
      }
    });
  };

  const renderMarkdown = (md: string) => {
    const lines = md.split("\n");
    return lines.map((line, i) => {
      const key = `md-${i}`;
      if (line.startsWith("### ")) {
        return <h4 key={key} className="text-base font-bold text-gray-900 mt-4 mb-2">{line.replace("### ", "")}</h4>;
      }
      if (line.startsWith("- ")) {
        return <li key={key} className="text-sm text-gray-700 ml-4 mb-1">{renderInlineMarkdown(line.replace("- ", ""), key)}</li>;
      }
      if (line.trim() === "") {
        return <div key={key} className="h-2" />;
      }
      return <p key={key} className="text-sm text-gray-700 leading-relaxed mb-1">{renderInlineMarkdown(line, key)}</p>;
    });
  };

  // Loading state
  if (loading) {
    return <div className="flex items-center justify-center h-full"><LoadingState message="加载知识库..." /></div>;
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState message={error} onRetry={loadWiki} />
      </div>
    );
  }

  // Empty state
  if (!indexMd && !logMd) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <EmptyState
          icon={<BookOpen size={48} />}
          title="暂无 Wiki 数据"
          description="请在采集内容中点击「提取到Wiki」，将高价值文章提取到知识库"
        />
        <div className="mt-4">
          <input type="file" accept=".md" ref={fileInputRef} className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "上传并提取中..." : "上传本地 Markdown"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white relative">
      <input type="file" accept=".md" ref={fileInputRef} className="hidden" onChange={handleUpload} />
      
      {/* Left: Entry list */}
      <div className="w-72 border-r border-gray-100 p-4 overflow-y-auto bg-gray-50/50 flex flex-col">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <List size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">知识条目</h3>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="上传本地 Markdown 到 Wiki"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">暂无条目</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, idx) => (
              <button
                key={idx}
                onClick={() => setActiveEntry(entry)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 ${
                  activeEntry?.title === entry.title
                    ? "bg-blue-50 text-blue-700 font-medium shadow-sm ring-1 ring-blue-200"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ChevronRight size={14} className={activeEntry?.title === entry.title ? "text-blue-600" : "text-gray-400"} />
                <span className="truncate">{entry.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Detail panel */}
        <div className="flex-1 p-8 overflow-y-auto">
          {activeEntry ? (
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <BookOpen size={20} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{activeEntry.title}</h2>
              </div>
              <div className="prose-sm">{renderMarkdown(activeEntry.content)}</div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm">选择左侧条目查看详情</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: Operation log */}
        {logMd && (
          <div className="border-t border-gray-100 bg-gray-50/50">
            <details className="p-4">
              <summary className="flex items-center gap-2 text-sm font-semibold text-gray-500 cursor-pointer hover:text-gray-700">
                <ScrollText size={16} className="text-blue-600" />
                操作日志
              </summary>
              <div className="mt-3 max-h-60 overflow-y-auto text-xs text-gray-600 bg-white rounded-lg border border-gray-100 p-4">
                {renderMarkdown(logMd)}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
