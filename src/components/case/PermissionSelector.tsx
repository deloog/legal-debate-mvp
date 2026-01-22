import { ChangeEvent, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  CaseRole,
  CasePermission,
  CASE_PERMISSION_LABELS,
  getRoleDefaultPermissions,
} from '@/types/case-collaboration';

/**
 * 权限组接口
 */
interface PermissionGroup {
  name: string;
  permissions: CasePermission[];
}

/**
 * 权限组定义
 */
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: '案件管理',
    permissions: [
      CasePermission.VIEW_CASE,
      CasePermission.EDIT_CASE,
      CasePermission.DELETE_CASE,
    ],
  },
  {
    name: '时间线管理',
    permissions: [
      CasePermission.VIEW_TIMELINE,
      CasePermission.EDIT_TIMELINE,
      CasePermission.DELETE_TIMELINE,
    ],
  },
  {
    name: '法庭日程',
    permissions: [
      CasePermission.VIEW_SCHEDULES,
      CasePermission.EDIT_SCHEDULES,
      CasePermission.DELETE_SCHEDULES,
    ],
  },
  {
    name: '证据管理',
    permissions: [
      CasePermission.VIEW_EVIDENCE,
      CasePermission.EDIT_EVIDENCE,
      CasePermission.DELETE_EVIDENCE,
      CasePermission.UPLOAD_EVIDENCE,
    ],
  },
  {
    name: '文档管理',
    permissions: [
      CasePermission.VIEW_DOCUMENTS,
      CasePermission.EDIT_DOCUMENTS,
      CasePermission.DELETE_DOCUMENTS,
      CasePermission.UPLOAD_DOCUMENTS,
    ],
  },
  {
    name: '辩论管理',
    permissions: [
      CasePermission.VIEW_DEBATES,
      CasePermission.EDIT_DEBATES,
      CasePermission.DELETE_DEBATES,
    ],
  },
  {
    name: '法条引用',
    permissions: [
      CasePermission.VIEW_LEGAL_REFERENCES,
      CasePermission.EDIT_LEGAL_REFERENCES,
      CasePermission.DELETE_LEGAL_REFERENCES,
    ],
  },
  {
    name: '团队管理',
    permissions: [
      CasePermission.VIEW_TEAM_MEMBERS,
      CasePermission.ADD_TEAM_MEMBERS,
      CasePermission.EDIT_TEAM_MEMBERS,
      CasePermission.REMOVE_TEAM_MEMBERS,
    ],
  },
  {
    name: '沟通管理',
    permissions: [
      CasePermission.VIEW_DISCUSSIONS,
      CasePermission.POST_DISCUSSIONS,
      CasePermission.EDIT_DISCUSSIONS,
      CasePermission.DELETE_DISCUSSIONS,
    ],
  },
  {
    name: '数据导出',
    permissions: [CasePermission.EXPORT_DATA],
  },
];

/**
 * 权限选择器组件属性
 */
export interface PermissionSelectorProps {
  selectedRole: CaseRole;
  selectedPermissions: CasePermission[];
  onChange: (permissions: CasePermission[]) => void;
  disabled?: boolean;
}

/**
 * 权限选择器组件
 */
