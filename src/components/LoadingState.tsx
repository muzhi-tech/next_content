import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  size?: number;
}

export default function LoadingState({
  message = "加载中...",
  size = 32,
}: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={size} className="animate-spin text-blue-600" />
      <span className="ml-3 text-gray-500">{message}</span>
    </div>
  );
}
