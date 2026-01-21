import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cases/[id]/evidence/route';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
    },
    evidence: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn().mockResolvedValue({
    userId: 'cmjtg7np100axc0zgwiwpwt9b',
    email: 'test@example.com',
    name: 'Test User',
  }),
}));

describe('Case Evidence API - /api/cases/[id]/evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/cases/[id]/evidence', () => {
    it('should return evidence list for a case', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      const mockEvidence = [
        {
          id: 'evdtg7np100axc0zgwiwpwt9c',
          caseId: 'cmjtg7np100axc0zgwiwpwt9a',
          type: 'DOCUMENT',
          name: 'Contract Document',
          description: 'Contract between parties',
          fileUrl: 'https://example.com/file.pdf',
          submitter: 'Test User',
          source: 'Client',
          status: 'PENDING',
          relevanceScore: 0.85,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          relations: [],
        },
      ];

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue(mockEvidence);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?page=1&limit=20'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      const data = await response.json();

      expect(prisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'cmjtg7np100axc0zgwiwpwt9a',
            deletedAt: null,
          }),
        })
      );
      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseId: 'cmjtg7np100axc0zgwiwpwt9a',
          }),
        })
      );
      expect(data.data.caseId).toBe('cmjtg7np100axc0zgwiwpwt9a');
      expect(data.data.evidence).toHaveLength(1);
      expect(data.data.total).toBe(1);
    });

    it('should filter by type', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?type=DOCUMENT'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'DOCUMENT',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?status=ACCEPTED'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACCEPTED',
          }),
        })
      );
    });

    it('should filter by submitter', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?submitter=张三'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            submitter: '张三',
          }),
        })
      );
    });

    it('should filter by source', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?source=Client'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: 'Client',
          }),
        })
      );
    });

    it('should filter by relevance score range', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const url = new URL(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence'
      );
      url.searchParams.set('minRelevanceScore', '0.5');
      url.searchParams.set('maxRelevanceScore', '0.9');
      const request = new NextRequest(url.toString());
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            relevanceScore: expect.objectContaining({
              gte: 0.5,
              lte: 0.9,
            }),
          }),
        })
      );
    });

    it('should support custom pagination', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?page=2&limit=10'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should support custom sorting', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?sortBy=relevanceScore&sortOrder=asc'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            relevanceScore: 'asc',
          },
        })
      );
    });

    it('should return 404 when case not found', async () => {
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      const data = await response.json();

      expect(data.error).toBe('案件不存在');
      expect(response.status).toBe(404);
    });

    it('should return 403 when user has no permission', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'othjtg7np100axc0zgwiwpwt9x',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      const data = await response.json();

      expect(data.error).toBe('无权限');
      expect(response.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      jest
        .requireMock('@/lib/middleware/auth')
        .getAuthUser.mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence'
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      expect(response.status).toBe(401);
    });

    it('should calculate totalPages correctly', async () => {
      const mockCase = {
        id: 'cmjtg7np100axc0zgwiwpwt9a',
        userId: 'cmjtg7np100axc0zgwiwpwt9b',
        title: 'Test Case',
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(45);

      const request = new NextRequest(
        'http://localhost/api/cases/cmjtg7np100axc0zgwiwpwt9a/evidence?page=1&limit=20'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt9a' }),
      });
      const data = await response.json();

      expect(data.data.totalPages).toBe(3);
    });
  });
});
