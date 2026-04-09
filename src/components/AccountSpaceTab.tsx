"use client";
import React, { useState, useEffect, useCallback } from "react";
import { User, Palette, BookOpen, FileText, Plus, Trash2, Edit3, Loader2, AlertCircle } from "lucide-react";
import EmptyState from "./EmptyState";
import { Persona, Style, KnowledgeBase, WxTemplate } from "@/lib/types";
import { personaApi, styleApi, knowledgeApi, templateApi } from "@/lib/api";

interface Props {
  categoryId: string;
}

export default function AccountSpaceTab({ categoryId }: Props) {
  const [activeSection, setActiveSection] = useState<"persona" | "style" | "knowledge" | "template">("persona");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [templates, setTemplates] = useState<WxTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [personaForm, setPersonaForm] = useState({ name: "", description: "", systemPrompt: "" });
  const [styleForm, setStyleForm] = useState({ name: "", icon: "📝", systemPrompt: "" });
  const [knowledgeForm, setKnowledgeForm] = useState({ name: "", description: "", content: "" });
  const [templateForm, setTemplateForm] = useState({ name: "", titleTemplate: "", contentTemplate: "", coverPromptTemplate: "" });

  // 加载数据
  const loadPersonas = useCallback(async () => {
    try {
      const data = await personaApi.list();
      setPersonas(data);
    } catch (err) {
      console.error("加载人设失败:", err);
    }
  }, []);

  const loadStyles = useCallback(async () => {
    try {
      const data = await styleApi.list();
      setStyles(data);
    } catch (err) {
      console.error("加载风格失败:", err);
    }
  }, []);

  const loadKnowledge = useCallback(async () => {
    try {
      const data = await knowledgeApi.list();
      setKnowledgeBases(data);
    } catch (err) {
      console.error("加载知识库失败:", err);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await templateApi.list();
      setTemplates(data);
    } catch (err) {
      console.error("加载模板失败:", err);
    }
  }, []);

  useEffect(() => {
    // 并行加载所有数据
    Promise.all([loadPersonas(), loadStyles(), loadKnowledge(), loadTemplates()]);
  }, [loadPersonas, loadStyles, loadKnowledge, loadTemplates]);

  // 重置表单
  const resetForms = () => {
    setPersonaForm({ name: "", description: "", systemPrompt: "" });
    setStyleForm({ name: "", icon: "📝", systemPrompt: "" });
    setKnowledgeForm({ name: "", description: "", content: "" });
    setTemplateForm({ name: "", titleTemplate: "", contentTemplate: "", coverPromptTemplate: "" });
  };

  // 保存人设
  const handleSavePersona = async () => {
    if (!personaForm.name || !personaForm.systemPrompt) return;
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await personaApi.update(editingId, personaForm);
        setPersonas(personas.map(p => p.id === editingId ? updated : p));
      } else {
        const created = await personaApi.create(personaForm);
        setPersonas([...personas, created]);
      }
      resetForms();
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  // 保存风格
  const handleSaveStyle = async () => {
    if (!styleForm.name || !styleForm.systemPrompt) return;
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await styleApi.update(editingId, styleForm);
        setStyles(styles.map(s => s.id === editingId ? updated : s));
      } else {
        const created = await styleApi.create(styleForm);
        setStyles([...styles, created]);
      }
      resetForms();
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  // 保存知识库
  const handleSaveKnowledge = async () => {
    if (!knowledgeForm.name) return;
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await knowledgeApi.update(editingId, knowledgeForm);
        setKnowledgeBases(knowledgeBases.map(k => k.id === editingId ? updated : k));
      } else {
        const created = await knowledgeApi.create(knowledgeForm);
        setKnowledgeBases([...knowledgeBases, created]);
      }
      resetForms();
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  // 保存模板
  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.titleTemplate) return;
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await templateApi.update(editingId, templateForm);
        setTemplates(templates.map(t => t.id === editingId ? updated : t));
      } else {
        const created = await templateApi.create(templateForm);
        setTemplates([...templates, created]);
      }
      resetForms();
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  // 编辑
  const handleEdit = (section: string, item: any) => {
    setEditingId(item.id);
    setShowForm(true);
    if (section === "persona") {
      setPersonaForm({ name: item.name, description: item.description || "", systemPrompt: item.systemPrompt || "" });
    } else if (section === "style") {
      setStyleForm({ name: item.name, icon: item.icon || "📝", systemPrompt: item.systemPrompt || "" });
    } else if (section === "knowledge") {
      setKnowledgeForm({ name: item.name, description: item.description || "", content: item.content || "" });
    } else if (section === "template") {
      setTemplateForm({
        name: item.name,
        titleTemplate: item.titleTemplate || item.title || "",
        contentTemplate: item.contentTemplate || item.content || "",
        coverPromptTemplate: item.coverPromptTemplate || item.coverPrompt || ""
      });
    }
  };

  // 删除
  const handleDelete = async (section: string, id: string) => {
    if (!confirm("确定删除？")) return;
    setLoading(true);
    setError(null);
    try {
      if (section === "persona") {
        await personaApi.delete(id);
        setPersonas(personas.filter(p => p.id !== id));
      } else if (section === "style") {
        await styleApi.delete(id);
        setStyles(styles.filter(s => s.id !== id));
      } else if (section === "knowledge") {
        await knowledgeApi.delete(id);
        setKnowledgeBases(knowledgeBases.filter(k => k.id !== id));
      } else if (section === "template") {
        await templateApi.delete(id);
        setTemplates(templates.filter(t => t.id !== id));
      }
    } catch (err: any) {
      setError(err.message || "删除失败");
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: "persona" as const, name: "人设", icon: <User size={16} />, count: personas.length },
    { id: "style" as const, name: "风格", icon: <Palette size={16} />, count: styles.length },
    { id: "knowledge" as const, name: "知识库", icon: <BookOpen size={16} />, count: knowledgeBases.length },
    { id: "template" as const, name: "公众号模板", icon: <FileText size={16} />, count: templates.length },
  ];

  return (
    <div className="h-full flex">
      {/* 左侧：功能列表 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">账号空间</h3>
          <p className="text-xs text-gray-500 mt-1">配置人设、风格、知识库、模板</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => { setActiveSection(section.id); setShowForm(false); setEditingId(null); setError(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                activeSection === section.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                {section.icon}
                {section.name}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${activeSection === section.id ? "bg-blue-100" : "bg-gray-100"}`}>
                {section.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 右侧：内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl">
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              {sections.find(s => s.id === activeSection)?.name}
            </h3>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                resetForms();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              <Plus size={16} /> 新增
            </button>
          </div>

          {/* 表单 */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <h4 className="font-bold text-gray-900 mb-4">{editingId ? "编辑" : "新增"}</h4>

              {activeSection === "persona" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">人设名称 *</label>
                    <input
                      type="text"
                      value={personaForm.name}
                      onChange={(e) => setPersonaForm({ ...personaForm, name: e.target.value })}
                      placeholder="如：科技小达人"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">人设描述</label>
                    <textarea
                      value={personaForm.description}
                      onChange={(e) => setPersonaForm({ ...personaForm, description: e.target.value })}
                      placeholder="描述这个角色的特点、写作风格..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">系统提示词 *</label>
                    <textarea
                      value={personaForm.systemPrompt}
                      onChange={(e) => setPersonaForm({ ...personaForm, systemPrompt: e.target.value })}
                      placeholder="定义 AI 的人设角色，如：你是一位资深的科技评论员，擅长用通俗易懂的语言解读复杂的科技产品..."
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                </div>
              )}

              {activeSection === "style" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">风格名称 *</label>
                      <input
                        type="text"
                        value={styleForm.name}
                        onChange={(e) => setStyleForm({ ...styleForm, name: e.target.value })}
                        placeholder="如：科技媒体评论"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">图标</label>
                      <input
                        type="text"
                        value={styleForm.icon}
                        onChange={(e) => setStyleForm({ ...styleForm, icon: e.target.value })}
                        placeholder="📝"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">系统提示词 *</label>
                    <textarea
                      value={styleForm.systemPrompt}
                      onChange={(e) => setStyleForm({ ...styleForm, systemPrompt: e.target.value })}
                      placeholder="定义这个风格的写作提示词..."
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                </div>
              )}

              {activeSection === "knowledge" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">知识库名称 *</label>
                      <input
                        type="text"
                        value={knowledgeForm.name}
                        onChange={(e) => setKnowledgeForm({ ...knowledgeForm, name: e.target.value })}
                        placeholder="如：AI知识库"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">描述</label>
                      <input
                        type="text"
                        value={knowledgeForm.description}
                        onChange={(e) => setKnowledgeForm({ ...knowledgeForm, description: e.target.value })}
                        placeholder="简短描述"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">知识内容 *</label>
                    <textarea
                      value={knowledgeForm.content}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                      placeholder="输入知识内容..."
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                </div>
              )}

              {activeSection === "template" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">模板名称 *</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="如：科技测评模板"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">标题模板 *（可用 {"{}"} 变量）</label>
                    <input
                      type="text"
                      value={templateForm.titleTemplate}
                      onChange={(e) => setTemplateForm({ ...templateForm, titleTemplate: e.target.value })}
                      placeholder="如：【测评】{产品名}"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">内容模板 *</label>
                    <textarea
                      value={templateForm.contentTemplate}
                      onChange={(e) => setTemplateForm({ ...templateForm, contentTemplate: e.target.value })}
                      placeholder="文章内容模板，支持 {变量} 格式..."
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">封面提示词模板</label>
                    <textarea
                      value={templateForm.coverPromptTemplate}
                      onChange={(e) => setTemplateForm({ ...templateForm, coverPromptTemplate: e.target.value })}
                      placeholder="封面图提示词模板，支持 {变量} 格式..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    if (activeSection === "persona") handleSavePersona();
                    else if (activeSection === "style") handleSaveStyle();
                    else if (activeSection === "knowledge") handleSaveKnowledge();
                    else if (activeSection === "template") handleSaveTemplate();
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  保存
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); setError(null); }}
                  disabled={loading}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 列表 */}
          {activeSection === "persona" && personas.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{p.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{p.description}</p>
                  {p.systemPrompt && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2 font-mono bg-gray-50 p-2 rounded">
                      {p.systemPrompt}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit("persona", p)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" disabled={loading}>
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete("persona", p.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" disabled={loading}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeSection === "style" && styles.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{s.name}</h4>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.systemPrompt}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit("style", s)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" disabled={loading}>
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete("style", s.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" disabled={loading}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeSection === "knowledge" && knowledgeBases.map((k) => (
            <div key={k.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{k.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">{k.description}</p>
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{k.content}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit("knowledge", k)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" disabled={loading}>
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete("knowledge", k.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" disabled={loading}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeSection === "template" && templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{t.name}</h4>
                  <p className="text-sm text-blue-600 mt-1 font-mono">{t.titleTemplate}</p>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-3 whitespace-pre-wrap">{t.contentTemplate}</p>
                  {t.coverPromptTemplate && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-1">封面: {t.coverPromptTemplate}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handleEdit("template", t)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" disabled={loading}>
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete("template", t.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" disabled={loading}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 空状态 */}
          {activeSection === "persona" && personas.length === 0 && !showForm && (
            <EmptyState
              icon={<User size={48} />}
              title="暂无人设"
              description="点击上方按钮创建人设"
              bordered
            />
          )}
          {activeSection === "style" && styles.length === 0 && !showForm && (
            <EmptyState
              icon={<Palette size={48} />}
              title="暂无风格"
              description="点击上方按钮创建风格"
              bordered
            />
          )}
          {activeSection === "knowledge" && knowledgeBases.length === 0 && !showForm && (
            <EmptyState
              icon={<BookOpen size={48} />}
              title="暂无知识库"
              description="点击上方按钮添加知识库"
              bordered
            />
          )}
          {activeSection === "template" && templates.length === 0 && !showForm && (
            <EmptyState
              icon={<FileText size={48} />}
              title="暂无模板"
              description="点击上方按钮创建模板"
              bordered
            />
          )}
        </div>
      </div>
    </div>
  );
}
