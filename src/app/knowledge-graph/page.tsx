/**
 * 知识图谱浏览器页面
 *
 * 路由：/knowledge-graph
 *
 * 功能：
 * 1. 展示知识图谱浏览器组件
 * 2. 提供页面标题和描述
 * 3. 响应式布局
 */

import { Metadata } from 'next';
import { KnowledgeGraphBrowser } from '@/components/knowledge-graph/KnowledgeGraphBrowser';

/**
 * 页面元数据
 */
export const metadata: Metadata = {
  title: '知识图谱浏览器 - 律伴AI助手',
  description: '浏览和探索法条之间的关系网络，支持搜索、过滤和导出功能',
};

/**
 * 知识图谱浏览器页面
 */
export default function KnowledgeGraphPage() {
  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页面标题 */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>
          知识图谱浏览器
        </h1>
        <p className='text-gray-600'>
          浏览和探索法条之间的关系网络，发现法律条文的内在联系
        </p>
      </div>

      {/* 知识图谱浏览器组件 */}
      <KnowledgeGraphBrowser />

      {/* 使用说明 */}
      <div className='mt-8 bg-blue-50 p-6 rounded-lg'>
        <h2 className='text-lg font-semibold text-blue-900 mb-3'>使用说明</h2>
        <ul className='space-y-2 text-sm text-blue-800'>
          <li>
            • <strong>搜索</strong>：在搜索框中输入法条名称或条文号进行搜索
          </li>
          <li>
            • <strong>过滤</strong>：使用分类和关系类型下拉框过滤图谱数据
          </li>
          <li>
            • <strong>浏览</strong>：点击图谱中的节点查看法条详情
          </li>
          <li>
            • <strong>导出</strong>：点击导出按钮将当前图谱数据保存为JSON文件
          </li>
          <li>
            • <strong>分页</strong>：使用底部的分页控件浏览更多法条
          </li>
        </ul>
      </div>
    </div>
  );
}
