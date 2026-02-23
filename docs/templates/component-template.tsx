/**
 * React组件模板
 * 位置: src/app/{module}/components/ComponentName.tsx
 *
 * 使用说明:
 * 1. 复制此模板到目标位置
 * 2. 修改组件名称和业务逻辑
 * 3. 使用命名导出
 */

'use client';

import { useState, useCallback } from 'react';

// ============ 类型定义 ============

interface ComponentProps {
  /** 标题 */
  title: string;
  /** 初始数据 */
  initialData?: DataType[];
  /** 点击回调 */
  onAction?: (data: DataType) => void;
}

interface DataType {
  id: string;
  name: string;
  value: number;
}

// ============ 组件实现 ============

/**
 * 功能组件模板
 * 使用命名导出
 */
export function ComponentName({ title, initialData = [], onAction }: ComponentProps) {
  const [data, setData] = useState<DataType[]>(initialData);
  const [loading, setLoading] = useState(false);

  // 处理操作
  const handleAction = useCallback((item: DataType) => {
    if (onAction) {
      onAction(item);
    }
  }, [onAction]);

  // 异步操作示例
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: 实现数据获取逻辑
      // const response = await fetch('/api/data');
      // const result = await response.json();
      // setData(result);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className='component-name'>
      <h2>{title}</h2>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul>
          {data.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <button onClick={() => handleAction(item)}>
                Action
              </button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={fetchData} disabled={loading}>
        Refresh
      </button>
    </div>
  );
}

// ============ 样式 ============

// 如果使用CSS模块，创建同名的 .module.css 文件
// import styles from './ComponentName.module.css';

// 如果使用内联样式或Tailwind，按需添加
