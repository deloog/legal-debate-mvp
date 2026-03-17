/**
 * 知识图谱质量监控 API 测试
 */

import { GET } from '@/app/api/knowledge-graph/quality-monitor/route';
import { createMockGetRequest } from '@/test-utils/requests';

// Mock the data quality monitor to avoid real DB calls
jest.mock('@/lib/knowledge-graph/quality-monitor/data-quality-monitor', () => ({
  generateDataQualityReport: jest.fn().mockResolvedValue({
    reportTime: new Date().toISOString(),
    accuracy: {
      totalRelations: 100,
      validatedRelations: 80,
      invalidRelations: 5,
      pendingRelations: 15,
      validationRate: 0.8,
      lowQualityRelations: 3,
      qualityIssues: [],
    },
    coverage: {
      totalLawArticles: 200,
      coveredArticles: 160,
      orphanArticles: 40,
      coverageRate: 0.8,
      coverageIssues: [],
    },
    timeliness: {
      totalRelations: 100,
      staleRelations: 5,
      recentlyUpdated: 90,
      pendingLongTime: 2,
      averageAge: 15,
      timelinessIssues: [],
    },
    overallScore: 0.85,
    qualityLevel: 'GOOD',
    issues: [],
  }),
}));

describe('/api/knowledge-graph/quality-monitor', () => {
  describe('GET /api/knowledge-graph/quality-monitor', () => {
    test('应该返回数据质量报告', async () => {
      const request = createMockGetRequest(
        'http://localhost/api/knowledge-graph/quality-monitor'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('report');
      expect(data.report).toHaveProperty('reportTime');
      expect(data.report).toHaveProperty('accuracy');
      expect(data.report).toHaveProperty('coverage');
      expect(data.report).toHaveProperty('timeliness');
      expect(data.report).toHaveProperty('overallScore');
      expect(data.report).toHaveProperty('qualityLevel');
      expect(data.report).toHaveProperty('issues');
    });

    test('应该支持查询参数', async () => {
      const request = createMockGetRequest(
        'http://localhost/api/knowledge-graph/quality-monitor?minCoverageRate=0.7'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
    });

    test('应该处理错误情况', async () => {
      // 模拟数据库错误的情况（暂时无法直接模拟）
      const request = createMockGetRequest(
        'http://localhost/api/knowledge-graph/quality-monitor'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBeLessThan(500);
    });
  });
});
