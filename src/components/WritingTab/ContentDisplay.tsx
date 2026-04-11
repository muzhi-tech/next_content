"use client";
import React from "react";
import { Loader2, Copy, Check, Save, Edit3, Send, BookOpen } from "lucide-react";

interface ContentDisplayProps {
  // 内容
  generatedContent: string;
  editedContent: string;
  isEditing: boolean;
  copied: boolean;

  // 标题
  generatedTitles: { title: string; summary: string }[];

  // Wiki 命中
  wikiHits: string[];

  // 发布状态
  publishing: boolean;
  savingContent: boolean;
  savedContentId: string | null;

  // 事件
  onEditContent: () => void;
  onSaveContent: () => void;
  onCopyContent: () => void;
  onPublish: () => void;
  onGenerateTitles: () => void;
  setEditedContent: (val: string) => void;
}

export default function ContentDisplay({
  generatedContent,
  editedContent,
  isEditing,
  copied,
  generatedTitles,
  wikiHits,
  publishing,
  savingContent,
  savedContentId,
  onEditContent,
  onSaveContent,
  onCopyContent,
  onPublish,
  onGenerateTitles,
  setEditedContent,
}: ContentDisplayProps) {
  if (!generatedContent && wikiHits.length === 0 && generatedTitles.length === 0) {
    return null;
  }

  return (
    <>
      {/* Wiki 命中 */}
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

      {/* 生成的正文 */}
      {generatedContent && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">📄 生成的正文</h3>
            <div className="flex gap-2">
              <button
                onClick={onPublish}
                disabled={publishing}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {publishing ? "发布中..." : "发布到公众号"}
              </button>
              {isEditing ? (
                <button
                  onClick={onSaveContent}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                >
                  <Save size={14} /> 保存
                </button>
              ) : (
                <button
                  onClick={onEditContent}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-1"
                >
                  <Edit3 size={14} /> 编辑
                </button>
              )}
              <button
                onClick={onCopyContent}
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
              onClick={onGenerateTitles}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              生成标题摘要
            </button>
            {savingContent && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Loader2 size={14} className="animate-spin" /> 保存中...
              </span>
            )}
            {savedContentId && !savingContent && (
              <span className="text-sm text-green-600">已保存为草稿</span>
            )}
          </div>
        </div>
      )}

      {/* 标题与摘要 */}
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
    </>
  );
}
