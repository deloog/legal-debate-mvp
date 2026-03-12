'use client';

/**
 * 推理链展示组件
 *
 * 在辩论页面中展示知识图谱推理引擎得出的推理结论，
 * 包括规则类型、置信度、推理说明和路径链。
 */

import React from 'react';
import type { InferenceResult } from '@/lib/knowledge-graph/reasoning/types';
import { RuleType } from '@/lib/knowledge-graph/reasoning/types';

interface ReasoningChainViewerProps {
  inferences: InferenceResult[];
  /** 是否可折叠，默认 true */
  collapsible?: boolean;
}

/** 规则类型标签 */
const RULE_LABELS: Record<RuleType, string> = {
  [RuleType.TRANSITIVE_SUPERSESSION]: '传递性替代',
  [RuleType.CONFLICT_PROPAGATION]: '冲突传播',
  [RuleType.COMPLETION_CHAIN]: '补全关系链',
};

/** 规则类型颜色 */
const RULE_COLORS: Record<RuleType, string> = {
  [RuleType.TRANSITIVE_SUPERSESSION]:
    'bg-orange-100 text-orange-800 border-orange-200',
  [RuleType.CONFLICT_PROPAGATION]: 'bg-red-100 text-red-800 border-red-200',
  [RuleType.COMPLETION_CHAIN]: 'bg-green-100 text-green-800 border-green-200',
};

/** 置信度颜色 */
function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-gray-500';
}

export function ReasoningChainViewer({
  inferences,
  collapsible = true,
}: ReasoningChainViewerProps) {
  const [expanded, setExpanded] = React.useState(!collapsible);

  if (inferences.length === 0) return null;

  return (
    <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
      {/* 标题栏 */}
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? () => setExpanded(v => !v) : undefined}
      >
        <div className='flex items-center gap-2'>
          <span className='text-blue-600 font-semibold text-sm'>
            ⚡ 知识图谱推理分析
          </span>
          <span className='px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full'>
            {inferences.length} 条推断
          </span>
        </div>
        {collapsible && (
          <span className='text-blue-400 text-sm'>
            {expanded ? '▲ 收起' : '▼ 展开'}
          </span>
        )}
      </div>

      {/* 推理结论列表 */}
      {expanded && (
        <div className='mt-3 space-y-3'>
          {inferences.map((inf, idx) => (
            <div
              key={idx}
              className='bg-white rounded-lg border border-blue-100 p-3'
            >
              {/* 规则标签 + 置信度 */}
              <div className='flex items-center justify-between mb-2'>
                <span
                  className={`inline-block px-2 py-0.5 text-xs rounded border font-medium ${RULE_COLORS[inf.ruleType] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {RULE_LABELS[inf.ruleType] ?? inf.ruleType}
                </span>
                <span
                  className={`text-xs font-semibold ${confidenceColor(inf.confidence)}`}
                >
                  置信度 {Math.round(inf.confidence * 100)}%
                </span>
              </div>

              {/* 推理说明 */}
              <p className='text-sm text-gray-700 leading-relaxed'>
                {inf.explanation}
              </p>

              {/* 推理路径 */}
              {inf.reasoningPath.length > 0 && (
                <div className='mt-2 flex items-center gap-1 flex-wrap'>
                  <span className='text-xs text-gray-500'>路径：</span>
                  {inf.reasoningPath.map((nodeId, i) => (
                    <React.Fragment key={nodeId}>
                      <span className='px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono'>
                        {nodeId.slice(0, 8)}…
                      </span>
                      {i < inf.reasoningPath.length - 1 && (
                        <span className='text-gray-400 text-xs'>→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}

          <p className='text-xs text-blue-500 mt-1'>
            以上推断由知识图谱推理引擎自动生成，仅供参考，请结合实际法律条文判断。
          </p>
        </div>
      )}
    </div>
  );
}