export function PermissionSelector({
  selectedRole,
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  const [useRoleDefaults, setUseRoleDefaults] = useState(true);

  /**
   * 处理角色切换
   */
  function handleRoleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const newRole = event.target.value as CaseRole;
    if (newRole && useRoleDefaults) {
      const defaultPermissions = getRoleDefaultPermissions(newRole);
      onChange(defaultPermissions);
    }
  }

  /**
   * 处理权限切换
   */
  function handlePermissionChange(
    permission: CasePermission,
    checked: boolean
  ): void {
    let newPermissions: CasePermission[];
    if (checked) {
      newPermissions = [...selectedPermissions, permission];
    } else {
      newPermissions = selectedPermissions.filter(p => p !== permission);
    }
    onChange(newPermissions);
  }

  /**
   * 处理权限组全选
   */
  function handleGroupSelect(group: PermissionGroup, checked: boolean): void {
    let newPermissions: CasePermission[];
    if (checked) {
      const groupPermissions = group.permissions.filter(
        p => !selectedPermissions.includes(p)
      );
      newPermissions = [...selectedPermissions, ...groupPermissions];
    } else {
      newPermissions = selectedPermissions.filter(
        p => !group.permissions.includes(p)
      );
    }
    onChange(newPermissions);
  }

  /**
   * 检查权限组是否全选
   */
  function isGroupSelected(group: PermissionGroup): boolean {
    return group.permissions.every(p => selectedPermissions.includes(p));
  }

  /**
   * 检查权限组是否部分选中
   */
  function isGroupIndeterminate(group: PermissionGroup): boolean {
    const selectedCount = group.permissions.filter(p =>
      selectedPermissions.includes(p)
    ).length;
    return selectedCount > 0 && selectedCount < group.permissions.length;
  }

  /**
   * 处理全选/全不选
   */
  function handleSelectAll(checked: boolean): void {
    if (checked) {
      const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);
      onChange(allPermissions);
    } else {
      onChange([]);
    }
  }

  /**
   * 检查是否全选
   */
  function isAllSelected(): boolean {
    const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);
    return allPermissions.every(p => selectedPermissions.includes(p));
  }

  /**
   * 检查是否部分选中
   */
  function isAllIndeterminate(): boolean {
    const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);
    const selectedCount = selectedPermissions.length;
    return selectedCount > 0 && selectedCount < allPermissions.length;
  }

  return (
    <div className='space-y-4'>
      {/* 角色选择 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          <Label htmlFor='role-select'>角色：</Label>
          <select
            id='role-select'
            value={selectedRole}
            onChange={handleRoleChange}
            disabled={disabled}
            className='px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
          >
            <option value={CaseRole.LEAD}>主办律师</option>
            <option value={CaseRole.ASSISTANT}>协办律师</option>
            <option value={CaseRole.PARALEGAL}>律师助理</option>
            <option value={CaseRole.OBSERVER}>观察者</option>
          </select>
        </div>
        <label className='flex items-center space-x-2'>
          <input
            type='checkbox'
            id='use-role-defaults'
            checked={useRoleDefaults}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setUseRoleDefaults(e.target.checked)
            }
            disabled={disabled}
            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
          />
          <span className='text-sm text-gray-700'>使用角色默认权限</span>
        </label>
      </div>

      {/* 全选/全不选 */}
      <label className='flex items-center space-x-2 text-sm font-medium text-gray-700'>
        <input
          type='checkbox'
          checked={isAllSelected()}
          ref={(element: HTMLInputElement | null) => {
            if (element) {
              element.indeterminate = isAllIndeterminate();
            }
          }}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleSelectAll(e.target.checked)
          }
          disabled={disabled || useRoleDefaults}
          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
        />
        全选
      </label>

      {/* 权限组 */}
      <div className='space-y-6'>
        {PERMISSION_GROUPS.map(group => (
          <div key={group.name} className='space-y-2'>
            <label className='flex items-center space-x-2 text-sm font-medium text-gray-700'>
              <input
                type='checkbox'
                checked={isGroupSelected(group)}
                ref={(element: HTMLInputElement | null) => {
                  if (element) {
                    element.indeterminate = isGroupIndeterminate(group);
                  }
                }}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleGroupSelect(group, e.target.checked)
                }
                disabled={disabled || useRoleDefaults}
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
              />
              {group.name}
            </label>
            <div className='ml-6 space-y-1.5'>
              {group.permissions.map(permission => (
                <label
                  key={permission}
                  className='flex items-center space-x-2 text-sm text-gray-600'
                >
                  <input
                    type='checkbox'
                    checked={selectedPermissions.includes(permission)}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handlePermissionChange(permission, e.target.checked)
                    }
                    disabled={disabled || useRoleDefaults}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
                  />
                  {CASE_PERMISSION_LABELS[permission] || permission}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
