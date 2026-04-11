"use client";
import React from "react";
import { ChevronDown, ChevronRight, User, Palette, BookOpen, Zap } from "lucide-react";
import type { Persona, Style, KnowledgeBase } from "@/lib/types";

interface AccountSpaceSelectorsProps {
  // 数据
  personas: Persona[];
  styles: Style[];
  knowledgeBases: KnowledgeBase[];

  // 选中状态
  selectedPersonaId: string;
  selectedStyleId: string;
  selectedKnowledgeIds: string[];

  // Wiki
  useWiki: boolean;
  wikiMode: "index-only" | "full-context";

  // 折叠状态
  showPersona: boolean;
  showStyle: boolean;
  showKnowledge: boolean;
  showWikiPanel: boolean;

  // 事件
  onSelectPersona: (id: string) => void;
  onSelectStyle: (id: string) => void;
  onToggleKnowledge: (id: string) => void;
  onSetUseWiki: (val: boolean) => void;
  onSetWikiMode: (mode: "index-only" | "full-context") => void;
  onToggleShowPersona: () => void;
  onToggleShowStyle: () => void;
  onToggleShowKnowledge: () => void;
  onToggleShowWikiPanel: () => void;

  // 文章长度
  selectedLength: "short" | "medium" | "long";
  onSelectLength: (length: "short" | "medium" | "long") => void;
}

const LENGTH_OPTIONS = [
  { id: "short", name: "短文", icon: "\u{1F4DD}" },
  { id: "medium", name: "中等", icon: "\u{1F4C4}" },
  { id: "long", name: "长文", icon: "\u{1F4DA}" },
] as const;

export default function AccountSpaceSelectors({
  personas,
  styles,
  knowledgeBases,
  selectedPersonaId,
  selectedStyleId,
  selectedKnowledgeIds,
  useWiki,
  wikiMode,
  showPersona,
  showStyle,
  showKnowledge,
  showWikiPanel,
  onSelectPersona,
  onSelectStyle,
  onToggleKnowledge,
  onSetUseWiki,
  onSetWikiMode,
  onToggleShowPersona,
  onToggleShowStyle,
  onToggleShowKnowledge,
  onToggleShowWikiPanel,
  selectedLength,
  onSelectLength,
}: AccountSpaceSelectorsProps) {
  return (
    <>
      {/* 人设选择器 - 可折叠 */}
      <div className="mb-3">
        <button
          onClick={onToggleShowPersona}
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
                  onClick={() => onSelectPersona("")}
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
                    onClick={() => onSelectPersona(p.id)}
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
          onClick={onToggleShowStyle}
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
                  onClick={() => onSelectStyle("")}
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
                    onClick={() => onSelectStyle(s.id)}
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
          onClick={onToggleShowKnowledge}
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
                      onChange={() => onToggleKnowledge(k.id)}
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
          onClick={onToggleShowWikiPanel}
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
                  onChange={(e) => onSetUseWiki(e.target.checked)}
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
                    onClick={() => onSetWikiMode("index-only")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      wikiMode === "index-only"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    仅索引
                  </button>
                  <button
                    onClick={() => onSetWikiMode("full-context")}
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
              onClick={() => onSelectLength(l.id)}
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
    </>
  );
}
