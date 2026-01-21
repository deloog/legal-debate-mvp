import { NextRequest } from 'next/server';
import { POST } from '@/app/api/evidence/[id]/relations/route';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    evidence: {
      findFirst: jest.fn(),
    },
    evidenceRelation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    lawArticle: {
      findUnique: jest.fn(),
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

describe('Evidence Relations API - /api/evidence/[id]/relations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/evidence/[id]/relations', () => {
    it('should create a new evidence relation', async () => {
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
          userId: 'user-123',
        },
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);

      const mockRelation = {
        id: 'relation-1',
        evidenceId: 'evidence-1',
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
        description: '关联到民法典第X条',
        createdAt: new Date(),
      };

      (prisma.evidenceRelation.create as jest.Mock).mockResolvedValue(
        mockRelation
      );

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
        description: '关联到民法典第X条',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(prisma.evidence.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'evidence-1',
            deletedAt: null,
          }),
        })
      );
      expect(prisma.evidenceRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evidenceId: 'evidence-1',
            relationType: 'LEGAL_REFERENCE',
            relatedId: 'law-article-1',
          }),
        })
      );
      expect(data.success).toBe(true);
      expect(data.data.evidenceId).toBe('evidence-1');
    });

    it('should return 404 when evidence not found', async () => {
      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(null);

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
        description: '关联到民法典第X条',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/non-existent/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      const data = await response.json();

      expect(data.error).toBe('证据不存在');
      expect(response.status).toBe(404);
    });

    it('should return 403 when user has no permission', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        case: {
          id: 'case-1',
          userId: 'other-user-456',
        },
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
        description: '关联到民法典第X条',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(data.error).toBe('无权限');
      expect(response.status).toBe(403);
    });

    it('should return 409 when relation already exists', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        case: {
          id: 'case-1',
          userId: 'user-123',
        },
      };

      const mockExistingRelation = {
        id: 'existing-relation-1',
        evidenceId: 'evidence-1',
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);
      (prisma.evidenceRelation.findFirst as jest.Mock).mockResolvedValue(
        mockExistingRelation
      );

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
        description: '关联到民法典第X条',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(data.error).toBe('关联已存在');
      expect(response.status).toBe(409);
    });

    it('should return 400 with invalid relation type', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        case: {
          id: 'case-1',
          userId: 'user-123',
        },
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);

      const requestBody = {
        relationType: 'INVALID_TYPE',
        relatedId: 'law-article-1',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(data.error).toBeDefined();
    });

    it('should return 400 with missing required fields', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        case: {
          id: 'case-1',
          userId: 'user-123',
        },
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        // Missing required field: relatedId
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(data.error).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      jest
        .requireMock('@/lib/middleware/auth')
        .getAuthUser.mockResolvedValueOnce(null);

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-1',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      expect(response.status).toBe(401);
    });

    it('should create relation with legal reference and fetch related title', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        case: {
          id: 'case-1',
          userId: 'user-123',
        },
      };

      const mockRelation = {
        id: 'relation-2',
        evidenceId: 'evidence-1',
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-123',
        description: '关联到民法典第123条',
        createdAt: new Date(),
      };

      const mockLawArticle = {
        id: 'law-article-123',
        articleNumber: '民法典第123条',
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);
      (prisma.evidenceRelation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.evidenceRelation.create as jest.Mock).mockResolvedValue(
        mockRelation
      );
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockLawArticle
      );

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-123',
        description: '关联到民法典第123条',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(prisma.evidenceRelation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            evidenceId: 'evidence-1',
            relationType: 'LEGAL_REFERENCE',
            relatedId: 'law-article-123',
          }),
        })
      );
      expect(prisma.lawArticle.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'law-article-123' },
        })
      );
      expect(data.success).toBe(true);
      expect(data.data.relatedTitle).toBe('民法典第123条');
      expect(data.data.relatedType).toBe('法条');
    });

    it('should handle error when fetching related information', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        caseId: 'case-1',
        type: 'DOCUMENT',
        name: 'Contract Document',
        case: {
          id: 'case-1',
          userId: 'user-123',
        },
      };

      const mockRelation = {
        id: 'relation-3',
        evidenceId: 'evidence-1',
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-456',
        description: '关联到民法典第456条',
        createdAt: new Date(),
      };

      (prisma.evidence.findFirst as jest.Mock).mockResolvedValue(mockEvidence);
      (prisma.evidenceRelation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.evidenceRelation.create as jest.Mock).mockResolvedValue(
        mockRelation
      );
      (prisma.lawArticle.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const requestBody = {
        relationType: 'LEGAL_REFERENCE',
        relatedId: 'law-article-456',
        description: '关联到民法典第456条',
      };

      const request = new NextRequest(
        'http://localhost/api/evidence/evidence-1/relations',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: 'evidence-1' }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.relatedTitle).toBeUndefined();
      expect(data.data.relatedType).toBeUndefined();
    });
  });
});
