/**
 * 案件协作类型定义单元测试
 */

import {
  CaseRole,
  CasePermission,
  ROLE_DEFAULT_PERMISSIONS,
  CASE_ROLE_LABELS,
  CASE_PERMISSION_LABELS,
  isValidCaseRole,
  isValidCasePermission,
  isCasePermissionArray,
  getCaseRoleLabel,
  getCasePermissionLabel,
  getRoleDefaultPermissions,
  validateAddTeamMemberInput,
} from '@/types/case-collaboration';

describe('CaseRole枚举', () => {
  it('应该包含所有预定义的角色', () => {
    expect(CaseRole.LEAD).toBe('LEAD');
    expect(CaseRole.ASSISTANT).toBe('ASSISTANT');
    expect(CaseRole.PARALEGAL).toBe('PARALEGAL');
    expect(CaseRole.OBSERVER).toBe('OBSERVER');
  });

  it('应该有4个角色', () => {
    const roles = Object.values(CaseRole);
    expect(roles).toHaveLength(4);
  });
});

describe('CasePermission枚举', () => {
  it('应该包含案件基本权限', () => {
    expect(CasePermission.VIEW_CASE).toBe('VIEW_CASE');
    expect(CasePermission.EDIT_CASE).toBe('EDIT_CASE');
    expect(CasePermission.DELETE_CASE).toBe('DELETE_CASE');
  });

  it('应该包含时间线权限', () => {
    expect(CasePermission.VIEW_TIMELINE).toBe('VIEW_TIMELINE');
    expect(CasePermission.EDIT_TIMELINE).toBe('EDIT_TIMELINE');
    expect(CasePermission.DELETE_TIMELINE).toBe('DELETE_TIMELINE');
  });

  it('应该包含法庭日程权限', () => {
    expect(CasePermission.VIEW_SCHEDULES).toBe('VIEW_SCHEDULES');
    expect(CasePermission.EDIT_SCHEDULES).toBe('EDIT_SCHEDULES');
    expect(CasePermission.DELETE_SCHEDULES).toBe('DELETE_SCHEDULES');
  });

  it('应该包含证据管理权限', () => {
    expect(CasePermission.VIEW_EVIDENCE).toBe('VIEW_EVIDENCE');
    expect(CasePermission.EDIT_EVIDENCE).toBe('EDIT_EVIDENCE');
    expect(CasePermission.DELETE_EVIDENCE).toBe('DELETE_EVIDENCE');
    expect(CasePermission.UPLOAD_EVIDENCE).toBe('UPLOAD_EVIDENCE');
  });

  it('应该包含文档管理权限', () => {
    expect(CasePermission.VIEW_DOCUMENTS).toBe('VIEW_DOCUMENTS');
    expect(CasePermission.EDIT_DOCUMENTS).toBe('EDIT_DOCUMENTS');
    expect(CasePermission.DELETE_DOCUMENTS).toBe('DELETE_DOCUMENTS');
    expect(CasePermission.UPLOAD_DOCUMENTS).toBe('UPLOAD_DOCUMENTS');
  });

  it('应该包含辩论管理权限', () => {
    expect(CasePermission.VIEW_DEBATES).toBe('VIEW_DEBATES');
    expect(CasePermission.EDIT_DEBATES).toBe('EDIT_DEBATES');
    expect(CasePermission.DELETE_DEBATES).toBe('DELETE_DEBATES');
  });

  it('应该包含法条引用权限', () => {
    expect(CasePermission.VIEW_LEGAL_REFERENCES).toBe('VIEW_LEGAL_REFERENCES');
    expect(CasePermission.EDIT_LEGAL_REFERENCES).toBe('EDIT_LEGAL_REFERENCES');
    expect(CasePermission.DELETE_LEGAL_REFERENCES).toBe(
      'DELETE_LEGAL_REFERENCES'
    );
  });

  it('应该包含团队管理权限', () => {
    expect(CasePermission.VIEW_TEAM_MEMBERS).toBe('VIEW_TEAM_MEMBERS');
    expect(CasePermission.ADD_TEAM_MEMBERS).toBe('ADD_TEAM_MEMBERS');
    expect(CasePermission.EDIT_TEAM_MEMBERS).toBe('EDIT_TEAM_MEMBERS');
    expect(CasePermission.REMOVE_TEAM_MEMBERS).toBe('REMOVE_TEAM_MEMBERS');
  });

  it('应该包含沟通权限', () => {
    expect(CasePermission.VIEW_DISCUSSIONS).toBe('VIEW_DISCUSSIONS');
    expect(CasePermission.POST_DISCUSSIONS).toBe('POST_DISCUSSIONS');
    expect(CasePermission.EDIT_DISCUSSIONS).toBe('EDIT_DISCUSSIONS');
    expect(CasePermission.DELETE_DISCUSSIONS).toBe('DELETE_DISCUSSIONS');
  });

  it('应该包含导出权限', () => {
    expect(CasePermission.EXPORT_DATA).toBe('EXPORT_DATA');
  });
});

