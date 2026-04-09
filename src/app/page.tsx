"use client";
import React, { useState, useEffect } from "react";
import { Folder, Settings, FileText, LayoutList, Plus, Sparkles, ImageIcon, PenLine, UserCircle, BookOpen, Wrench, Archive, BarChart3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import ContentTab from "@/components/ContentTab";
import ReportTab from "@/components/ReportTab";
import SettingsTab from "@/components/SettingsTab";
import WritingTab from "@/components/WritingTab";
import ImageTab from "@/components/ImageTab";
import AccountSpaceTab from "@/components/AccountSpaceTab";
import WikiTab from "@/components/WikiTab";
import SystemSettingsTab from "@/components/SystemSettingsTab";
import ContentHistoryTab from "@/components/ContentHistoryTab";
import AnalyticsTab from "@/components/AnalyticsTab";

interface Category {
  id: string;
  name: string;
}

type MainNav = "content" | "writing" | "image" | "report" | "wiki" | "account-space" | "content-history" | "settings" | "system-settings" | "analytics";

const mainNavItems = [
  { id: "content" as MainNav, name: "采集内容", icon: <LayoutList size={18} /> },
  { id: "analytics" as MainNav, name: "数据分析", icon: <BarChart3 size={18} /> },
  { id: "writing" as MainNav, name: "AI写文", icon: <PenLine size={18} /> },
  { id: "image" as MainNav, name: "AI作图", icon: <ImageIcon size={18} /> },
  { id: "report" as MainNav, name: "选题分析与报告", icon: <FileText size={18} /> },
  { id: "wiki" as MainNav, name: "Wiki知识库", icon: <BookOpen size={18} /> },
  { id: "account-space" as MainNav, name: "账号空间", icon: <UserCircle size={18} /> },
  { id: "content-history" as MainNav, name: "内容历史", icon: <Archive size={18} /> },
  { id: "settings" as MainNav, name: "监控设置", icon: <Settings size={18} /> },
  { id: "system-settings" as MainNav, name: "系统设置", icon: <Wrench size={18} /> },
];

export default function Dashboard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeNav, setActiveNav] = useState<MainNav>("content");

  useEffect(() => {
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (data.code === 0 && Array.isArray(data.data)) {
          setCategories(data.data);
          if (data.data.length > 0) {
            setActiveCategory(data.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    loadCategories();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      {/* 左侧：一级导航 + 监控分类 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">内容监控矩阵</h1>
        </div>

        {/* 一级导航 */}
        <div className="p-3 space-y-1 border-b border-gray-100">
          <div className="px-2 text-xs font-semibold text-gray-400 uppercase mb-2">
            导航
          </div>
          {mainNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeNav === item.id
                  ? "bg-blue-50 text-blue-700 shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        {/* 监控分类（仅采集内容 Tab 显示） */}
        {activeNav === "content" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between mb-3 px-2 text-xs font-semibold text-gray-400 uppercase">
              <span>监控分类列表</span>
              <button className="hover:text-blue-600 transition-colors"><Plus size={16} /></button>
            </div>
            {categoriesLoading ? (
              <LoadingState message="加载分类..." size={20} />
            ) : categories.length === 0 ? (
              <EmptyState
                icon={<Folder size={24} />}
                title="暂无监控分类"
                description="请在监控设置中创建分类"
              />
            ) : (
              categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === c.id
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Folder size={18} className={activeCategory === c.id ? "text-blue-600" : "text-gray-400"} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 右侧：主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-8 pt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {mainNavItems.find((item) => item.id === activeNav)?.name}
          </h2>
        </div>

        {/* 内容渲染区域 */}
        <div className="flex-1 overflow-hidden">
          {activeNav === "content" && <ContentTab categoryId={activeCategory} />}
          {activeNav === "analytics" && <AnalyticsTab />}
          {activeNav === "writing" && <WritingTab categoryId={activeCategory} />}
          {activeNav === "image" && <ImageTab categoryId={activeCategory} />}
          {activeNav === "report" && <ReportTab categoryId={activeCategory} />}
          {activeNav === "wiki" && <WikiTab categoryId={activeCategory} />}
          {activeNav === "account-space" && <AccountSpaceTab categoryId={activeCategory} />}
          {activeNav === "content-history" && <ContentHistoryTab />}
          {activeNav === "settings" && <SettingsTab categoryId={activeCategory} />}
          {activeNav === "system-settings" && <SystemSettingsTab />}
        </div>
      </div>
    </div>
  );
}
