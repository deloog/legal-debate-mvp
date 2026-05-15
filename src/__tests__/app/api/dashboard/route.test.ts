import { NextRequest } from 'next/server';
import { GET } from '@/app/api/dashboard/route';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { CasePermission, CaseRole } from '@/types/case-collaboration';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    client: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
    courtSchedule: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    caseTeamMember: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

describe('GET /api/dashboard', () => {
  const userId = 'user-dashboard-1';

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({ userId });
    (prisma.case.count as jest.Mock).mockResolvedValue(2);
    (prisma.client.count as jest.Mock).mockResolvedValue(3);
    (prisma.task.count as jest.Mock).mockResolvedValue(4);
    (prisma.courtSchedule.count as jest.Mock).mockResolvedValue(1);
    (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.client.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.courtSchedule.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.caseTeamMember.findMany as jest.Mock).mockResolvedValue([
      {
        caseId: 'shared-case-1',
        role: CaseRole.OBSERVER,
        permissions: [CasePermission.VIEW_SCHEDULES],
      },
    ]);
  });

  it('统计待办任务时应包含创建给自己和分配给自己的任务', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/dashboard')
    );

    expect(response.status).toBe(200);
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: {
        OR: [{ createdBy: userId }, { assignedTo: userId }],
        status: 'TODO',
        deletedAt: null,
      },
    });
  });

  it('统计日程时应包含拥有案件和具备 VIEW_SCHEDULES 的共享案件', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/dashboard')
    );

    expect(response.status).toBe(200);
    expect(prisma.courtSchedule.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                {
                  case: {
                    userId,
                    deletedAt: null,
                  },
                },
                {
                  caseId: { in: ['shared-case-1'] },
                },
              ],
            },
          ],
          status: { not: 'CANCELLED' },
        }),
      })
    );
    expect(prisma.courtSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
          status: { not: 'CANCELLED' },
        }),
      })
    );
  });

  it('未认证用户应返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost:3000/api/dashboard')
    );

    expect(response.status).toBe(401);
  });
});
