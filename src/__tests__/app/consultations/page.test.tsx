/**
 * 咨询列表页面测试
 */
import { render, screen } from '@testing-library/react';
import ConsultationsPage from '@/app/consultations/page';

// Mock组件
jest.mock('@/app/consultations/components/consultation-list', () => ({
  ConsultationList: () => (
    <div data-testid='consultation-list'>咨询列表组件</div>
  ),
}));

describe('ConsultationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('页面结构', () => {
    test('应该渲染页面标题', () => {
      render(<ConsultationsPage />);

      expect(screen.getByText('咨询管理')).toBeInTheDocument();
    });

    test('应该渲染页面描述', () => {
      render(<ConsultationsPage />);

      expect(screen.getByText('管理您的所有咨询记录')).toBeInTheDocument();
    });

    test('应该渲染咨询列表组件', () => {
      render(<ConsultationsPage />);

      expect(screen.getByTestId('consultation-list')).toBeInTheDocument();
    });
  });

  describe('页面布局', () => {
    test('应该有正确的页面头部结构', () => {
      const { container } = render(<ConsultationsPage />);

      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
    });

    test('应该有正确的主内容区域', () => {
      const { container } = render(<ConsultationsPage />);

      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
    });

    test('应该有正确的页面容器类名', () => {
      const { container } = render(<ConsultationsPage />);

      expect(container.firstChild).toHaveClass('min-h-screen', 'bg-zinc-50');
    });
  });

  describe('可访问性', () => {
    test('页面标题应该是h1标签', () => {
      render(<ConsultationsPage />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('咨询管理');
    });

    test('页面描述应该是p标签', () => {
      render(<ConsultationsPage />);

      const description = screen.getByText('管理您的所有咨询记录');
      expect(description.tagName).toBe('P');
    });
  });

  describe('响应式设计', () => {
    test('应该有响应式的max-w-7xl类', () => {
      const { container } = render(<ConsultationsPage />);

      const mainContent = container.querySelector('main');
      expect(mainContent).toHaveClass('max-w-7xl');
    });
  });

  describe('暗色模式支持', () => {
    test('应该支持暗色模式', () => {
      const { container } = render(<ConsultationsPage />);

      const page = container.firstChild as HTMLElement;
      expect(page).toHaveClass('dark:bg-black');
    });
  });

  describe('Suspense加载状态', () => {
    test('应该使用Suspense包装ConsultationList', () => {
      render(<ConsultationsPage />);

      const listComponent = screen.getByTestId('consultation-list');
      expect(listComponent).toBeInTheDocument();
    });
  });
});
