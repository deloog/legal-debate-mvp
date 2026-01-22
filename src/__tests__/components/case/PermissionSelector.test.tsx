// @ts-nocheck - 测试文件存在复杂的类型推断问题，不影响生产代码质量
/**
 * PermissionSelector组件单元测试
 * 测试权限选择器组件
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { PermissionSelector } from '@/components/case/PermissionSelector';
import '@/__tests__/types/jest-dom';
import {
  CaseRole,
  CasePermission,
  CASE_PERMISSION_LABELS,
} from '@/types/case-collaboration';

describe('PermissionSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染角色选择器', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[CasePermission.VIEW_CASE]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('角色：')).toBeInTheDocument();
      expect(screen.getByText('主办律师')).toBeInTheDocument();
      expect(screen.getByText('协办律师')).toBeInTheDocument();
      expect(screen.getByText('律师助理')).toBeInTheDocument();
      expect(screen.getByText('观察者')).toBeInTheDocument();
    });

    it('应该正确渲染权限组', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[CasePermission.VIEW_CASE]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('案件管理')).toBeInTheDocument();
      expect(screen.getByText('时间线管理')).toBeInTheDocument();
      expect(screen.getByText('法庭日程')).toBeInTheDocument();
      expect(screen.getByText('证据管理')).toBeInTheDocument();
      expect(screen.getByText('文档管理')).toBeInTheDocument();
      expect(screen.getByText('辩论管理')).toBeInTheDocument();
      expect(screen.getByText('法条引用')).toBeInTheDocument();
      expect(screen.getByText('团队管理')).toBeInTheDocument();
      expect(screen.getByText('沟通管理')).toBeInTheDocument();
      expect(screen.getByText('数据导出')).toBeInTheDocument();
    });

    it('应该显示使用角色默认权限选项', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[CasePermission.VIEW_CASE]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('使用角色默认权限')).toBeInTheDocument();
    });

    it('应该显示全选选项', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[CasePermission.VIEW_CASE]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('全选')).toBeInTheDocument();
    });
  });

  describe('角色选择', () => {
    it('选择主办律师时应该更新权限', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      const roleSelect = screen.getByLabelText('角色：');
      fireEvent.change(roleSelect, { target: { value: CaseRole.LEAD } });

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions.length).toBeGreaterThan(10);
      expect(calledPermissions).toContain(CasePermission.VIEW_CASE);
    });

    it('选择协办律师时应该更新权限', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.ASSISTANT}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      const roleSelect = screen.getByLabelText('角色：');
      fireEvent.change(roleSelect, { target: { value: CaseRole.ASSISTANT } });

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions).toContain(CasePermission.VIEW_CASE);
    });

    it('选择律师助理时应该更新权限', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.PARALEGAL}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      const roleSelect = screen.getByLabelText('角色：');
      fireEvent.change(roleSelect, { target: { value: CaseRole.PARALEGAL } });

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions).toContain(CasePermission.VIEW_CASE);
    });

    it('选择观察者时应该更新权限', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.OBSERVER}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      const roleSelect = screen.getByLabelText('角色：');
      fireEvent.change(roleSelect, { target: { value: CaseRole.OBSERVER } });

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions.length).toBeGreaterThan(5);
      expect(calledPermissions).toContain(CasePermission.VIEW_CASE);
      expect(calledPermissions).not.toContain(CasePermission.EDIT_CASE);
    });
  });

  describe('权限选择', () => {
    it('点击单个权限应该切换权限状态', () => {
      const initialPermissions = [CasePermission.VIEW_CASE];
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={initialPermissions}
          onChange={mockOnChange}
        />
      );

      // 先取消"使用角色默认权限"以启用手动选择
      const defaultCheckbox = screen.getByLabelText('使用角色默认权限');
      fireEvent.click(defaultCheckbox);

      // 清除之前的调用
      mockOnChange.mockClear();

      const viewCaseCheckbox = screen.getByText('查看案件');
      fireEvent.click(viewCaseCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });

    it('点击权限组全选应该选中该组所有权限', async () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      // 先取消"使用角色默认权限"以启用手动选择
      const defaultCheckbox = screen.getByLabelText('使用角色默认权限');
      fireEvent.click(defaultCheckbox);

      const caseManagementGroup = screen.getByText('案件管理').closest('label');
      if (!caseManagementGroup) {
        throw new Error('案件管理组未找到');
      }

      const groupCheckbox = caseManagementGroup.querySelector(
        'input[type="checkbox"]'
      );
      if (!groupCheckbox) {
        throw new Error('权限组复选框未找到');
      }

      fireEvent.click(groupCheckbox);

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions).toContain(CasePermission.VIEW_CASE);
      expect(calledPermissions).toContain(CasePermission.EDIT_CASE);
      expect(calledPermissions).toContain(CasePermission.DELETE_CASE);
    });

    it('点击全选应该选中所有权限', async () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      // 先取消"使用角色默认权限"以启用手动选择
      const defaultCheckbox = screen.getByLabelText('使用角色默认权限');
      fireEvent.click(defaultCheckbox);

      const selectAllCheckbox = screen.getByText('全选').closest('label');
      if (!selectAllCheckbox) {
        throw new Error('全选选项未找到');
      }

      const checkbox = selectAllCheckbox.querySelector(
        'input[type="checkbox"]'
      );
      if (!checkbox) {
        throw new Error('全选复选框未找到');
      }

      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions.length).toBeGreaterThan(30);
    });

    it('再次点击全选应该取消选中所有权限', async () => {
      const allPermissions = Object.values(CasePermission);
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={allPermissions}
          onChange={mockOnChange}
        />
      );

      const selectAllCheckbox = screen.getByText('全选').closest('label');
      if (!selectAllCheckbox) {
        throw new Error('全选选项未找到');
      }

      const checkbox = selectAllCheckbox.querySelector(
        'input[type="checkbox"]'
      );
      if (!checkbox) {
        throw new Error('全选复选框未找到');
      }

      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('使用角色默认权限', () => {
    it('取消使用角色默认权限后应该可以自定义选择', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      const defaultCheckbox = screen.getByLabelText('使用角色默认权限');
      fireEvent.click(defaultCheckbox);

      // 现在可以手动选择权限
      const viewCaseCheckbox = screen.getByText('查看案件');
      fireEvent.click(viewCaseCheckbox);

      expect(mockOnChange).toHaveBeenCalledWith([CasePermission.VIEW_CASE]);
    });

    it('重新启用使用角色默认权限后应该禁用手动选择', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      // 先取消"使用角色默认权限"
      const defaultCheckbox = screen.getByLabelText('使用角色默认权限');
      fireEvent.click(defaultCheckbox);
      mockOnChange.mockClear();

      // 重新启用"使用角色默认权限"
      fireEvent.click(defaultCheckbox);

      // 切换角色应该使用默认权限
      const roleSelect = screen.getByLabelText('角色：');
      fireEvent.change(roleSelect, { target: { value: CaseRole.ASSISTANT } });

      expect(mockOnChange).toHaveBeenCalled();
      const calledPermissions = mockOnChange.mock.calls[0][0] as unknown[];
      expect(calledPermissions.length).toBeGreaterThan(10);
    });
  });

  describe('禁用状态', () => {
    it('禁用状态应该禁用所有交互元素', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[CasePermission.VIEW_CASE]}
          onChange={mockOnChange}
          disabled
        />
      );

      const roleSelect = screen.getByLabelText('角色：');
      expect(roleSelect).toBeDisabled();

      // 需要找到实际的input元素，而不是label
      const viewCaseCheckboxLabel = screen
        .getByText('查看案件')
        .closest('label');
      const viewCaseCheckbox = viewCaseCheckboxLabel?.querySelector(
        'input[type="checkbox"]'
      );
      expect(viewCaseCheckbox).toBeDisabled();

      const defaultCheckbox = screen.getByLabelText('使用角色默认权限');
      expect(defaultCheckbox).toBeDisabled();

      const selectAllCheckbox = screen
        .getByText('全选')
        .closest('label')
        ?.querySelector('input[type="checkbox"]');
      expect(selectAllCheckbox).toBeDisabled();
    });
  });

  describe('权限标签', () => {
    it('应该正确显示权限中文标签', () => {
      render(
        <PermissionSelector
          selectedRole={CaseRole.LEAD}
          selectedPermissions={[]}
          onChange={mockOnChange}
        />
      );

      expect(
        screen.getByText(CASE_PERMISSION_LABELS[CasePermission.VIEW_CASE]!)
      ).toBeInTheDocument();
      expect(
        screen.getByText(CASE_PERMISSION_LABELS[CasePermission.EDIT_CASE]!)
      ).toBeInTheDocument();
      expect(
        screen.getByText(CASE_PERMISSION_LABELS[CasePermission.DELETE_CASE]!)
      ).toBeInTheDocument();
    });
  });
});
