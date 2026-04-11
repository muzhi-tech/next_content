"use client";
import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import LoadingState from "../LoadingState";
import type { DashboardData, PipelineRun, AgentStat } from "@/lib/types";
import DashboardCharts from "./DashboardCharts";
import AgentStatusPanel from "./AgentStatusPanel";

// ==================== Main Component ====================

export default function AnalyticsTab() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRun | null>(null);
  const [hasActivePipeline, setHasActivePipeline] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const EMPTY_DASHBOARD: DashboardData = {
    totalArticles: 0,
    weeklyArticles: 0,
    generatedContentTotal: 0,
    platformDistribution: [],
    collectionTrend: [],
    generatedContentStats: { total: 0, byStatus: [] },
    topKeywords: [],
  };

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/dashboard");
      const data = await res.json();
      if (data.code === 0) {
        setDashboard(data.data);
      } else {
        setDashboard(EMPTY_DASHBOARD);
      }
    } catch {
      setDashboard(EMPTY_DASHBOARD);
    }
  }, []);

  const loadPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/pipeline-status");
      const data = await res.json();
      if (data.code === 0) {
        setPipeline(data.data.pipeline || null);
        setHasActivePipeline(data.data.hasActivePipeline || false);
      } else {
        setHasActivePipeline(false);
        setPipeline(null);
      }
    } catch {
      setHasActivePipeline(false);
      setPipeline(null);
    }
  }, []);

  const loadAgentStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/agent-stats");
      const data = await res.json();
      if (data.code === 0) {
        setAgentStats(data.data);
      } else {
        setAgentStats([]);
      }
    } catch {
      setAgentStats([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadDashboard(), loadPipelineStatus(), loadAgentStats()]);
    setLoading(false);
  }, [loadDashboard, loadPipelineStatus, loadAgentStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadPipelineStatus(), loadAgentStats()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Polling for pipeline status
  useEffect(() => {
    if (!hasActivePipeline) return;
    const interval = setInterval(() => {
      loadPipelineStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [hasActivePipeline, loadPipelineStatus]);

  if (loading) {
    return <LoadingState message="加载数据分析..." />;
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">数据分析</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {/* Dashboard 图表 */}
      <DashboardCharts dashboard={dashboard} />

      {/* Agent 状态面板 */}
      <AgentStatusPanel
        pipeline={pipeline}
        hasActivePipeline={hasActivePipeline}
        agentStats={agentStats}
      />
    </div>
  );
}
