"use client";

import { Argument } from "@prisma/client";
import { ArgumentCard } from "./argument-card";

export interface ArgumentColumnProps {
  title: string;
  side: "PLAINTIFF" | "DEFENDANT" | "NEUTRAL";
  arguments: Argument[];
  streamingArgumentId?: string | null;
  accentColor: "blue" | "red" | "gray";
}

/**
 * 颜色样式映射
 */
const colorStyles = {
  blue: {
    header: "bg-blue-500",
    border: "border-blue-500/20",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-300",
  },
  red: {
    header: "bg-red-500",
    border: "border-red-500/20",
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-300",
  },
  gray: {
    header: "bg-gray-500",
    border: "border-gray-500/20",
    bg: "bg-gray-50 dark:bg-gray-950/20",
    text: "text-gray-700 dark:text-gray-300",
  },
};

/**
 * 论点列组件
 * 功能：展示单方（原告/被告/中立）的所有论点
 */
export function ArgumentColumn({
  title,
  side,
  arguments: argumentsList,
  streamingArgumentId,
  accentColor,
}: ArgumentColumnProps) {
  const styles = colorStyles[accentColor];
  const filteredArguments = argumentsList.filter((arg) => arg.side === side);

  return (
    <div
      className={`flex flex-col rounded-xl border ${styles.border} ${styles.bg}`}
    >
      {/* 列标题 */}
      <div
        className={`${styles.header} rounded-t-xl px-4 py-3 text-center font-medium text-white`}
      >
        {title}
        <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {filteredArguments.length}
        </span>
      </div>

      {/* 论点列表 */}
      <div className="flex-1 space-y-3 p-4">
        {filteredArguments.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
            暂无论点
          </div>
        ) : (
          <div className="space-y-3">
            {filteredArguments.map((argument) => (
              <ArgumentCard
                key={argument.id}
                argument={argument}
                isStreaming={argument.id === streamingArgumentId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
