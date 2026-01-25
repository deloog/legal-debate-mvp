/**
 * DiscussionItem 组件测试
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { DiscussionItem } from '@/components/discussion/DiscussionItem';
import {
  createTestDiscussion,
  createTestProps,
} from '../discussion/test-utils';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Pin: () => <div data-testid='pin-icon'>Pin</div>,
  PinOff: () => <div data-testid='pin-off-icon'>PinOff</div>,
  Edit: () => <div data-testid='edit-icon'>Edit</div>,
  Trash2: () => <div data-testid='trash-icon'>Trash</div>,
  User: () => <div data-testid='user-icon'>User</div>,
  Clock: () => <div data-testid='clock-icon'>Clock</div>,
  CheckCircle: () => <div data-testid='check-icon'>Check</div>,
}));

// Mock confirm
global.confirm = jest.fn(() => true);

describe('DiscussionItem 组件测试', () => {
  const defaultProps = {
    discussion: createTestDiscussion(),
    currentUserId: 'test-user-id-1',
    canEdit: true,
    canPin: true,
    canDelete: true,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onTogglePin: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该正确渲染讨论内容', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByText('这是一条测试讨论内容')).toBeInTheDocument();
      expect(screen.getByText('测试用户')).toBeInTheDocument();
    });

    it('应该显示作者头像（如果没有头像则显示默认图标）', () => {
      render(<DiscussionItem {...defaultProps} />);

      const defaultAvatars = screen.getAllByTestId('user-icon');
      expect(defaultAvatars.length).toBeGreaterThan(0);
    });

    it('应该显示提及用户', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('user2')).toBeInTheDocument();
    });

    it('应该显示创建时间', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('应该显示创建者标记', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByText('创建者')).toBeInTheDocument();
    });

    it('应该显示置顶标记', () => {
      const pinnedDiscussion = createTestDiscussion({ isPinned: true });
      render(
        <DiscussionItem {...defaultProps} discussion={pinnedDiscussion} />
      );

      expect(screen.getByText('置顶')).toBeInTheDocument();
    });

    it('应该显示metadata', () => {
      const discussionWithMetadata = createTestDiscussion({
        metadata: { priority: 'high', tags: ['重要'] },
      });
      render(
        <DiscussionItem {...defaultProps} discussion={discussionWithMetadata} />
      );

      expect(screen.getByText(/priority:/)).toBeInTheDocument();
      expect(screen.getByText(/tags:/)).toBeInTheDocument();
    });
  });

  describe('权限控制测试', () => {
    it('无权限时不应显示操作按钮', () => {
      const props = {
        ...defaultProps,
        canEdit: false,
        canPin: false,
        canDelete: false,
      };
      render(<DiscussionItem {...props} />);

      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trash-icon')).not.toBeInTheDocument();
    });

    it('有编辑权限时应显示编辑按钮', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    });

    it('有删除权限时应显示删除按钮', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });

    it('有置顶权限时应显示置顶按钮', () => {
      render(<DiscussionItem {...defaultProps} />);

      expect(screen.getByTestId('pin-icon')).toBeInTheDocument();
    });

    it('置顶时应显示取消置顶按钮', () => {
      const pinnedDiscussion = createTestDiscussion({ isPinned: true });
      render(
        <DiscussionItem {...defaultProps} discussion={pinnedDiscussion} />
      );

      expect(screen.getByTestId('pin-off-icon')).toBeInTheDocument();
    });
  });

  describe('交互测试', () => {
    it('点击编辑按钮应调用onEdit', () => {
      render(<DiscussionItem {...defaultProps} />);

      const editButton = screen.getByTestId('edit-icon').closest('button');
      if (editButton) {
        fireEvent.click(editButton);
      }

      expect(defaultProps.onEdit).toHaveBeenCalledWith(defaultProps.discussion);
    });

    it('点击删除按钮应弹出确认对话框', () => {
      render(<DiscussionItem {...defaultProps} />);

      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(global.confirm).toHaveBeenCalledWith('确定要删除这条讨论吗？');
    });

    it('确认删除应调用onDelete', () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      render(<DiscussionItem {...defaultProps} />);

      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(defaultProps.onDelete).toHaveBeenCalledWith(
        defaultProps.discussion.id
      );
    });

    it('取消删除不应调用onDelete', () => {
      (global.confirm as jest.Mock).mockReturnValue(false);
      render(<DiscussionItem {...defaultProps} />);

      const deleteButton = screen.getByTestId('trash-icon').closest('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(defaultProps.onDelete).not.toHaveBeenCalled();
    });

    it('点击置顶按钮应调用onTogglePin', () => {
      render(<DiscussionItem {...defaultProps} />);

      const pinButton = screen.getByTestId('pin-icon').closest('button');
      if (pinButton) {
        fireEvent.click(pinButton);
      }

      expect(defaultProps.onTogglePin).toHaveBeenCalledWith(
        defaultProps.discussion.id,
        true
      );
    });

    it('点击取消置顶按钮应调用onTogglePin', () => {
      const pinnedDiscussion = createTestDiscussion({ isPinned: true });
      render(
        <DiscussionItem {...defaultProps} discussion={pinnedDiscussion} />
      );

      const pinButton = screen.getByTestId('pin-off-icon').closest('button');
      if (pinButton) {
        fireEvent.click(pinButton);
      }

      expect(defaultProps.onTogglePin).toHaveBeenCalledWith(
        pinnedDiscussion.id,
        false
      );
    });
  });

  describe('边界情况测试', () => {
    it('空提及列表不应显示提及标签', () => {
      const discussionNoMentions = createTestDiscussion({ mentions: [] });
      render(
        <DiscussionItem {...defaultProps} discussion={discussionNoMentions} />
      );

      expect(screen.queryByText('user1')).not.toBeInTheDocument();
    });

    it('空metadata不应显示metadata区域', () => {
      const discussionEmptyMetadata = createTestDiscussion({
        metadata: null,
      });
      render(
        <DiscussionItem
          {...defaultProps}
          discussion={discussionEmptyMetadata}
        />
      );

      expect(screen.queryByText(/priority:/)).not.toBeInTheDocument();
    });

    it('更新过的讨论应显示"已编辑"标记', () => {
      const discussionEdited = createTestDiscussion({
        updatedAt: new Date('2024-01-02T10:00:00Z').toISOString(),
      });
      render(
        <DiscussionItem {...defaultProps} discussion={discussionEdited} />
      );

      expect(screen.getByText(/已编辑/)).toBeInTheDocument();
    });
  });
});
