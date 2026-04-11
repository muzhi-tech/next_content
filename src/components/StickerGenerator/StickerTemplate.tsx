"use client";
import React from "react";
import { TEMPLATES, type TemplateId, type ThemeConfig } from "./themes";

/**
 * 贴纸数据结构（对齐 backend StickerContent 接口）
 */
export interface StickerData {
  title: string;
  caption?: string;
  slides: Array<{
    heading: string;  // 副标题
    content: string;  // 一句话核心观点
  }>;
}

/**
 * 单张贴纸组件
 */
function StickerCard({
  heading,
  content,
  theme,
}: {
  heading: string;
  content: string;
  theme: ThemeConfig;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center p-6 text-center"
      style={{
        background: theme.background,
        color: theme.primaryText,
        fontFamily: theme.fontFamily,
        minHeight: "120px",
      }}
    >
      {/* 顶部装饰线 */}
      <div
        className="absolute top-0 left-4 right-4 h-1 rounded-full"
        style={{ background: theme.accentColor }}
      />

      {/* 副标题 */}
      <p
        className="text-sm font-medium uppercase tracking-wider mb-2"
        style={{ color: theme.accentColor }}
      >
        {heading}
      </p>

      {/* 核心内容 */}
      <p
        className="text-lg font-bold leading-relaxed max-w-full"
        style={{ color: theme.primaryText, wordBreak: "break-word" }}
      >
        {content}
      </p>

      {/* 底部装饰 */}
      <div
        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1 rounded-full"
        style={{ background: theme.accentColor, opacity: 0.6 }}
      />
    </div>
  );
}

/**
 * 语录金句模板 (quotes)
 * 黄黑配色，竖向排列
 */
export function QuotesTemplate({
  data,
  theme,
}: {
  data: StickerData;
  theme: ThemeConfig;
}) {
  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        background: theme.background,
        fontFamily: theme.fontFamily,
      }}
    >
      {/* 标题区 */}
      <div
        className="text-center py-4 px-6 border-b-4"
        style={{ borderColor: theme.accentColor }}
      >
        <h1
          className="text-2xl font-bold tracking-wider"
          style={{ color: theme.titleColor }}
        >
          {data.title}
        </h1>
      </div>

      {/* 贴纸列表 */}
      <div className="flex-1 grid grid-rows-4 gap-3 p-4">
        {data.slides.map((slide, index) => (
          <StickerCard
            key={index}
            heading={slide.heading}
            content={slide.content}
            theme={theme}
          />
        ))}
      </div>

      {/* 底部语 */}
      {data.caption && (
        <div
          className="text-center py-3 px-4 border-t-2"
          style={{
            borderColor: theme.accentColor,
            background: theme.accentColor + "20",
          }}
        >
          <p className="text-sm" style={{ color: theme.titleColor }}>
            {data.caption}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 职场金句模板 (workplace)
 * 蓝白配色，横向卡片
 */
export function WorkplaceTemplate({
  data,
  theme,
}: {
  data: StickerData;
  theme: ThemeConfig;
}) {
  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        background: theme.background,
        fontFamily: theme.fontFamily,
      }}
    >
      {/* 标题区 */}
      <div
        className="text-center py-4 px-6 relative overflow-hidden"
        style={{ background: theme.titleColor }}
      >
        <h1 className="text-xl font-bold text-white relative z-10">
          {data.title}
        </h1>
        {/* 装饰条纹 */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
          }}
        />
      </div>

      {/* 贴纸列表 - 横向排列 */}
      <div className="flex-1 flex gap-3 p-4">
        {data.slides.map((slide, index) => (
          <div
            key={index}
            className="flex-1 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-md"
            style={{
              background: "white",
              borderLeft: `4px solid ${theme.accentColor}`,
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wider mb-1"
              style={{ color: theme.accentColor }}
            >
              {slide.heading}
            </p>
            <p
              className="text-sm font-medium leading-snug"
              style={{ color: theme.primaryText }}
            >
              {slide.content}
            </p>
          </div>
        ))}
      </div>

      {/* 底部语 */}
      {data.caption && (
        <div
          className="text-center py-3 px-4"
          style={{ background: theme.accentColor + "15" }}
        >
          <p className="text-xs" style={{ color: theme.titleColor }}>
            {data.caption}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 养生大字报模板 (health)
 * 绿白清新配色
 */
export function HealthTemplate({
  data,
  theme,
}: {
  data: StickerData;
  theme: ThemeConfig;
}) {
  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        background: theme.background,
        fontFamily: theme.fontFamily,
      }}
    >
      {/* 标题区 */}
      <div className="text-center py-4 px-6" style={{ background: theme.titleColor + "20" }}>
        <h1
          className="text-2xl font-bold"
          style={{ color: theme.titleColor }}
        >
          {data.title}
        </h1>
      </div>

      {/* 贴纸列表 - 2x2 网格 */}
      <div className="flex-1 grid grid-cols-2 gap-3 p-4">
        {data.slides.map((slide, index) => (
          <div
            key={index}
            className="rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden"
            style={{
              background: "white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {/* 左上角装饰 */}
            <div
              className="absolute top-0 left-0 w-12 h-12 rounded-br-full opacity-30"
              style={{ background: theme.accentColor }}
            />
            <p
              className="text-sm font-medium uppercase tracking-wider mb-1 relative z-10"
              style={{ color: theme.accentColor }}
            >
              {slide.heading}
            </p>
            <p
              className="text-base font-semibold leading-snug relative z-10"
              style={{ color: theme.primaryText }}
            >
              {slide.content}
            </p>
          </div>
        ))}
      </div>

      {/* 底部语 */}
      {data.caption && (
        <div
          className="text-center py-3 px-4 border-t"
          style={{ borderColor: theme.accentColor }}
        >
          <p className="text-sm" style={{ color: theme.titleColor }}>
            {data.caption}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 根据模板ID渲染对应组件
 */
export function StickerTemplateRenderer({
  templateId,
  data,
}: {
  templateId: TemplateId;
  data: StickerData;
}) {
  const theme = TEMPLATES[templateId];

  switch (templateId) {
    case "quotes":
      return <QuotesTemplate data={data} theme={theme} />;
    case "workplace":
      return <WorkplaceTemplate data={data} theme={theme} />;
    case "health":
      return <HealthTemplate data={data} theme={theme} />;
    default:
      return <QuotesTemplate data={data} theme={theme} />;
  }
}