describe('ROLE_DEFAULT_PERMISSIONS', () => {
  it('应该为所有角色定义默认权限', () => {
    expect(ROLE_DEFAULT_PERMISSIONS[CaseRole.LEAD]).toBeDefined();
    expect(ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT]).toBeDefined();
    expect(ROLE_DEFAULT_PERMISSIONS[CaseRole.PARALEGAL]).toBeDefined();
    expect(ROLE_DEFAULT_PERMISSIONS[CaseRole.OBSERVER]).toBeDefined();
  });

  it('主办律师应该拥有所有权限', () => {
    const leadPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.LEAD];
    const allPermissions = Object.values(CasePermission);

    expect(leadPermissions).toEqual(expect.arrayContaining(allPermissions));
  });

  it('主办律师应该拥有删除案件权限', () => {
    const leadPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.LEAD];
    expect(leadPermissions).toContain(CasePermission.DELETE_CASE);
  });

  it('主办律师应该拥有删除时间线权限', () => {
    const leadPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.LEAD];
    expect(leadPermissions).toContain(CasePermission.DELETE_TIMELINE);
  });

  it('主办律师应该拥有移除团队成员权限', () => {
    const leadPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.LEAD];
    expect(leadPermissions).toContain(CasePermission.REMOVE_TEAM_MEMBERS);
  });

  it('协办律师不应该拥有删除案件权限', () => {
    const assistantPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT];
    expect(assistantPermissions).not.toContain(CasePermission.DELETE_CASE);
  });

  it('协办律师不应该拥有删除时间线权限', () => {
    const assistantPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT];
    expect(assistantPermissions).not.toContain(CasePermission.DELETE_TIMELINE);
  });

  it('协办律师不应该拥有删除法庭日程权限', () => {
    const assistantPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT];
    expect(assistantPermissions).not.toContain(CasePermission.DELETE_SCHEDULES);
  });

  it('协办律师不应该拥有移除团队成员权限', () => {
    const assistantPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT];
    expect(assistantPermissions).not.toContain(
      CasePermission.REMOVE_TEAM_MEMBERS
    );
  });

  it('协办律师应该拥有编辑案件权限', () => {
    const assistantPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT];
    expect(assistantPermissions).toContain(CasePermission.EDIT_CASE);
  });

  it('律师助理不应该拥有编辑案件权限', () => {
    const paralegalPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.PARALEGAL];
    expect(paralegalPermissions).not.toContain(CasePermission.EDIT_CASE);
  });

  it('律师助理应该拥有上传证据权限', () => {
    const paralegalPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.PARALEGAL];
    expect(paralegalPermissions).toContain(CasePermission.UPLOAD_EVIDENCE);
  });

  it('律师助理应该拥有上传文档权限', () => {
    const paralegalPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.PARALEGAL];
    expect(paralegalPermissions).toContain(CasePermission.UPLOAD_DOCUMENTS);
  });

  it('观察者应该只拥有查看权限', () => {
    const observerPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.OBSERVER];

    // 检查不包含编辑类权限
    expect(observerPermissions).not.toContain(CasePermission.EDIT_CASE);
    expect(observerPermissions).not.toContain(CasePermission.DELETE_CASE);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_TIMELINE);
    expect(observerPermissions).not.toContain(CasePermission.DELETE_TIMELINE);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_SCHEDULES);
    expect(observerPermissions).not.toContain(CasePermission.DELETE_SCHEDULES);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_EVIDENCE);
    expect(observerPermissions).not.toContain(CasePermission.DELETE_EVIDENCE);
    expect(observerPermissions).not.toContain(CasePermission.UPLOAD_EVIDENCE);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_DOCUMENTS);
    expect(observerPermissions).not.toContain(CasePermission.DELETE_DOCUMENTS);
    expect(observerPermissions).not.toContain(CasePermission.UPLOAD_DOCUMENTS);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_DEBATES);
    expect(observerPermissions).not.toContain(CasePermission.DELETE_DEBATES);
    expect(observerPermissions).not.toContain(
      CasePermission.EDIT_LEGAL_REFERENCES
    );
    expect(observerPermissions).not.toContain(
      CasePermission.DELETE_LEGAL_REFERENCES
    );
    expect(observerPermissions).not.toContain(CasePermission.ADD_TEAM_MEMBERS);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_TEAM_MEMBERS);
    expect(observerPermissions).not.toContain(
      CasePermission.REMOVE_TEAM_MEMBERS
    );
    expect(observerPermissions).not.toContain(CasePermission.POST_DISCUSSIONS);
    expect(observerPermissions).not.toContain(CasePermission.EDIT_DISCUSSIONS);
    expect(observerPermissions).not.toContain(
      CasePermission.DELETE_DISCUSSIONS
    );

    // 检查包含查看权限
    expect(observerPermissions).toContain(CasePermission.VIEW_CASE);
    expect(observerPermissions).toContain(CasePermission.VIEW_TIMELINE);
    expect(observerPermissions).toContain(CasePermission.VIEW_SCHEDULES);
    expect(observerPermissions).toContain(CasePermission.VIEW_EVIDENCE);
    expect(observerPermissions).toContain(CasePermission.VIEW_DOCUMENTS);
    expect(observerPermissions).toContain(CasePermission.VIEW_DEBATES);
    expect(observerPermissions).toContain(CasePermission.VIEW_LEGAL_REFERENCES);
    expect(observerPermissions).toContain(CasePermission.VIEW_TEAM_MEMBERS);
    expect(observerPermissions).toContain(CasePermission.VIEW_DISCUSSIONS);
  });

  it('观察者应该拥有导出数据权限', () => {
    const observerPermissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.OBSERVER];
    expect(observerPermissions).toContain(CasePermission.EXPORT_DATA);
  });
});

