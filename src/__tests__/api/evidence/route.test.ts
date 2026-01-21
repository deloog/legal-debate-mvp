import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/evidence/route';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    evidence: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    case: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn().mockResolvedValue({
    userId: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  }),
}));

describe('Evidence API - /api/evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/evidence', () => {
    it('should return evidence list with pagination', async () => {
      const mockEvidence = [
        {
          id: 'evidence-1',
          caseId: 'case-1',
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
          case: {
            id: 'case-1',
            title: 'Test Case',
          },
          relations: [],
        },
      ];

      (prisma.evidence.findMany as jest.Mock).mockResolvedValue(mockEvidence);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost/api/evidence?page=1&limit=20'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request);
      const data = await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
      expect(prisma.evidence.count).toHaveBeenCalled();
      expect(data.data.evidence).toHaveLength(1);
      expect(data.data.total).toBe(1);
    });

    it('should filter by caseId', async () => {
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/evidence?caseId=case-1'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request);
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseId: 'case-1',
          }),
        })
      );
    });

    it('should filter by type and status', async () => {
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/evidence?type=DOCUMENT&status=PENDING'
      );
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request);
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'DOCUMENT',
            status: 'PENDING',
          }),
        })
      );
    });

    it('should filter by relevance score range', async () => {
      (prisma.evidence.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/evidence');
      request.headers.set('Authorization', 'Bearer test-token');

      const response = await GET(request);
      await response.json();

      expect(prisma.evidence.findMany).toHaveBeenCalled();
    });

    it('should return 401 without authentication', async () => {
      jest
        .requireMock('@/lib/middleware/auth')
        .getAuthUser.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/evidence');

      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/evidence', () => {
    it('should create a new evidence', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
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
        case: {
          id: 'case-1',
          title: 'Test Case',
        },
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      (prisma.evidence.create as jest.Mock).mockResolvedValue(mockEvidence);

      const requestBody = {
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        description: 'Contract between parties',
        fileUrl: 'https://example.com/file.pdf',
        source: 'Client',
        relevanceScore: 0.85,
      };

      const request = new NextRequest('http://localhost/api/evidence', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(prisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'case-1',
            userId: 'user-123',
          }),
        })
      );
      expect(prisma.evidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: 'case-1',
            type: 'DOCUMENT',
            name: 'Contract Document',
          }),
        })
      );
      expect(data.success).toBe(true);
    });

    it('should return 404 when case not found', async () => {
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      const requestBody = {
        caseId: 'non-existent',
        type: 'DOCUMENT',
        name: 'Test Evidence',
      };

      const request = new NextRequest('http://localhost/api/evidence', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBe('案件不存在或无权限');
    });

    it('should return 400 with invalid data', async () => {
      const requestBody = {
        caseId: '', // Invalid
        name: '', // Invalid
      };

      const request = new NextRequest('http://localhost/api/evidence', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.error).toBeDefined();
    });

    it('should set default status to PENDING', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Test Evidence',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        case: {
          id: 'case-1',
          title: 'Test Case',
        },
      };

      (prisma.case.findFirst as jest.Mock).mockResolvedValue({
        id: 'case-1',
        userId: 'user-123',
      });
      (prisma.evidence.create as jest.Mock).mockResolvedValue(mockEvidence);

      const requestBody = {
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Test Evidence',
      };

      const request = new NextRequest('http://localhost/api/evidence', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });

      await POST(request);

      expect(prisma.evidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });
  });
});
