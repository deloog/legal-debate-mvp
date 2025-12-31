"use client";

import { useState, type ReactElement } from "react";
import { Argument, ArgumentType } from "@prisma/client";

export interface ArgumentCardProps {
  argument: Argument;
  isStreaming?: boolean;
}

/**
 * 论点类型标签颜色映射
 */
const typeColors: Record<ArgumentType, string> = {
  MAIN_POINT: "bg-blue-100 text-blue-800 border-blue-300",
  SUPPORTING: "bg-green-100 text-green-800 border-green-300",
  REBUTTAL: "bg-red-100 text-red-800 border-red-300",
  EVIDENCE: "bg-purple-100 text-purple-800 border-purple-300",
  LEGAL_BASIS: "bg-amber-100 text-amber-800 border-amber-300",
  CONCLUSION: "bg-gray-100 text-gray-800 border-gray-300",
};

/**
 * 论点类型标签中文映射
 */
const typeLabels: Record<ArgumentType, string> = {
  MAIN_POINT: "主要论点",
  SUPPORTING: "支持论据",
  REBUTTAL: "反驳论点",
  EVIDENCE: "证据引用",
  LEGAL_BASIS: "法律依据",
  CONCLUSION: "结论",
};

/**
 * 论点卡片组件
 * 功能：展示单个论点的内容、类型和AI信息
 */
export function ArgumentCard({
  argument,
  isStreaming = false,
}: ArgumentCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      {/* 头部：论点类型和时间 */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${typeColors[argument.type]}`}
        >
          {typeLabels[argument.type]}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {new Date(argument.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* 论点内容 */}
      <div className="mb-3">
        {isStreaming ? (
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            <span className="text-sm">AI生成中...</span>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {argument.content}
          </p>
        )}
      </div>

      {/* AI信息 */}
      {argument.aiProvider && (
        <div className="mb-3 rounded bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="text-zinc-500 dark:text-zinc-400">AI:</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {argument.aiProvider}
              </span>
            </span>
            {argument.generationTime && (
              <span className="text-zinc-500 dark:text-zinc-400">
                {argument.generationTime}ms
              </span>
            )}
            {argument.confidence && (
              <span className="flex items-center gap-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  置信度:
                </span>
                <span
                  className={`font-medium ${
                    argument.confidence >= 0.8
                      ? "text-green-600"
                      : argument.confidence >= 0.5
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {(argument.confidence * 100).toFixed(0)}%
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 展开按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <span>详细信息</span>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M19 9l-7 7-7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex">
              <span className="w-20 font-medium">论点ID:</span>
              <span className="font-mono">{argument.id}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-medium">论点方:</span>
              <span>
                {argument.side === "PLAINTIFF"
                  ? "原告"
                  : argument.side === "DEFENDANT"
                    ? "被告"
                    : "中立"}
              </span>
            </div>
            {argument.updatedAt && (
              <div className="flex">
                <span className="w-20 font-medium">更新时间:</span>
                <span>
                  {new Date(argument.updatedAt).toLocaleString("zh-CN")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
