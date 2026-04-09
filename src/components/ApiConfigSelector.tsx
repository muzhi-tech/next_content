"use client";
import React, { useState, useEffect } from "react";
import { Plus, Trash2, Settings, Edit3 } from "lucide-react";

export interface ApiConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  type: 'text' | 'image';
  isDefault: boolean;
  isDefaultImage: boolean;
}

interface ApiConfigSelectorProps {
  /** Currently selected default config, exposed to parent */
  defaultConfig: ApiConfig | null;
  /** Called when configs are loaded/refreshed */
  onConfigsLoaded: (configs: ApiConfig[], defaultConfig: ApiConfig | null) => void;
}

export default function ApiConfigSelector({ defaultConfig, onConfigsLoaded }: ApiConfigSelectorProps) {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    name: "",
    apiUrl: "",
    apiKey: "",
    modelName: "gpt-4o-mini",
    isDefault: false,
    type: "text" as "text" | "image",
    isDefaultImage: false,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const loadConfigs = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.code === 0) {
        const cfgs = data.data.configs || [];
        const def = data.data.defaultConfig;
        setConfigs(cfgs);
        onConfigsLoaded(cfgs, def);
      }
    } catch (err) {
      console.error("Failed to load configs:", err);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSaveConfig = async () => {
    if (!configForm.name || !configForm.apiUrl || !configForm.apiKey) {
      alert("请填写完整信息");
      return;
    }
    setSavingConfig(true);
    try {
      if (editingConfig) {
        await fetch(`/api/config/${editingConfig.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configForm),
        });
      } else {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configForm),
        });
      }
      await loadConfigs();
      setShowConfigForm(false);
      setEditingConfig(null);
      setConfigForm({ name: "", apiUrl: "", apiKey: "", modelName: "gpt-4o-mini", isDefault: false, type: "text", isDefaultImage: false });
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("确定删除此配置？")) return;
    try {
      await fetch(`/api/config/${id}`, { method: "DELETE" });
      await loadConfigs();
    } catch (err) {
      console.error("Failed to delete config:", err);
    }
  };

  const handleEditConfig = (config: ApiConfig) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      modelName: config.modelName,
      isDefault: config.isDefault,
      type: config.type || "text",
      isDefaultImage: config.isDefaultImage,
    });
    setShowConfigForm(true);
  };

  const formId = `cfg-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">⚙️ API 配置</h3>
        <button
          onClick={() => {
            setShowConfigForm(true);
            setEditingConfig(null);
            setConfigForm({ name: "", apiUrl: "", apiKey: "", modelName: "gpt-4o-mini", isDefault: false, type: "text", isDefaultImage: false });
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-700"
        >
          <Plus size={16} /> 添加配置
        </button>
      </div>

      {showConfigForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h4 className="font-bold text-gray-900 mb-4">{editingConfig ? "编辑配置" : "新增配置"}</h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">配置名称</label>
              <input
                type="text"
                value={configForm.name}
                onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                placeholder="如：OpenAI API"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">API 地址</label>
              <input
                type="text"
                value={configForm.apiUrl}
                onChange={(e) => setConfigForm({ ...configForm, apiUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">API 密钥</label>
              <input
                type="password"
                value={configForm.apiKey}
                onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">模型名称</label>
              <input
                type="text"
                value={configForm.modelName}
                onChange={(e) => setConfigForm({ ...configForm, modelName: e.target.value })}
                placeholder="gpt-4o-mini"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">配置类型</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`type-${formId}`}
                    value="text"
                    checked={configForm.type === "text"}
                    onChange={() => setConfigForm({ ...configForm, type: "text" })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm text-gray-700">文本模型</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`type-${formId}`}
                    value="image"
                    checked={configForm.type === "image"}
                    onChange={() => setConfigForm({ ...configForm, type: "image" })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span className="text-sm text-gray-700">绘图模型</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`isDefault-${formId}`}
                  checked={configForm.isDefault}
                  onChange={(e) => setConfigForm({ ...configForm, isDefault: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <label htmlFor={`isDefault-${formId}`} className="text-sm text-gray-600">默认文本模型</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`isDefaultImage-${formId}`}
                  checked={configForm.isDefaultImage}
                  onChange={(e) => setConfigForm({ ...configForm, isDefaultImage: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor={`isDefaultImage-${formId}`} className="text-sm text-gray-600">默认绘图模型</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {savingConfig ? "保存中..." : "保存"}
              </button>
              <button
                onClick={() => { setShowConfigForm(false); setEditingConfig(null); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {configs.length === 0 && !showConfigForm ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
          <Settings size={48} className="mx-auto mb-4 text-gray-300" />
          <p>暂无 API 配置</p>
          <p className="text-sm mt-1">点击上方按钮添加你的 AI API 配置</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`bg-white rounded-xl border p-4 ${config.isDefault ? "border-purple-400 ring-1 ring-purple-400" : "border-gray-200"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900">{config.name}</h4>
                    {config.type === "image" ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">绘图</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">文本</span>
                    )}
                    {config.isDefault && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">默认文本</span>
                    )}
                    {config.isDefaultImage && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">默认绘图</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{config.apiUrl}</p>
                  <p className="text-xs text-gray-400 mt-1">模型：{config.modelName}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditConfig(config)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDeleteConfig(config.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
