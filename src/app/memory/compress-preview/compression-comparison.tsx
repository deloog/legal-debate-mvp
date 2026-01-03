/**
 * CompressionComparison - 压缩前后对比组件
 */

"use client";

export interface OriginalData {
  content: string;
  length: number;
}

export interface CompressedData {
  summary: string;
  keyInfo: Array<{ field: string; value: string; importance: number }>;
  length: number;
}

export interface CompressionComparisonProps {
  original: OriginalData;
  compressed: CompressedData;
}

/**
 * 压缩对比组件
 */
export function CompressionComparison(props: CompressionComparisonProps) {
  const { original, compressed } = props;

  return (
    <div className="compression-comparison mt-6">
      <h2 className="text-2xl font-bold mb-4">压缩前后对比</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 原始内容 */}
        <div className="p-4 bg-gray-50 rounded">
          <h3 className="text-lg font-semibold mb-2">原始内容</h3>
          <div className="text-sm text-gray-600 mb-2">
            长度: {original.length} 字符
          </div>
          <div className="bg-white p-3 rounded border max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm">
              {original.content}
            </pre>
          </div>
        </div>

        {/* 压缩后内容 */}
        <div className="p-4 bg-blue-50 rounded">
          <h3 className="text-lg font-semibold mb-2">压缩后内容</h3>
          <div className="text-sm text-gray-600 mb-2">
            长度: {compressed.length} 字符
          </div>

          {/* 摘要 */}
          <div className="mb-4">
            <div className="font-medium mb-1">摘要</div>
            <div className="bg-white p-3 rounded border max-h-40 overflow-y-auto">
              <p className="text-sm">{compressed.summary}</p>
            </div>
          </div>

          {/* 关键信息 */}
          <div>
            <div className="font-medium mb-1">关键信息</div>
            <div className="bg-white p-3 rounded border max-h-60 overflow-y-auto">
              {compressed.keyInfo.length > 0 ? (
                <ul className="space-y-2">
                  {compressed.keyInfo.map((item, index) => (
                    <li key={index} className="text-sm">
                      <div className="font-medium">{item.field}</div>
                      <div className="text-gray-600">{String(item.value)}</div>
                      <div className="text-xs text-blue-600">
                        重要性: {(item.importance * 100).toFixed(0)}%
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">无关键信息</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
