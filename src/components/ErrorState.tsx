import React from "react";
import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  message,
  onRetry,
  retryLabel = "重试",
}: ErrorStateProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
      <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-red-700 font-medium">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-red-600 hover:text-red-800 hover:underline font-medium"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