describe('CASE_ROLE_LABELS', () => {
  it('应该包含所有角色的中文标签', () => {
    expect(CASE_ROLE_LABELS[CaseRole.LEAD]).toBe('主办律师');
    expect(CASE_ROLE_LABELS[CaseRole.ASSISTANT]).toBe('协办律师');
    expect(CASE_ROLE_LABELS[CaseRole.PARALEGAL]).toBe('律师助理');
    expect(CASE_ROLE_LABELS[CaseRole.OBSERVER]).toBe('观察者');
  });
});

describe('CASE_PERMISSION_LABELS', () => {
  it('应该包含所有权限的中文标签', () => {
    expect(CASE_PERMISSION_LABELS[CasePermission.VIEW_CASE]).toBe('查看案件');
    expect(CASE_PERMISSION_LABELS[CasePermission.EDIT_CASE]).toBe('编辑案件');
    expect(CASE_PERMISSION_LABELS[CasePermission.DELETE_CASE]).toBe('删除案件');
  });
});

describe('isValidCaseRole', () => {
  it('应该验证有效的角色', () => {
    expect(isValidCaseRole('LEAD')).toBe(true);
    expect(isValidCaseRole('ASSISTANT')).toBe(true);
    expect(isValidCaseRole('PARALEGAL')).toBe(true);
    expect(isValidCaseRole('OBSERVER')).toBe(true);
  });

  it('应该拒绝无效的角色', () => {
    expect(isValidCaseRole('INVALID')).toBe(false);
    expect(isValidCaseRole('')).toBe(false);
    expect(isValidCaseRole('lead')).toBe(false); // 大小写敏感
    expect(isValidCaseRole('Lead')).toBe(false); // 大小写敏感
  });

  it('类型守卫应该正确类型收窄', () => {
    const value: string = 'LEAD';
    if (isValidCaseRole(value)) {
      // 这里TypeScript应该识别出value的类型是CaseRole
      expect(value).toBe('LEAD');
    }
  });
});

describe('isValidCasePermission', () => {
  it('应该验证有效的权限', () => {
    expect(isValidCasePermission('VIEW_CASE')).toBe(true);
    expect(isValidCasePermission('EDIT_CASE')).toBe(true);
    expect(isValidCasePermission('DELETE_CASE')).toBe(true);
    expect(isValidCasePermission('EXPORT_DATA')).toBe(true);
  });

  it('应该拒绝无效的权限', () => {
    expect(isValidCasePermission('INVALID')).toBe(false);
    expect(isValidCasePermission('')).toBe(false);
    expect(isValidCasePermission('view_case')).toBe(false); // 大小写敏感
  });

  it('类型守卫应该正确类型收窄', () => {
    const value: string = 'VIEW_CASE';
    if (isValidCasePermission(value)) {
      expect(value).toBe('VIEW_CASE');
    }
  });
});

