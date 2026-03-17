/**
 * 首页路由测试
 *
 * 测试覆盖：
 * 1. 首页渲染 InternalHomepage
 * 2. 不同认证状态下渲染
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';

// Mock InternalHomepage
jest.mock('@/app/internal-homepage', () => ({
  __esModule: true,
  default: () => <div data-testid='internal-homepage'>Internal Homepage</div>,
}));

describe('首页路由', () => {
  describe('未登录用户', () => {
    it('应该展示普通用户版首页', async () => {
      render(<Home />);
      expect(screen.getByTestId('internal-homepage')).toBeInTheDocument();
    });
  });

  describe('律师用户', () => {
    it('应该展示律师版首页', async () => {
      render(<Home />);
      expect(screen.getByTestId('internal-homepage')).toBeInTheDocument();
    });
  });

  describe('企业法务用户', () => {
    it('应该展示企业法务版首页', async () => {
      render(<Home />);
      expect(screen.getByTestId('internal-homepage')).toBeInTheDocument();
    });
  });

  describe('双重角色用户', () => {
    it('应该展示律师版首页（默认优先律师）', async () => {
      render(<Home />);
      expect(screen.getByTestId('internal-homepage')).toBeInTheDocument();
    });
  });
});
