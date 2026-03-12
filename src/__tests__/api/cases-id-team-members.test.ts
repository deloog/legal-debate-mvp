import {
  GET as GET_LIST,
  POST as POST_LIST,
} from '@/app/api/cases/[id]/team-members/route';
import {
  GET as GET_MEMBER,
  PUT as PUT_MEMBER,
  DELETE as DELETE_MEMBER,
} from '@/app/api/cases/[id]/team-members/[userId]/route';
import { CaseRole } from '@/types/case-collaboration';
import {
  createMockRequest,
  createTestResponse,
  assertions,
  mockData,
} from './test-utils';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
    },
    caseTeamMember: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// Mock Auth
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('Case Team Members API', () => {
  let mockedPrisma: any;
  const testCaseId = 'case-123';
  const testUserId = 'user-123';
  const testTargetUserId = 'user-456';
  const testMemberId = 'member-789';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma as any;

    // Default mocks for auth
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: testUserId,
      email: 'test@example.com',
      role: 'lawyer',
    });

    // Default mocks for case
    mockedPrisma.case.findUnique.mockResolvedValue({
      id: testCaseId,
      userId: testUserId,
      title: '测试案件',
      description: '描述',
      type: 'CIVIL',
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Default mocks for team members
    mockedPrisma.caseTeamMember.findMany.mockResolvedValue([
      {
        id: testMemberId,
        caseId: testCaseId,
        userId: testTargetUserId,
        role: CaseRole.ASSISTANT,
        permissions: ['view_case', 'edit_case'],
        joinedAt: new Date(),
        notes: '协办律师',
        metadata: null,
        user: {
          id: testTargetUserId,
          name: '协办律师',
          email: 'assistant@example.com',
          avatar: 'avatar.jpg',
          role: 'lawyer',
        },
      },
    ]);
    mockedPrisma.caseTeamMember.count.mockResolvedValue(1);
    mockedPrisma.caseTeamMember.findFirst.mockResolvedValue({
      id: testMemberId,
      caseId: testCaseId,
      userId: testTargetUserId,
      role: CaseRole.ASSISTANT,
      permissions: ['view_case', 'edit_case'],
      joinedAt: new Date(),
      notes: '协办律师',
      metadata: null,
      user: {
        id: testTargetUserId,
        name: '协办律师',
        email: 'assistant@example.com',
        avatar: 'avatar.jpg',
        role: 'lawyer',
      },
    });
    mockedPrisma.caseTeamMember.create.mockResolvedValue({
      id: testMemberId,
      caseId: testCaseId,
      userId: testTargetUserId,
      role: CaseRole.ASSISTANT,
      permissions: ['view_case', 'edit_case'],
      joinedAt: new Date(),
      notes: '协办律师',
      metadata: null,
      user: {
        id: testTargetUserId,
        name: '协办律师',
        email: 'assistant@example.com',
        avatar: 'avatar.jpg',
        role: 'lawyer',
      },
    });
    mockedPrisma.caseTeamMember.update.mockImplementation((data: any) => {
      return Promise.resolve({
        id: testMemberId,
        caseId: testCaseId,
        userId: testTargetUserId,
        role: data.data.role || CaseRole.ASSISTANT,
        permissions: data.data.permissions || ['view_case'],
        joinedAt: new Date(),
        notes: data.data.notes || '协办律师',
        metadata: data.data.metadata || null,
        user: {
          id: testTargetUserId,
          name: '协办律师',
          email: 'assistant@example.com',
          avatar: 'avatar.jpg',
          role: 'lawyer',
        },
      });
    });

    // Default mock for user
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: testTargetUserId,
      email: 'assistant@example.com',
      name: '协办律师',
      role: 'lawyer',
    });
  });

  describe('GET /api/cases/[id]/team-members', () => {
    it('should return team members list for case owner', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.members).toBeDefined();
      expect(Array.isArray(testResponse.data.members)).toBe(true);
      expect(testResponse.data.total).toBeDefined();
      expect(testResponse.meta.pagination).toBeDefined();
    });

    it('should return team members list for team member', async () => {
      // Mock non-owner who is a team member
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: testTargetUserId,
        email: 'assistant@example.com',
        role: 'lawyer',
      });

      mockedPrisma.case.findUnique.mockResolvedValue({
        id: testCaseId,
        userId: testUserId, // Owner is different
        title: '测试案件',
        description: '描述',
      });

      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue({
        id: testMemberId,
        caseId: testCaseId,
        userId: testTargetUserId,
        role: CaseRole.ASSISTANT,
        permissions: [],
        joinedAt: new Date(),
      });

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.members).toBeDefined();
    });

    it('should handle pagination parameters', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members?page=1&limit=10`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.members).toBeDefined();
      expect(testResponse.meta.pagination).toBeDefined();
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(10);
    });

    it('should filter by role', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members?role=ASSISTANT`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.caseTeamMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: CaseRole.ASSISTANT,
          }),
        })
      );
    });

    it('should handle sort parameters', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members?sortBy=role&sortOrder=desc`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(200);
    });

    it('should return 401 for unauthenticated user', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 403 for user without access', async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: testCaseId,
        userId: 'other-user',
        title: '测试案件',
      });

      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent case', async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/cases/[id]/team-members', () => {
    it('should add team member as case owner', async () => {
      // Reset the mock to return null (user not yet a team member)
      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

      const newMemberData = {
        userId: testTargetUserId,
        role: CaseRole.ASSISTANT,
        permissions: ['view_case', 'edit_case'],
        notes: '测试备注',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.userId).toBe(testTargetUserId);
      expect(testResponse.data.role).toBe(CaseRole.ASSISTANT);
    });

    it('should create team member with default permissions', async () => {
      // Reset mock to return null (user not yet a team member)
      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);
      // Update mock create to return correct role
      mockedPrisma.caseTeamMember.create.mockResolvedValue({
        id: testMemberId,
        caseId: testCaseId,
        userId: testTargetUserId,
        role: CaseRole.OBSERVER,
        permissions: [],
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        user: {
          id: testTargetUserId,
          name: '协办律师',
          email: 'assistant@example.com',
          avatar: 'avatar.jpg',
          role: 'lawyer',
        },
      });

      const newMemberData = {
        userId: testTargetUserId,
        role: CaseRole.OBSERVER,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.role).toBe(CaseRole.OBSERVER);
    });

    it('should validate required fields', async () => {
      const newMemberData = {
        role: CaseRole.ASSISTANT,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 if target user does not exist', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const newMemberData = {
        userId: 'non-existent-user',
        role: CaseRole.ASSISTANT,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 409 if user is already a team member', async () => {
      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue({
        id: testMemberId,
        caseId: testCaseId,
        userId: testTargetUserId,
      });

      const newMemberData = {
        userId: testTargetUserId,
        role: CaseRole.ASSISTANT,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(409);
    });

    it('should return 403 for non-owner', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'other-user',
        email: 'other@example.com',
        role: 'lawyer',
      });

      const newMemberData = {
        userId: testTargetUserId,
        role: CaseRole.ASSISTANT,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(403);
    });

    it('should validate role enum', async () => {
      const newMemberData = {
        userId: testTargetUserId,
        role: 'INVALID_ROLE',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'POST',
          body: newMemberData,
        }
      );

      const response = await POST_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept all valid roles', async () => {
      const validRoles = [
        CaseRole.LEAD,
        CaseRole.ASSISTANT,
        CaseRole.PARALEGAL,
        CaseRole.OBSERVER,
      ];

      for (const role of validRoles) {
        // Reset the mock for each iteration
        mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

        const newMemberData = {
          userId: testTargetUserId,
          role,
        };

        const request = createMockRequest(
          `http://localhost:3000/api/cases/${testCaseId}/team-members`,
          {
            method: 'POST',
            body: newMemberData,
          }
        );

        const response = await POST_LIST(request, {
          params: Promise.resolve({ id: testCaseId }),
        });
        const testResponse = await createTestResponse(response);

        assertions.assertCreated(testResponse);
      }
    });
  });

  describe('GET /api/cases/[id]/team-members/[userId]', () => {
    it('should return single team member details', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`
      );
      const response = await GET_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.userId).toBe(testTargetUserId);
      expect(testResponse.data.role).toBeDefined();
    });

    it('should include user information', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`
      );
      const response = await GET_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.user).toBeDefined();
      expect(testResponse.data.user.id).toBe(testTargetUserId);
    });

    it('should return 404 if team member does not exist', async () => {
      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/non-existent`
      );
      const response = await GET_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: 'non-existent' }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 403 for user without access', async () => {
      mockedPrisma.case.findUnique.mockResolvedValue({
        id: testCaseId,
        userId: 'other-user',
      });

      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`
      );
      const response = await GET_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`
      );
      const response = await GET_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/cases/[id]/team-members/[userId]', () => {
    it('should update team member role', async () => {
      const updateData = {
        role: CaseRole.PARALEGAL,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.role).toBe(CaseRole.PARALEGAL);
    });

    it('should update team member permissions', async () => {
      const updateData = {
        permissions: ['view_case', 'edit_case', 'delete_case'],
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(200);
    });

    it('should update team member notes', async () => {
      const updateData = {
        notes: '更新的备注',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.notes).toBe('更新的备注');
    });

    it('should update multiple fields at once', async () => {
      const updateData = {
        role: CaseRole.LEAD,
        permissions: ['all'],
        notes: '主办律师',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.role).toBe(CaseRole.LEAD);
      expect(testResponse.data.notes).toBe('主办律师');
    });

    it('should return 404 if team member does not exist', async () => {
      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

      const updateData = {
        role: CaseRole.PARALEGAL,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/non-existent`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: 'non-existent' }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'other-user',
        email: 'other@example.com',
        role: 'lawyer',
      });

      const updateData = {
        role: CaseRole.PARALEGAL,
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(403);
    });

    it('should validate role enum', async () => {
      const updateData = {
        role: 'INVALID_ROLE',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/cases/[id]/team-members/[userId]', () => {
    it('should remove team member (soft delete)', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(204);
      expect(mockedPrisma.caseTeamMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return 400 when trying to remove case owner', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testUserId }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 if team member does not exist', async () => {
      mockedPrisma.caseTeamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/non-existent`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: 'non-existent' }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'other-user',
        email: 'other@example.com',
        role: 'lawyer',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('OPTIONS /api/cases/[id]/team-members', () => {
    it('should return CORS headers for list endpoint', async () => {
      const { OPTIONS } =
        await import('@/app/api/cases/[id]/team-members/route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`,
        {
          method: 'OPTIONS',
        }
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, OPTIONS'
      );
    });
  });

  describe('OPTIONS /api/cases/[id]/team-members/[userId]', () => {
    it('should return CORS headers for member endpoint', async () => {
      const { OPTIONS } =
        await import('@/app/api/cases/[id]/team-members/[userId]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`,
        {
          method: 'OPTIONS',
        }
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PUT, DELETE, OPTIONS'
      );
    });
  });

  describe('Response Structure', () => {
    it('should return consistent response format for list', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members`
      );
      const response = await GET_LIST(request, {
        params: Promise.resolve({ id: testCaseId }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.success).toBeDefined();
      expect(testResponse.data).toBeDefined();
      expect(testResponse.data.members).toBeDefined();
      expect(testResponse.data.total).toBeDefined();
      expect(testResponse.meta).toBeDefined();
    });

    it('should return consistent response format for member detail', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCaseId}/team-members/${testTargetUserId}`
      );
      const response = await GET_MEMBER(request, {
        params: Promise.resolve({ id: testCaseId, userId: testTargetUserId }),
      });
      const testResponse = await createTestResponse(response);

      expect(testResponse.success).toBeDefined();
      expect(testResponse.data).toBeDefined();
      expect(testResponse.data.id).toBeDefined();
      expect(testResponse.data.userId).toBeDefined();
      expect(testResponse.data.role).toBeDefined();
    });
  });
});
