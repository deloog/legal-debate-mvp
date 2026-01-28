/**
 * 创建咨询页面测试
 */
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import CreateConsultationPage from '@/app/consultations/create/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock组件
jest.mock('@/app/consultations/create/components/consultation-form', () => ({
  ConsultationForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: () => Promise<void>;
    onCancel: () => void;
  }) => (
    <div data-testid='consultation-form'>
      <button data-testid='submit-button' onClick={onSubmit}>
        提交
      </button>
      <button data-testid='cancel-button' onClick={onCancel}>
        取消
      </button>
    </div>
  ),
}));

describe('CreateConsultationPage', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('页面结构', () => {
    test('应该渲染页面标题', () => {
      render(<CreateConsultationPage />);

      expect(screen.getByText('创建咨询')).toBeInTheDocument();
    });

    test('应该渲染页面描述', () => {
      render(<CreateConsultationPage />);

      expect(screen.getByText('录入新的咨询信息')).toBeInTheDocument();
    });

    test('应该渲染咨询表单组件', () => {
      render(<CreateConsultationPage />);

      expect(screen.getByTestId('consultation-form')).toBeInTheDocument();
    });
  });

  describe('页面布局', () => {
    test('应该有正确的页面头部结构', () => {
      const { container } = render(<CreateConsultationPage />);

      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
    });

    test('应该有正确的主内容区域', () => {
      const { container } = render(<CreateConsultationPage />);

      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
    });

    test('应该有正确的页面容器类名', () => {
      const { container } = render(<CreateConsultationPage />);

      expect(container.firstChild).toHaveClass('min-h-screen', 'bg-zinc-50');
    });

    test('主内容区应该有max-w-4xl类', () => {
      const { container } = render(<CreateConsultationPage />);

      const main = container.querySelector('main');
      expect(main).toHaveClass('max-w-4xl');
    });
  });

  describe('可访问性', () => {
    test('页面标题应该是h1标签', () => {
      render(<CreateConsultationPage />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('创建咨询');
    });

    test('页面描述应该是p标签', () => {
      render(<CreateConsultationPage />);

      const description = screen.getByText('录入新的咨询信息');
      expect(description.tagName).toBe('P');
    });
  });

  describe('导航功能', () => {
    test('提交成功后应该跳转到咨询列表', async () => {
      render(<CreateConsultationPage />);

      const submitButton = screen.getByTestId('submit-button');
      await submitButton.click();

      expect(mockPush).toHaveBeenCalledWith('/consultations');
    });

    test('取消操作应该跳转到咨询列表', () => {
      render(<CreateConsultationPage />);

      const cancelButton = screen.getByTestId('cancel-button');
      cancelButton.click();

      expect(mockPush).toHaveBeenCalledWith('/consultations');
    });
  });

  describe('暗色模式支持', () => {
    test('应该支持暗色模式', () => {
      const { container } = render(<CreateConsultationPage />);

      const page = container.firstChild as HTMLElement;
      expect(page).toHaveClass('dark:bg-black');
    });
  });

  describe('响应式设计', () => {
    test('应该有正确的响应式类名', () => {
      const { container } = render(<CreateConsultationPage />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('px-6', 'py-4');

      const main = container.querySelector('main');
      expect(main).toHaveClass('px-6', 'py-8');
    });
  });
});