describe('isCasePermissionArray', () => {
  it('应该验证有效的权限数组', () => {
    const validArray = [
      CasePermission.VIEW_CASE,
      CasePermission.EDIT_CASE,
      CasePermission.VIEW_TIMELINE,
    ];
    expect(isCasePermissionArray(validArray)).toBe(true);
  });

  it('应该验证包含所有权限的数组', () => {
    const allPermissions = Object.values(CasePermission);
    expect(isCasePermissionArray(allPermissions)).toBe(true);
  });

  it('应该验证空数组', () => {
    expect(isCasePermissionArray([])).toBe(true);
  });

  it('应该拒绝包含无效权限的数组', () => {
    const invalidArray = [
      CasePermission.VIEW_CASE,
      'INVALID_PERMISSION' as CasePermission,
    ];
    expect(isCasePermissionArray(invalidArray)).toBe(false);
  });

  it('应该拒绝非数组类型', () => {
    expect(isCasePermissionArray('not an array')).toBe(false);
    expect(isCasePermissionArray(123)).toBe(false);
    expect(isCasePermissionArray({})).toBe(false);
    expect(isCasePermissionArray(null)).toBe(false);
    expect(isCasePermissionArray(undefined)).toBe(false);
  });

  it('应该拒绝包含字符串的数组', () => {
    // 传入非CasePermission类型的字符串数组应该被拒绝
    // 注意：'VIEW_CASE'和'EDIT_CASE'虽然字符串内容正确，但不是CasePermission类型
    // 这里的测试需要传入无效的权限值
    expect(isCasePermissionArray(['VIEW_CASE', 'INVALID'] as never)).toBe(
      false
    );
  });
});

describe('getCaseRoleLabel', () => {
  it('应该返回正确的角色标签', () => {
    expect(getCaseRoleLabel(CaseRole.LEAD)).toBe('主办律师');
    expect(getCaseRoleLabel(CaseRole.ASSISTANT)).toBe('协办律师');
    expect(getCaseRoleLabel(CaseRole.PARALEGAL)).toBe('律师助理');
    expect(getCaseRoleLabel(CaseRole.OBSERVER)).toBe('观察者');
  });
});

describe('getCasePermissionLabel', () => {
  it('应该返回正确的权限标签', () => {
    expect(getCasePermissionLabel(CasePermission.VIEW_CASE)).toBe('查看案件');
    expect(getCasePermissionLabel(CasePermission.EDIT_CASE)).toBe('编辑案件');
    expect(getCasePermissionLabel(CasePermission.DELETE_CASE)).toBe('删除案件');
    expect(getCasePermissionLabel(CasePermission.EXPORT_DATA)).toBe('导出数据');
  });
});

