/**
 * 案件共享权限验证模块测试
 */

import {
  canShareCase,
  canAccessSharedCase,
  getCaseAccessPermissions,
  validateShareRequest,
  canUnshareCase,
} from '@/lib/case/share-permission-validator';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
    },
    caseTeamMember: {
      findFirst: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/team/permission-inheritance', () => ({
  getUserTeamPermissions: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getUserTeamPermissions } from '@/lib/team/permission-inheritance';
import { CasePermission, CaseRole } from '@/types/case-collaboration';

describe('案件共享权限验证 - canShareCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回true对于案件所有者', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });

    const result = await canShareCase('user-123', 'case-123');

    expect(result.hasPermission).toBe(true);
    expect(result.isOwner).toBe(true);
  });

  it('应该返回false对于非所有者', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });

    const result = await canShareCase('user-123', 'case-123');

    expect(result.hasPermission).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(result.reason).toBe('只有案件所有者可以共享案件');
  });

  it('应该返回false对于不存在的案件', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await canShareCase('user-123', 'case-123');

    expect(result.hasPermission).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(result.reason).toBe('案件不存在');
  });

  it('应该处理数据库错误', async () => {
    (prisma.case.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const result = await canShareCase('user-123', 'case-123');

    expect(result.hasPermission).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(result.reason).toBe('权限检查失败');
  });
});

describe('案件共享权限验证 - canAccessSharedCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该允许案件所有者访问', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });

    const result = await canAccessSharedCase('user-123', 'case-123');

    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(true);
    expect(result.accessType).toBe('owner');
    expect(result.permissions).toContain(CasePermission.VIEW_CASE);
    expect(result.permissions).toContain(CasePermission.EDIT_CASE);
  });

  it('应该允许案件团队成员访问', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });
    (prisma.caseTeamMember.findFirst as jest.Mock).mockResolvedValue({
      role: CaseRole.ASSISTANT,
      permissions: {},
    });

    const result = await canAccessSharedCase('user-123', 'case-123');

    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.accessType).toBe('team-member');
    expect(result.permissions).toContain(CasePermission.VIEW_CASE);
  });

  it('应该使用自定义权限对于案件团队成员', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });
    (prisma.caseTeamMember.findFirst as jest.Mock).mockResolvedValue({
      role: CaseRole.ASSISTANT,
      permissions: {
        customPermissions: [
          CasePermission.VIEW_CASE,
          CasePermission.VIEW_TIMELINE,
          CasePermission.VIEW_EVIDENCE,
        ],
      },
    });

    const result = await canAccessSharedCase('user-123', 'case-123');

    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.accessType).toBe('team-member');
    expect(result.permissions).toContain(CasePermission.VIEW_CASE);
    expect(result.permissions).toContain(CasePermission.VIEW_TIMELINE);
    expect(result.permissions).toContain(CasePermission.VIEW_EVIDENCE);
    expect(result.permissions).not.toContain(CasePermission.EDIT_CASE);
  });

  it('应该拒绝案件团队成员缺少所需权限', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });
    (prisma.caseTeamMember.findFirst as jest.Mock).mockResolvedValue({
      role: CaseRole.OBSERVER,
      permissions: {},
    });

    const result = await canAccessSharedCase(
      'user-123',
      'case-123',
      CasePermission.EDIT_CASE
    );

    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBe('缺少所需权限');
  });

  it('应该允许团队成员访问共享案件', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: true,
      deletedAt: null,
    });
    (prisma.caseTeamMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.teamMember.findMany as jest.Mock).mockResolvedValue([
      {
        teamId: 'team-123',
        role: 'LAWYER',
        metadata: null,
      },
    ]);
    (getUserTeamPermissions as jest.Mock).mockResolvedValue([
      'CASE_READ',
      'CASE_UPDATE',
    ]);

    const result = await canAccessSharedCase('user-123', 'case-123');

    expect(result.hasAccess).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.accessType).toBe('shared-team');
    expect(result.permissions).toContain(CasePermission.VIEW_CASE);
  });

  it('应该拒绝无权限用户访问', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });
    (prisma.caseTeamMember.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await canAccessSharedCase('user-123', 'case-123');

    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBe('无权访问此案件');
  });
});

describe('案件共享权限验证 - getCaseAccessPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回权限列表对于有权限用户', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });

    const permissions = await getCaseAccessPermissions('user-123', 'case-123');

    expect(permissions).toContain(CasePermission.VIEW_CASE);
    expect(permissions).toContain(CasePermission.EDIT_CASE);
  });

  it('应该返回空数组对于无权限用户', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });
    (prisma.caseTeamMember.findFirst as jest.Mock).mockResolvedValue(null);

    const permissions = await getCaseAccessPermissions('user-123', 'case-123');

    expect(permissions).toEqual([]);
  });
});

describe('案件共享权限验证 - validateShareRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回有效对于案件所有者', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });

    const result = await validateShareRequest('user-123', 'case-123');

    expect(result.isValid).toBe(true);
    expect(result.canShare).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('应该返回无效对于无权限用户', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: false,
      deletedAt: null,
    });

    const result = await validateShareRequest('user-123', 'case-123');

    expect(result.isValid).toBe(false);
    expect(result.canShare).toBe(false);
    expect(result.errors).toContain('只有案件所有者可以共享案件');
  });
});

describe('案件共享权限验证 - canUnshareCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该允许案件所有者取消共享', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      ownerType: 'USER',
      sharedWithTeam: true,
      deletedAt: null,
    });

    const result = await canUnshareCase('user-123', 'case-123');

    expect(result.canUnshare).toBe(true);
  });

  it('应该拒绝非所有者取消共享', async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-456',
      ownerType: 'USER',
      sharedWithTeam: true,
      deletedAt: null,
    });

    const result = await canUnshareCase('user-123', 'case-123');

    expect(result.canUnshare).toBe(false);
    expect(result.reason).toBe('只有案件所有者可以共享案件');
  });
});
