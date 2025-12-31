"use client";

import { useState, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

/**
 * 案件搜索组件
 * 功能：实时搜索案件，支持防抖
 */
interface CaseSearchProps {
  className?: string;
  onSearch: (query: string) => void;
  value: string;
}

export function CaseSearch({
  className = "",
  onSearch,
  value,
}: CaseSearchProps) {
  const [localQuery, setLocalQuery] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * 防抖处理搜索输入
   */
  const debouncedSearch = useCallback(
    (query: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onSearch(query);
      }, 300);
    },
    [onSearch],
  );

  /**
   * 处理输入变化
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalQuery(newValue);
    debouncedSearch(newValue);
  };

  /**
   * 清空搜索
   */
  const handleClear = () => {
    setLocalQuery("");
    onSearch("");
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={localQuery}
          onChange={handleChange}
          placeholder="搜索案件标题、描述..."
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        />
        {localQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
