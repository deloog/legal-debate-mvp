/**
 * GraphVisualizer 组件测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock D3 module before importing the component
jest.mock('d3', () => {
  return {
    select: jest.fn(() => ({
      append: jest.fn(() => ({
        selectAll: jest.fn(() => ({
          data: jest.fn(() => ({
            enter: jest.fn(() => ({
              append: jest.fn(() => ({
                attr: jest.fn().mockReturnThis(),
                style: jest.fn().mockReturnThis(),
                call: jest.fn().mockReturnThis(),
              })),
            })),
          })),
        })),
      })),
      attr: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
    })),
    forceSimulation: jest.fn(() => ({
      force: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      stop: jest.fn(),
    })),
    forceLink: jest.fn(() => ({
      id: jest.fn().mockReturnThis(),
      distance: jest.fn().mockReturnThis(),
      strength: jest.fn().mockReturnThis(),
    })),
    forceManyBody: jest.fn(() => ({
      strength: jest.fn().mockReturnThis(),
    })),
    forceCenter: jest.fn(() => ({
      x: jest.fn().mockReturnThis(),
      y: jest.fn().mockReturnThis(),
    })),
    forceCollide: jest.fn(() => ({
      radius: jest.fn().mockReturnThis(),
    })),
    forceX: jest.fn(() => ({
      strength: jest.fn().mockReturnThis(),
    })),
    forceY: jest.fn(() => ({
      strength: jest.fn().mockReturnThis(),
    })),
    drag: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
    })),
    zoom: jest.fn(() => ({
      scaleExtent: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
    })),
    zoomIdentity: { x: 0, y: 0, k: 1, toString: () => 'mock' },
  };
});

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  GraphVisualizer,
  GraphNode,
  GraphLink,
} from '@/components/knowledge-graph/GraphVisualizer';

describe('GraphVisualizer 组件', () => {
  const mockOnNodeClick = jest.fn();
  const mockOnNodeDoubleClick = jest.fn();

  const mockNodes: GraphNode[] = [
    {
      id: '1',
      lawName: '民法典',
      articleNumber: '1',
      category: 'CIVIL',
    },
    {
      id: '2',
      lawName: '刑法',
      articleNumber: '1',
      category: 'CRIMINAL',
    },
  ];

  const mockLinks: GraphLink[] = [
    {
      source: '1',
      target: '2',
      relationType: 'CITES',
      strength: 0.8,
      confidence: 0.9,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功渲染图谱可视化组件', () => {
    render(
      <GraphVisualizer
        nodes={mockNodes}
        links={mockLinks}
        onNodeClick={mockOnNodeClick}
        onNodeDoubleClick={mockOnNodeDoubleClick}
      />
    );

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('应该显示正确的节点和边数量', () => {
    render(<GraphVisualizer nodes={mockNodes} links={mockLinks} />);

    expect(screen.getByText(/节点:/)).toBeInTheDocument();
    expect(screen.getByText(/边:/)).toBeInTheDocument();
  });

  it('应该显示图例', () => {
    render(<GraphVisualizer nodes={mockNodes} links={mockLinks} />);

    expect(screen.getByText('关系类型')).toBeInTheDocument();
    expect(screen.getByText('法律分类')).toBeInTheDocument();
    expect(screen.getByText('引用')).toBeInTheDocument();
  });

  it('应该处理中心节点高亮', () => {
    render(
      <GraphVisualizer nodes={mockNodes} links={mockLinks} centerNodeId='1' />
    );

    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('应该处理空数据', () => {
    render(<GraphVisualizer nodes={[]} links={[]} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('应该处理过滤功能', () => {
    const { rerender } = render(
      <GraphVisualizer
        nodes={mockNodes}
        links={mockLinks}
        filterCategory='CIVIL'
      />
    );

    expect(document.querySelector('svg')).toBeInTheDocument();

    rerender(
      <GraphVisualizer
        nodes={mockNodes}
        links={mockLinks}
        filterCategory='CRIMINAL'
      />
    );

    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
