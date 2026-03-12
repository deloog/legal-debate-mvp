import {
  GET as GETTimeline,
  POST,
} from '@/app/api/v1/cases/[id]/timeline/route';
import {
  GET as GETTimelineEvent,
  PUT,
  DELETE,
} from '@/app/api/v1/timeline-events/[id]/route';
import { NextResponse } from 'next/server';
import {
  createMockRequest,
  createTestResponse,
  assertions,
  mockData,
} from '../../api/test-utils';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    caseTimeline: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// Mock Auth
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('Timeline API', () => {
  let mockedPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma as any;

    // Default auth mock
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'lawyer',
    });

    // Default case mock
    mockedPrisma.case.findFirst.mockResolvedValue({
      id: 'case-123',
      userId: 'user-123',
      title: '测试案件',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Default timeline events mock
    mockedPrisma.caseTimeline.findMany.mockResolvedValue([
      {
        id: 'event-1',
        caseId: 'case-123',
        eventType: 'FILING',
        title: '案件已立案',
        description: '测试描述',
        eventDate: new Date('2024-01-15'),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  describe('GET /api/v1/cases/[id]/timeline', () => {
    it('should return timeline events for a case', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline'
      );
      const response = await GETTimeline(request, {
        params: Promise.resolve({ id: 'case-123' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.total).toBeDefined();
      expect(data.caseId).toBe('case-123');
    });

    it('should filter by eventType', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline?eventType=FILING'
      );
      const response = await GETTimeline(request, {
        params: Promise.resolve({ id: 'case-123' }),
      });

      expect(response.status).toBe(200);
      expect(mockedPrisma.caseTimeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseId: 'case-123',
            eventType: 'FILING',
          }),
        })
      );
    });

    it('should handle sort parameters', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline?sortBy=eventDate&sortOrder=desc'
      );
      const response = await GETTimeline(request, {
        params: Promise.resolve({ id: 'case-123' }),
      });

      expect(response.status).toBe(200);
      expect(mockedPrisma.caseTimeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { eventDate: 'desc' },
        })
      );
    });

    it('should return 401 for unauthorized request', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline'
      );
      const response = await GETTimeline(request, {
        params: Promise.resolve({ id: 'case-123' }),
      });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(401);
        const data = await nextResponse.json();
        expect((data as { error?: string }).error).toBe('未授权');
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBe('未授权');
      }
    });

    it('should return 404 for non-existent case', async () => {
      mockedPrisma.case.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-999/timeline'
      );
      const response = await GETTimeline(request, {
        params: Promise.resolve({ id: 'case-999' }),
      });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(404);
        const data = await nextResponse.json();
        expect((data as { error?: string }).error).toBe('案件不存在');
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBe('案件不存在');
      }
    });
  });

  describe('POST /api/v1/cases/[id]/timeline', () => {
    const validEvent = {
      eventType: 'TRIAL',
      title: '开庭审理',
      description: '开庭审理详情',
      eventDate: '2024-02-01',
    };

    it('should create a new timeline event', async () => {
      mockedPrisma.caseTimeline.create.mockResolvedValue({
        id: 'event-new',
        caseId: 'case-123',
        ...validEvent,
        eventDate: new Date(validEvent.eventDate),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline',
        {
          method: 'POST',
          body: validEvent,
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'case-123' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      expect(isNextResponse).toBe(true);
      const nextResponse = response as NextResponse;
      expect(nextResponse.status).toBe(201);
      const data = await nextResponse.json();
      expect((data as { id?: string }).id).toBe('event-new');
      expect((data as { eventType?: string }).eventType).toBe('TRIAL');
      expect((data as { title?: string }).title).toBe('开庭审理');
    });

    it('should validate required fields', async () => {
      const invalidEvent = {
        eventType: 'TRIAL',
        // title is missing
        eventDate: '2024-02-01',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline',
        {
          method: 'POST',
          body: invalidEvent,
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'case-123' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBeGreaterThanOrEqual(400);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });

    it('should validate title length', async () => {
      const invalidEvent = {
        eventType: 'TRIAL',
        title: 'a'.repeat(201),
        eventDate: '2024-02-01',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline',
        {
          method: 'POST',
          body: invalidEvent,
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'case-123' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBeGreaterThanOrEqual(400);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });

    it('should validate description length', async () => {
      const invalidEvent = {
        eventType: 'TRIAL',
        title: '开庭',
        description: 'a'.repeat(2001),
        eventDate: '2024-02-01',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline',
        {
          method: 'POST',
          body: invalidEvent,
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'case-123' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBeGreaterThanOrEqual(400);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });

    it('should validate eventType enum', async () => {
      const invalidEvent = {
        eventType: 'INVALID_TYPE',
        title: '测试',
        eventDate: '2024-02-01',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline',
        {
          method: 'POST',
          body: invalidEvent,
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'case-123' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBeGreaterThanOrEqual(400);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });

    it('should return 401 for unauthorized request', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline',
        {
          method: 'POST',
          body: validEvent,
        }
      );
      const response = await POST(request, { params: Promise.resolve({ id: 'case-123' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(401);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBe('未授权');
      }
    });
  });

  describe('GET /api/v1/timeline-events/[id]', () => {
    it('should return a single timeline event', async () => {
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue({
        id: 'event-1',
        caseId: 'case-123',
        eventType: 'FILING',
        title: '案件已立案',
        description: '测试描述',
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'case-123',
          userId: 'user-123',
          title: '测试案件',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-1'
      );
      const response = await GETTimelineEvent(request, {
        params: Promise.resolve({ id: 'event-1' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('event-1');
    });

    it('should return 404 for non-existent event', async () => {
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-999'
      );
      const response = await GETTimelineEvent(request, {
        params: Promise.resolve({ id: 'event-999' }),
      });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(404);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });

    it('should return 403 for unauthorized access', async () => {
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue({
        id: 'event-1',
        caseId: 'case-123',
        eventType: 'FILING',
        title: '案件已立案',
        description: '测试描述',
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'case-123',
          userId: 'other-user', // Different user
          title: '测试案件',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-1'
      );
      const response = await GETTimelineEvent(request, {
        params: Promise.resolve({ id: 'event-1' }),
      });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(403);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });
  });

  describe('PUT /api/v1/timeline-events/[id]', () => {
    const updateData = {
      title: '更新后的标题',
      description: '更新后的描述',
    };

    it('should update a timeline event', async () => {
      const existingEvent = {
        id: 'event-1',
        caseId: 'case-123',
        eventType: 'FILING',
        title: '原标题',
        description: '原描述',
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'case-123',
          userId: 'user-123',
        },
      };

      mockedPrisma.caseTimeline.findFirst.mockResolvedValue(existingEvent);
      mockedPrisma.caseTimeline.update.mockResolvedValue({
        ...existingEvent,
        ...updateData,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-1',
        {
          method: 'PUT',
          body: updateData,
        }
      );
      const response = await PUT(request, { params: Promise.resolve({ id: 'event-1' }) });

      expect(response.status).toBe(200);
      expect(mockedPrisma.caseTimeline.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: expect.objectContaining({
          title: '更新后的标题',
        }),
      });
    });

    it('should allow partial updates', async () => {
      const existingEvent = {
        id: 'event-1',
        caseId: 'case-123',
        eventType: 'FILING',
        title: '原标题',
        eventDate: new Date(),
        metadata: {},
        case: {
          id: 'case-123',
          userId: 'user-123',
        },
      };

      mockedPrisma.caseTimeline.findFirst.mockResolvedValue(existingEvent);

      const partialUpdate = {
        title: '只更新标题',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-1',
        {
          method: 'PUT',
          body: partialUpdate,
        }
      );
      const response = await PUT(request, { params: Promise.resolve({ id: 'event-1' }) });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/timeline-events/[id]', () => {
    it('should delete a timeline event', async () => {
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue({
        id: 'event-1',
        caseId: 'case-123',
        case: {
          id: 'case-123',
          userId: 'user-123',
        },
      });
      mockedPrisma.caseTimeline.delete.mockResolvedValue({
        id: 'event-1',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, { params: Promise.resolve({ id: 'event-1' }) });

      expect(response.status).toBe(200);
      expect(mockedPrisma.caseTimeline.delete).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
    });

    it('should return 404 for non-existent event', async () => {
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-999',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, { params: Promise.resolve({ id: 'event-999' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(404);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });

    it('should return 403 for unauthorized deletion', async () => {
      mockedPrisma.caseTimeline.findFirst.mockResolvedValue({
        id: 'event-1',
        caseId: 'case-123',
        case: {
          id: 'case-123',
          userId: 'other-user',
        },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/timeline-events/event-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, { params: Promise.resolve({ id: 'event-1' }) });

      const isNextResponse = 'status' in response && 'json' in response;
      if (isNextResponse) {
        const nextResponse = response as NextResponse;
        expect(nextResponse.status).toBe(403);
      } else {
        const errorResponse = response as { error: string };
        expect(errorResponse.error).toBeDefined();
      }
    });
  });

  describe('Response structure', () => {
    it('should return consistent response format', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/case-123/timeline'
      );
      const response = await GETTimeline(request, {
        params: Promise.resolve({ id: 'case-123' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.events).toBeDefined();
      expect(data.total).toBeDefined();
      expect(data.caseId).toBeDefined();
    });
  });
});
