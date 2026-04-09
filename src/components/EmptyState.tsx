import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Render inside a card-like container with border */
  bordered?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  bordered,
}: EmptyStateProps) {
  const content = (
    <div className="text-center max-w-sm">
      {icon && (
        <div className="mx-auto mb-4 text-gray-300 flex justify-center">
          {icon}
        </div>
      )}
      <p className="text-gray-600 font-medium">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 mt-2">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );

  if (bordered) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
