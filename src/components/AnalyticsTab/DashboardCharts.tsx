"use client";
import React from "react";
import { BarChart3, TrendingUp, FileText, Sparkles } from "lucide-react";
import EmptyState from "../EmptyState";
import type {
  DashboardData,
  PlatformDistribution,
  CollectionTrend,
  ContentStatusCount,
  TopKeyword,
} from "@/lib/types";

// ==================== 常量 ====================

const PLATFORM_NAMES: Record<string, string> = {
  xhs: "小红书",
  wx: "公众号",
  dy: "抖音",
  bilibili: "B站",
  weibo: "微博",
};

const PLATFORM_COLORS: Record<string, string> = {
  xhs: "#FF6B6B",
  wx: "#4ECDC4",
  dy: "#45B7D1",
  bilibili: "#96CEB4",
  weibo: "#FFEAA7",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  reviewed: "已审核",
  published: "已发布",
  archived: "已归档",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#F59E0B",
  reviewed: "#3B82F6",
  published: "#10B981",
  archived: "#6B7280",
};

// ==================== 图表组件 ====================

function PieChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">暂无数据</div>
      </div>
    );
  }

  let currentAngle = 0;
  const gradientParts = data.map((d) => {
    const percent = (d.value / total) * 100;
    const startAngle = currentAngle;
    currentAngle += percent;
    return `${d.color} ${startAngle}% ${currentAngle}%`;
  });

  return (
    <div className="flex items-center gap-4">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${gradientParts.join(", ")})`,
          boxShadow: "inset 0 0 0 35px white",
        }}
      />
      <div className="flex flex-col gap-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-gray-600">{d.label}</span>
            <span className="text-xs font-medium text-gray-800">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">暂无数据</div>
      </div>
    );
  }

  let currentAngle = 0;
  const gradientParts = data.map((d) => {
    const percent = (d.value / total) * 100;
    const startAngle = currentAngle;
    currentAngle += percent;
    return `${d.color} ${startAngle}% ${currentAngle}%`;
  });

  return (
    <div className="flex items-center gap-4">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${gradientParts.join(", ")})`,
          boxShadow: "inset 0 0 0 45px white",
        }}
      />
      <div className="flex flex-col gap-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-gray-600">{d.label}</span>
            <span className="text-xs font-medium text-gray-800">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, height = 100 }: { data: CollectionTrend[]; height?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height }}>
        <span className="text-gray-400 text-xs">暂无数据</span>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 280;
  const chartHeight = height;
  const padding = { top: 8, bottom: 20, left: 0, right: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * innerWidth,
    y: padding.top + innerHeight - (d.count / max) * innerHeight,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${chartHeight}`} style={{ width: "100%", height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            y1={padding.top + innerHeight * ratio}
            x2={width - padding.right}
            y2={padding.top + innerHeight * ratio}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#4ECDC4"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polygon
          points={`${polylinePoints} ${width - padding.right},${padding.top + innerHeight} ${padding.left},${padding.top + innerHeight}`}
          fill="url(#lineGradient)"
          opacity="0.3"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4ECDC4" />
        ))}
        {data.map((d, i) => {
          if (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) {
            return (
              <text key={i} x={points[i].x} y={chartHeight - 2} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                {d.date.slice(5)}
              </text>
            );
          }
          return null;
        })}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function BarChart({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg py-8">
        <span className="text-gray-400 text-xs">暂无数据</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 truncate">{d.name}</span>
          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-300"
              style={{
                width: `${(d.count / max) * 100}%`,
                backgroundColor: i === 0 ? "#4ECDC4" : i === 1 ? "#45B7D1" : i === 2 ? "#96CEB4" : "#A0AEC0",
              }}
            />
          </div>
          <span className="text-xs font-medium text-gray-800 w-8 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== Dashboard 统计卡片 ====================

interface StatCardsProps {
  dashboard: DashboardData | null;
}

function StatCards({ dashboard }: StatCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FileText size={20} />
          </div>
          <span className="text-sm font-medium text-gray-500">内容总量</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {dashboard?.totalArticles?.toLocaleString() || "0"}
        </div>
        <div className="text-xs text-gray-400 mt-1">已采集文章数</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg">
            <TrendingUp size={20} />
          </div>
          <span className="text-sm font-medium text-gray-500">本周新增</span>
        </div>
        <div className="text-2xl font-bold text-green-600">
          +{dashboard?.weeklyArticles?.toLocaleString() || "0"}
        </div>
        <div className="text-xs text-gray-400 mt-1">7天内新增文章</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Sparkles size={20} />
          </div>
          <span className="text-sm font-medium text-gray-500">AI 产出</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {dashboard?.generatedContentStats?.total?.toLocaleString() || "0"}
        </div>
        <div className="text-xs text-gray-400 mt-1">AI 生成内容数</div>
      </div>
    </div>
  );
}

// ==================== 主 Dashboard 组件 ====================

interface DashboardChartsProps {
  dashboard: DashboardData | null;
}

export default function DashboardCharts({ dashboard }: DashboardChartsProps) {
  const platformChartData = dashboard?.platformDistribution.map((p) => ({
    label: PLATFORM_NAMES[p.platform] || p.platform,
    value: p.count,
    color: PLATFORM_COLORS[p.platform] || "#9CA3AF",
  })) || [];

  const statusChartData = dashboard?.generatedContentStats.byStatus.map((s) => ({
    label: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "#9CA3AF",
  })) || [];

  const keywordChartData = dashboard?.topKeywords.slice(0, 10).map((k) => ({
    name: k.keywordName,
    count: k.articleCount,
  })) || [];

  return (
    <>
      <StatCards dashboard={dashboard} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            平台分布
          </h4>
          {platformChartData.length > 0 ? (
            <div className="flex justify-center">
              <PieChart data={platformChartData} />
            </div>
          ) : (
            <EmptyState icon={<BarChart3 size={24} />} title="暂无数据" description="采集文章后将显示平台分布" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" />
            采集趋势（近7天）
          </h4>
          <LineChart data={dashboard?.collectionTrend || []} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-purple-500" />
            内容状态分布
          </h4>
          {statusChartData.length > 0 ? (
            <div className="flex justify-center">
              <DonutChart data={statusChartData} />
            </div>
          ) : (
            <EmptyState icon={<FileText size={24} />} title="暂无数据" description="AI 生成内容后将显示状态分布" />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-orange-500" />
            关键词热度 Top 10
          </h4>
          <BarChart data={keywordChartData} />
        </div>
      </div>
    </>
  );
}