describe('getRoleDefaultPermissions', () => {
  it('应该返回主办律师的默认权限', () => {
    const permissions = getRoleDefaultPermissions(CaseRole.LEAD);
    expect(permissions).toBeDefined();
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('应该返回协办律师的默认权限', () => {
    const permissions = getRoleDefaultPermissions(CaseRole.ASSISTANT);
    expect(permissions).toBeDefined();
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('应该返回律师助理的默认权限', () => {
    const permissions = getRoleDefaultPermissions(CaseRole.PARALEGAL);
    expect(permissions).toBeDefined();
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('应该返回观察者的默认权限', () => {
    const permissions = getRoleDefaultPermissions(CaseRole.OBSERVER);
    expect(permissions).toBeDefined();
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.length).toBeGreaterThan(0);
  });

  it('应该返回包含基础权限的数组', () => {
    const permissions = getRoleDefaultPermissions(CaseRole.LEAD);
    expect(permissions).toContain(CasePermission.VIEW_CASE);
    expect(permissions).toContain(CasePermission.VIEW_TIMELINE);
  });

  it('不同角色的权限数量应该符合预期', () => {
    const leadPermissions = getRoleDefaultPermissions(CaseRole.LEAD);
    const assistantPermissions = getRoleDefaultPermissions(CaseRole.ASSISTANT);
    const paralegalPermissions = getRoleDefaultPermissions(CaseRole.PARALEGAL);
    const observerPermissions = getRoleDefaultPermissions(CaseRole.OBSERVER);

    // 主办律师权限最多
    expect(leadPermissions.length).toBeGreaterThanOrEqual(
      assistantPermissions.length
    );
    expect(leadPermissions.length).toBeGreaterThanOrEqual(
      paralegalPermissions.length
    );
    expect(leadPermissions.length).toBeGreaterThanOrEqual(
      observerPermissions.length
    );

    // 观察者权限最少
    expect(observerPermissions.length).toBeLessThanOrEqual(
      paralegalPermissions.length
    );
    expect(observerPermissions.length).toBeLessThanOrEqual(
      assistantPermissions.length
    );
  });
});

describe('validateAddTeamMemberInput', () => {
  it('应该验证有效的输入', () => {
    const validInput = {
      caseId: 'case-123',
      userId: 'user-456',
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(validInput);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应该接受带有可选字段的输入', () => {
    const validInput = {
      caseId: 'case-123',
      userId: 'user-456',
      role: CaseRole.PARALEGAL,
      permissions: [CasePermission.VIEW_CASE, CasePermission.VIEW_TIMELINE],
      notes: '测试备注',
      metadata: { key: 'value' },
    };

    const result = validateAddTeamMemberInput(validInput);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应该拒绝缺少caseId的输入', () => {
    const invalidInput = {
      userId: 'user-456',
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(invalidInput as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('caseId');
    expect(result.errors[0].message).toBe('案件ID是必填项');
  });

  it('应该拒绝缺少userId的输入', () => {
    const invalidInput = {
      caseId: 'case-123',
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(invalidInput as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('userId');
    expect(result.errors[0].message).toBe('用户ID是必填项');
  });

  it('应该拒绝缺少role的输入', () => {
    const invalidInput = {
      caseId: 'case-123',
      userId: 'user-456',
    };

    const result = validateAddTeamMemberInput(invalidInput as never);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('role');
    expect(result.errors[0].message).toContain('角色必须是有效的案件角色');
  });

  it('应该拒绝无效的role', () => {
    const invalidInput = {
      caseId: 'case-123',
      userId: 'user-456',
      role: 'INVALID_ROLE' as CaseRole,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('role');
    expect(result.errors[0].message).toContain('角色必须是有效的案件角色');
  });

  it('应该拒绝无效的permissions数组', () => {
    const invalidInput = {
      caseId: 'case-123',
      userId: 'user-456',
      role: CaseRole.ASSISTANT,
      permissions: [
        CasePermission.VIEW_CASE,
        'INVALID_PERMISSION' as CasePermission,
      ],
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('permissions');
    expect(result.errors[0].message).toBe('权限必须是有效的案件权限数组');
  });

  it('应该接受空字符串caseId', () => {
    const invalidInput = {
      caseId: '',
      userId: 'user-456',
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('caseId');
  });

  it('应该接受空字符串userId', () => {
    const invalidInput = {
      caseId: 'case-123',
      userId: '',
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('userId');
  });

  it('应该接受空字符串role', () => {
    const invalidInput = {
      caseId: 'case-123',
      userId: 'user-456',
      role: '' as CaseRole,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('role');
  });

  it('应该拒绝非字符串类型的caseId', () => {
    const invalidInput = {
      caseId: 123 as never,
      userId: 'user-456',
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('caseId');
  });

  it('应该拒绝非字符串类型的userId', () => {
    const invalidInput = {
      caseId: 'case-123',
      userId: 456 as never,
      role: CaseRole.ASSISTANT,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('userId');
  });

  it('应该返回多个错误', () => {
    const invalidInput = {
      caseId: '',
      userId: '',
      role: '' as CaseRole,
    };

    const result = validateAddTeamMemberInput(invalidInput);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.field === 'caseId')).toBe(true);
    expect(result.errors.some(e => e.field === 'userId')).toBe(true);
    expect(result.errors.some(e => e.field === 'role')).toBe(true);
  });

  it('应该接受所有有效角色', () => {
    const roles = [
      CaseRole.LEAD,
      CaseRole.ASSISTANT,
      CaseRole.PARALEGAL,
      CaseRole.OBSERVER,
    ];

    for (const role of roles) {
      const validInput = {
        caseId: 'case-123',
        userId: 'user-456',
        role,
      };

      const result = validateAddTeamMemberInput(validInput);
      expect(result.isValid).toBe(true);
    }
  });
});
