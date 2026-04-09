"use client";
import React from "react";
import ApiConfigSelector from "./ApiConfigSelector";
import type { ApiConfig } from "./ApiConfigSelector";

export default function SystemSettingsTab() {
  return (
    <div className="max-w-4xl p-8 overflow-y-auto h-full">
      <h3 className="text-xl font-bold text-gray-900 mb-8">系统设置</h3>

      {/* AI API 配置 */}
      <section className="mb-8">
        <ApiConfigSelector
          defaultConfig={null}
          onConfigsLoaded={(_configs: ApiConfig[], _def: ApiConfig | null) => {}}
        />
      </section>
    </div>
  );
}
