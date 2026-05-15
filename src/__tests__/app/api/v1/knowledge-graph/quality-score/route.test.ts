// =============================================================================
// 知识图谱质量评分系统 - API路由测试
// =============================================================================

import { POST, GET } from '@/app/api/v1/knowledge-graph/quality-score/route';
import {
  POST as POSTId,
  GET as GETId,
} from '@/app/api/v1/knowledge-graph/quality-score/[id]/route';
import { GET as GETLowQuality } from '@/app/api/v1/knowledge-graph/quality-score/low-quality/route';
import { GET as GETWarning } from '@/app/api/v1/knowledge-graph/quality-score/warning/route';

jest.mock('@/lib/logger');
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));
jest.mock('@/lib/middleware/knowledge-graph-permission');
jest.mock('@/lib/knowledge-graph/quality-score/quality-score-service');

import { getAuthUser } from '@/lib/middleware/auth';
import { checkKnowledgeGraphPermission } from '@/lib/middleware/knowledge-graph-permission';
import { QualityScoreService } from '@/lib/knowledge-graph/quality-score/quality-score-service';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCheckPermission = checkKnowledgeGraphPermission as jest.Mock;
const mockQualityScoreService = QualityScoreService as jest.Mock;

describe('Quality Score API Routes', () => {
  let mockRequest: any;
  let mockService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      userId: 'user1',
      email: 'user1@example.com',
      role: 'ADMIN',
    });
    mockService = {
      getQualityStats: jest.fn(),
      batchCalculateQuality: jest.fn(),
      getRelationQualityScore: jest.fn(),
      updateRelationScore: jest.fn(),
      getLowQualityRelations: jest.fn(),
      triggerQualityWarning: jest.fn(),
    };
    mockQualityScoreService.mockImplementation(() => mockService);
  });

  describe('GET /api/v1/knowledge-graph/quality-score', () => {
    it('成功获取质量统计', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.getQualityStats.mockResolvedValue({
        totalRelations: 100,
        averageScore: 75.5,
      });

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalRelations).toBe(100);
    });

    it('未授权时返回401', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('权限不足时返回403', async () => {
      mockCheckPermission.mockResolvedValue({
        hasPermission: false,
        reason: '需要管理员权限',
      });

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('需要管理员权限');
    });
  });

  describe('POST /api/v1/knowledge-graph/quality-score', () => {
    it('成功批量计算质量分数', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.batchCalculateQuality.mockResolvedValue([
        { relationId: 'rel1', qualityScore: 85 },
        { relationId: 'rel2', qualityScore: 90 },
      ]);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score',
        method: 'POST',
        body: JSON.stringify({
          relationIds: ['rel1', 'rel2'],
        }),
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score'
        ),
        page: null,
        ua: '',
        json: async () => ({ relationIds: ['rel1', 'rel2'] }),
      } as any;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('未授权时返回401', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score',
        method: 'POST',
        body: JSON.stringify({ relationIds: ['rel1'] }),
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score'
        ),
        page: null,
        ua: '',
        json: async () => ({ relationIds: ['rel1'] }),
      } as any;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });
  });

  describe('GET /api/v1/knowledge-graph/quality-score/[id]', () => {
    it('成功获取单个关系质量分数', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.getRelationQualityScore.mockResolvedValue({
        relationId: 'rel1',
        qualityScore: 85,
        qualityLevel: 'high',
      });

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/rel1',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/rel1'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GETId(mockRequest, {
        params: Promise.resolve({ id: 'rel1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relationId).toBe('rel1');
    });

    it('质量分数不存在时返回404', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.getRelationQualityScore.mockRejectedValue(
        new Error('Quality score not found')
      );

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/nonexistent',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/nonexistent'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GETId(mockRequest, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('质量分数不存在');
    });
  });

  describe('POST /api/v1/knowledge-graph/quality-score/[id]', () => {
    it('成功更新关系质量分数', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.updateRelationScore.mockResolvedValue({
        relationId: 'rel1',
        qualityScore: 90,
        verificationCount: 6,
      });

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/rel1',
        method: 'POST',
        body: JSON.stringify({
          incrementVerification: true,
        }),
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/rel1'
        ),
        page: null,
        ua: '',
        json: async () => ({ incrementVerification: true }),
      } as any;

      const response = await POSTId(mockRequest, {
        params: Promise.resolve({ id: 'rel1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relationId).toBe('rel1');
    });
  });

  describe('GET /api/v1/knowledge-graph/quality-score/low-quality', () => {
    it('成功获取低质量关系列表', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.getLowQualityRelations.mockResolvedValue([
        {
          relationId: 'rel1',
          qualityScore: 30,
          qualityLevel: 'low',
        },
      ]);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/low-quality?qualityLevel=low&limit=10',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/low-quality?qualityLevel=low&limit=10'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GETLowQuality(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it('支持查询参数', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.getLowQualityRelations.mockResolvedValue([]);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/low-quality?qualityLevel=medium&limit=20&offset=5',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/low-quality?qualityLevel=medium&limit=20&offset=5'
        ),
        page: null,
        ua: '',
      } as any;

      await GETLowQuality(mockRequest);

      expect(mockService.getLowQualityRelations).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityLevel: 'medium',
          limit: 20,
          offset: 5,
        })
      );
    });
  });

  describe('GET /api/v1/knowledge-graph/quality-score/warning', () => {
    it('成功触发质量预警', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.triggerQualityWarning.mockResolvedValue([
        {
          relationId: 'rel1',
          qualityScore: 20,
          qualityLevel: 'low',
          warningType: 'low_quality',
        },
      ]);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/warning',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/warning'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GETWarning(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it('无预警时返回空数组', async () => {
      mockCheckPermission.mockResolvedValue({ hasPermission: true });
      mockService.triggerQualityWarning.mockResolvedValue([]);

      mockRequest = {
        url: 'http://localhost:3000/api/v1/knowledge-graph/quality-score/warning',
        method: 'GET',
        cookies: new Map(),
        nextUrl: new URL(
          'http://localhost:3000/api/v1/knowledge-graph/quality-score/warning'
        ),
        page: null,
        ua: '',
      } as any;

      const response = await GETWarning(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
    });
  });
});
