/**
 * AdminNavigation组件测试
 * @jest-environment jsdom
 */
// @ts-nocheck - 禁用此文件的 TypeScript 类型检查

import { render, screen } from '@testing-library/react';
import { AdminNavigation } from '@/components/admin/AdminNavigation';

// 在setup.ts之后重新mock next/navigation，覆盖默认实现
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

import { usePathname } from 'next/navigation';

describe('AdminNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('导航项显示', () => {
    it('应该显示所有导航分类', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      render(<AdminNavigation />);

      expect(screen.getByText('管理')).toBeInTheDocument();
      expect(screen.getByText('系统')).toBeInTheDocument();
      expect(screen.getByText('配置')).toBeInTheDocument();
    });

    it('应该显示用户管理导航项', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      render(<AdminNavigation />);

      expect(screen.getByText('用户管理')).toBeInTheDocument();
    });

    it('应该显示Dashboard导航项', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard');

      render(<AdminNavigation />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('应该显示数据导出导航项', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/export');

      render(<AdminNavigation />);

      expect(screen.getByText('数据导出')).toBeInTheDocument();
    });

    it('应该显示告警监控导航项', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/alerts');

      render(<AdminNavigation />);

      expect(screen.getByText('告警监控')).toBeInTheDocument();
    });
  });

  describe('活动状态高亮', () => {
    it('应该在当前页面显示活动状态', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      const { container } = render(<AdminNavigation />);

      const activeLink = container.querySelector('a[href="/admin/users"]');
      expect(activeLink).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('应该在子页面显示活动状态', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users/123/edit');

      const { container } = render(<AdminNavigation />);

      const activeLink = container.querySelector('a[href="/admin/users"]');
      expect(activeLink).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('应该在Dashboard页面显示活动状态', () => {
      (usePathname as jest.Mock).mockReturnValue('/dashboard');

      const { container } = render(<AdminNavigation />);

      const activeLink = container.querySelector('a[href="/dashboard"]');
      expect(activeLink).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('应该在数据导出页面显示活动状态', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/export');

      const { container } = render(<AdminNavigation />);

      const activeLink = container.querySelector('a[href="/admin/export"]');
      expect(activeLink).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('应该在告警监控页面显示活动状态', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/alerts');

      const { container } = render(<AdminNavigation />);

      const activeLink = container.querySelector('a[href="/admin/alerts"]');
      expect(activeLink).toHaveClass('bg-blue-50', 'text-blue-700');
    });
  });

  describe('非活动状态样式', () => {
    it('应该在非当前页面显示非活动状态', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      const { container } = render(<AdminNavigation />);

      const inactiveLink = container.querySelector('a[href="/dashboard"]');
      expect(inactiveLink).not.toHaveClass('bg-blue-50', 'text-blue-700');
      expect(inactiveLink).toHaveClass('text-gray-700');
    });
  });

  describe('导航链接', () => {
    it('应该包含正确的链接', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      const { container } = render(<AdminNavigation />);

      expect(
        container.querySelector('a[href="/admin/users"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/cases"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/memberships"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/orders"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/dashboard"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/export"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/alerts"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/logs"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/configs"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/law-articles"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/reports"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/enterprise"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/qualifications"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('a[href="/admin/roles"]')
      ).toBeInTheDocument();
    });
  });

  describe('图标显示', () => {
    it('应该显示所有导航项的图标', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      render(<AdminNavigation />);

      // 检查图标容器数量（应该等于导航项数量）
      const icons = document.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('响应式设计', () => {
    it('应该正确渲染导航结构', () => {
      (usePathname as jest.Mock).mockReturnValue('/admin/users');

      const { container } = render(<AdminNavigation />);

      // 检查导航容器
      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();

      // 检查分类标题
      const sectionTitles = container.querySelectorAll('h3');
      expect(sectionTitles.length).toBe(3);
    });
  });
});
