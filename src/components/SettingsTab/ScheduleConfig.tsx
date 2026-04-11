"use client";
import React from "react";
import { Clock, Loader2, Save } from "lucide-react";

interface ScheduleConfigProps {
  scheduleEnabled: boolean;
  scheduleInterval: string;
  autoIngestEnabled: boolean;
  ingestTopN: number;
  savingSchedule: boolean;
  scheduleMsg: { type: "success" | "error"; text: string } | null;

  setScheduleEnabled: (val: boolean) => void;
  setScheduleInterval: (val: string) => void;
  setAutoIngestEnabled: (val: boolean) => void;
  setIngestTopN: (val: number) => void;
  onSave: () => void;
}

export default function ScheduleConfig({
  scheduleEnabled,
  scheduleInterval,
  autoIngestEnabled,
  ingestTopN,
  savingSchedule,
  scheduleMsg,
  setScheduleEnabled,
  setScheduleInterval,
  setAutoIngestEnabled,
  setIngestTopN,
  onSave,
}: ScheduleConfigProps) {
  return (
    <section className="mb-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <Clock size={16} className="text-blue-600" /> 调度配置
      </h4>

      <div className="space-y-4">
        {/* 定时采集开关 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">定时采集</p>
            <p className="text-xs text-gray-500">按设定间隔自动执行关键词采集</p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">{scheduleEnabled ? "已启用" : "未启用"}</span>
          </label>
        </div>

        {/* 采集间隔 */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">采集间隔</p>
          <select
            value={scheduleInterval}
            onChange={(e) => setScheduleInterval(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="30m">30 分钟</option>
            <option value="1h">1 小时</option>
            <option value="2h">2 小时</option>
            <option value="6h">6 小时</option>
            <option value="12h">12 小时</option>
            <option value="24h">24 小时</option>
          </select>
        </div>

        {/* 采集后自动 Ingest */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">采集后自动 Ingest</p>
            <p className="text-xs text-gray-500">采集完成后自动将 Top N 文章摄入 Wiki 知识库</p>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoIngestEnabled}
              onChange={(e) => setAutoIngestEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Top</span>
            <input
              type="number"
              min={1}
              max={20}
              value={ingestTopN}
              onChange={(e) => setIngestTopN(parseInt(e.target.value) || 5)}
              className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-center"
            />
          </label>
        </div>

        {/* 保存按钮 */}
        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={savingSchedule}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {savingSchedule ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {savingSchedule ? "保存中..." : "保存调度配置"}
          </button>
          {scheduleMsg && (
            <span className={`text-sm ${scheduleMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {scheduleMsg.text}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
