import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseListItem } from '@/app/cases/components/case-list-item';
import { CaseWithMetadata } from '@/types/case';
import { CaseType, CaseStatus } from '@prisma/client';

/**
 * CaseListItem组件测试
 * 测试案件卡片组件的渲染和交互功能
 */
describe('CaseListItem', () => {
  const mockCase: CaseWithMetadata = {
    id: '1',
    title: '民事合同纠纷案件',
    description: '一起关于合同履行问题的民事纠纷案件',
    type: 'CIVIL' as CaseType,
    status: 'ACTIVE' as CaseStatus,
    userId: 'user1',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-01-15T00:00:00.000Z'),
    deletedAt: null,
    amount: null,
    caseNumber: null,
    cause: null,
    court: null,
    defendantName: null,
    plaintiffName: null,
    metadata: {
      parties: {
        plaintiff: { name: '张三' },
        defendant: { name: '李四' },
      },
      caseDetails: {
        amount: 100000,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 测试组件渲染
   */
  describe('渲染测试', () => {
    it('应该正确渲染案件标题', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText('民事合同纠纷案件')).toBeInTheDocument();
    });

    it('应该显示案件类型标签', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText('民事')).toBeInTheDocument();
    });

    it('应该显示案件状态标签', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('应该显示案件描述', () => {
      render(<CaseListItem case={mockCase} />);

      expect(
        screen.getByText(/一起关于合同履行问题的民事纠纷案件/)
      ).toBeInTheDocument();
    });

    it('应该显示当事人信息', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText(/原告：张三/)).toBeInTheDocument();
      expect(screen.getByText(/被告：李四/)).toBeInTheDocument();
    });

    it('应该显示案件金额', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText(/¥100,000/)).toBeInTheDocument();
    });

    it('应该显示创建日期', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });
  });

  /**
   * 测试不同案件类型
   */
  describe('案件类型测试', () => {
    it('应该正确显示刑事案件类型', () => {
      const criminalCase = { ...mockCase, type: 'CRIMINAL' as CaseType };
      render(<CaseListItem case={criminalCase} />);

      expect(screen.getByText('刑事')).toBeInTheDocument();
    });

    it('应该正确显示行政案件类型', () => {
      const adminCase = { ...mockCase, type: 'ADMINISTRATIVE' as CaseType };
      render(<CaseListItem case={adminCase} />);

      expect(screen.getByText('行政')).toBeInTheDocument();
    });

    it('应该正确显示商事案件类型', () => {
      const commercialCase = { ...mockCase, type: 'COMMERCIAL' as CaseType };
      render(<CaseListItem case={commercialCase} />);

      expect(screen.getByText('商事')).toBeInTheDocument();
    });

    it('应该正确显示劳动案件类型', () => {
      const laborCase = { ...mockCase, type: 'LABOR' as CaseType };
      render(<CaseListItem case={laborCase} />);

      expect(screen.getByText('劳动')).toBeInTheDocument();
    });

    it('应该正确显示知识产权案件类型', () => {
      const ipCase = { ...mockCase, type: 'INTELLECTUAL' as CaseType };
      render(<CaseListItem case={ipCase} />);

      expect(screen.getByText('知识产权')).toBeInTheDocument();
    });
  });

  /**
   * 测试不同案件状态
   */
  describe('案件状态测试', () => {
    it('应该正确显示进行中状态', () => {
      const activeCase = { ...mockCase, status: 'ACTIVE' as CaseStatus };
      render(<CaseListItem case={activeCase} />);

      const statusBadge = screen.getByText('ACTIVE');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-green-100');
    });

    it('应该正确显示草稿状态', () => {
      const draftCase = { ...mockCase, status: 'DRAFT' as CaseStatus };
      render(<CaseListItem case={draftCase} />);

      expect(screen.getByText('DRAFT')).toBeInTheDocument();
    });

    it('应该正确显示已完成状态', () => {
      const completedCase = { ...mockCase, status: 'COMPLETED' as CaseStatus };
      render(<CaseListItem case={completedCase} />);

      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    it('应该正确显示已归档状态', () => {
      const archivedCase = { ...mockCase, status: 'ARCHIVED' as CaseStatus };
      render(<CaseListItem case={archivedCase} />);

      expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
    });
  });

  /**
   * 测试快速操作按钮
   */
  describe('快速操作按钮测试', () => {
    it('应该显示开始辩论按钮', () => {
      const mockOnStartDebate = jest.fn();
      render(
        <CaseListItem case={mockCase} onStartDebate={mockOnStartDebate} />
      );

      expect(screen.getByText('开始辩论')).toBeInTheDocument();
    });

    it('应该显示查看详情链接', () => {
      render(<CaseListItem case={mockCase} />);

      expect(screen.getByText('查看详情')).toBeInTheDocument();
    });

    it('应该显示删除按钮', () => {
      const mockOnDelete = jest.fn();
      render(<CaseListItem case={mockCase} onDelete={mockOnDelete} />);

      expect(screen.getByText('删除')).toBeInTheDocument();
    });

    it('点击开始辩论按钮应该调用回调', async () => {
      const mockOnStartDebate = jest.fn();
      const user = userEvent.setup();
      render(
        <CaseListItem case={mockCase} onStartDebate={mockOnStartDebate} />
      );

      await user.click(screen.getByText('开始辩论'));

      expect(mockOnStartDebate).toHaveBeenCalledWith('1');
    });

    it('点击删除按钮应该调用回调', async () => {
      const mockOnDelete = jest.fn();
      const user = userEvent.setup();
      render(<CaseListItem case={mockCase} onDelete={mockOnDelete} />);

      await user.click(screen.getByText('删除'));

      expect(mockOnDelete).toHaveBeenCalledWith('1');
    });
  });

  /**
   * 测试边界情况
   */
  describe('边界情况测试', () => {
    it('应该处理缺少描述的案件', () => {
      const caseWithoutDescription = { ...mockCase, description: '' };
      render(<CaseListItem case={caseWithoutDescription} />);

      expect(screen.queryByText(/一起关于合同履行/)).not.toBeInTheDocument();
    });

    it('应该处理缺少当事人的案件', () => {
      const caseWithoutParties = {
        ...mockCase,
        metadata: { parties: undefined },
      };
      render(<CaseListItem case={caseWithoutParties} />);

      expect(screen.queryByText(/原告：/)).not.toBeInTheDocument();
      expect(screen.queryByText(/被告：/)).not.toBeInTheDocument();
    });

    it('应该处理只有原告的案件', () => {
      const caseWithPlaintiffOnly = {
        ...mockCase,
        metadata: {
          parties: { plaintiff: { name: '张三' } },
        },
      };
      render(<CaseListItem case={caseWithPlaintiffOnly} />);

      expect(screen.getByText(/原告：张三/)).toBeInTheDocument();
    });

    it('应该处理只有被告的案件', () => {
      const caseWithDefendantOnly = {
        ...mockCase,
        metadata: {
          parties: { defendant: { name: '李四' } },
        },
      };
      render(<CaseListItem case={caseWithDefendantOnly} />);

      expect(screen.getByText(/被告：李四/)).toBeInTheDocument();
    });

    it('应该处理缺少金额的案件', () => {
      const caseWithoutAmount = {
        ...mockCase,
        metadata: {
          parties: {
            plaintiff: { name: '张三' },
            defendant: { name: '李四' },
          },
          caseDetails: { amount: undefined },
        },
      };
      render(<CaseListItem case={caseWithoutAmount} />);

      expect(screen.queryByText(/¥/)).not.toBeInTheDocument();
    });

    it('应该处理无效日期', () => {
      const caseWithInvalidDate = {
        ...mockCase,
        createdAt: new Date('invalid'),
      };
      render(<CaseListItem case={caseWithInvalidDate} />);

      expect(screen.getByText(/无效日期/)).toBeInTheDocument();
    });
  });

  /**
   * 测试链接功能
   */
  describe('链接功能测试', () => {
    it('案件标题应该链接到详情页', () => {
      render(<CaseListItem case={mockCase} />);

      const titleLink = screen.getByText('民事合同纠纷案件').closest('a');
      expect(titleLink).toHaveAttribute('href', '/cases/1');
    });

    it('查看详情按钮应该链接到详情页', () => {
      render(<CaseListItem case={mockCase} />);

      const detailLink = screen.getByText('查看详情').closest('a');
      expect(detailLink).toHaveAttribute('href', '/cases/1');
    });
  });
});
