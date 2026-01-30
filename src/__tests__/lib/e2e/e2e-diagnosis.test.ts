/**
 * E2E诊断服务测试
 * 测试E2E测试问题诊断功能
 */

import {
  E2EDiagnosisService,
  DiagnosisResult,
  ProblemCategory,
  ProblemSeverity,
} from '../../../lib/e2e/e2e-diagnosis-service';

describe('E2EDiagnosisService', () => {
  let service: E2EDiagnosisService;

  beforeEach(() => {
    service = new E2EDiagnosisService();
  });

  describe('analyzeMockConfigProblems', () => {
    it('应该识别API Mock未配置的问题', () => {
      const testResults = [
        {
          name: 'AI服务调用测试',
          status: 'failed' as const,
          error: 'fetch failed: ECONNREFUSED',
          duration: 5000,
        },
      ];

      const problems = service.analyzeMockConfigProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0].category).toBe(ProblemCategory.MOCK_CONFIG);
      expect(problems[0].description).toContain('Mock');
    });

    it('应该识别真实AI服务未Mock的问题', () => {
      const testResults = [
        {
          name: '文档解析测试',
          status: 'failed' as const,
          error: 'API rate limit exceeded',
          duration: 30000,
        },
      ];

      const problems = service.analyzeMockConfigProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some(p => p.description.includes('AI服务'))).toBe(true);
    });

    it('应该识别数据库Mock不完整的问题', () => {
      const testResults = [
        {
          name: '案件创建测试',
          status: 'failed' as const,
          error: 'PrismaClientKnownRequestError: Foreign key constraint failed',
          duration: 1000,
        },
      ];

      const problems = service.analyzeMockConfigProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some(p => p.description.includes('数据库'))).toBe(true);
    });

    it('应该返回空数组当没有Mock配置问题时', () => {
      const testResults = [
        {
          name: '成功的测试',
          status: 'passed' as const,
          duration: 1000,
        },
      ];

      const problems = service.analyzeMockConfigProblems(testResults);

      expect(problems).toEqual([]);
    });
  });

  describe('analyzeAPIResponseProblems', () => {
    it('应该识别超时配置不正确的问题', () => {
      const testResults = [
        {
          name: '辩论生成测试',
          status: 'failed' as const,
          error: 'Timeout of 5000ms exceeded',
          duration: 5000,
        },
      ];

      const problems = service.analyzeAPIResponseProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0].category).toBe(ProblemCategory.API_RESPONSE);
      expect(problems[0].description).toContain('超时');
    });

    it('应该识别响应格式不匹配的问题', () => {
      const testResults = [
        {
          name: '法条检索测试',
          status: 'failed' as const,
          error: "Cannot read property 'data' of undefined",
          duration: 2000,
        },
      ];

      const problems = service.analyzeAPIResponseProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some(p => p.description.includes('响应格式'))).toBe(true);
    });

    it('应该识别错误处理不完整的问题', () => {
      const testResults = [
        {
          name: 'API错误处理测试',
          status: 'failed' as const,
          error: 'Unhandled rejection: Error 500',
          duration: 1500,
        },
      ];

      const problems = service.analyzeAPIResponseProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some(p => p.description.includes('错误处理'))).toBe(true);
    });

    it('应该返回空数组当没有API响应问题时', () => {
      const testResults = [
        {
          name: '成功的API测试',
          status: 'passed' as const,
          duration: 500,
        },
      ];

      const problems = service.analyzeAPIResponseProblems(testResults);

      expect(problems).toEqual([]);
    });
  });

  describe('analyzeStateSyncProblems', () => {
    it('应该识别页面状态不同步的问题', () => {
      const testResults = [
        {
          name: '页面导航测试',
          status: 'failed' as const,
          error: 'Element not found: .case-list',
          duration: 3000,
        },
      ];

      const problems = service.analyzeStateSyncProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0].category).toBe(ProblemCategory.STATE_SYNC);
    });

    it('应该识别异步操作未等待的问题', () => {
      const testResults = [
        {
          name: '数据加载测试',
          status: 'failed' as const,
          error: 'Expected element to have text "加载完成" but got "加载中..."',
          duration: 2000,
        },
      ];

      const problems = service.analyzeStateSyncProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some(p => p.description.includes('异步'))).toBe(true);
    });

    it('应该识别条件断言不稳定的问题', () => {
      const testResults = [
        {
          name: '列表渲染测试',
          status: 'failed' as const,
          error: 'Expected 5 items but got 3',
          duration: 1000,
        },
      ];

      const problems = service.analyzeStateSyncProblems(testResults);

      expect(problems.length).toBeGreaterThan(0);
    });

    it('应该返回空数组当没有状态同步问题时', () => {
      const testResults = [
        {
          name: '成功的状态测试',
          status: 'passed' as const,
          duration: 800,
        },
      ];

      const problems = service.analyzeStateSyncProblems(testResults);

      expect(problems).toEqual([]);
    });
  });

  describe('diagnose', () => {
    it('应该综合分析所有问题类型', () => {
      const testResults = [
        {
          name: 'Mock问题测试',
          status: 'failed' as const,
          error: 'fetch failed: ECONNREFUSED',
          duration: 5000,
        },
        {
          name: 'API超时测试',
          status: 'failed' as const,
          error: 'Timeout of 5000ms exceeded',
          duration: 5000,
        },
        {
          name: '状态同步测试',
          status: 'failed' as const,
          error: 'Element not found',
          duration: 3000,
        },
        {
          name: '成功测试',
          status: 'passed' as const,
          duration: 1000,
        },
      ];

      const result = service.diagnose(testResults);

      expect(result.totalTests).toBe(4);
      expect(result.failedTests).toBe(3);
      expect(result.passedTests).toBe(1);
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it('应该计算正确的失败率', () => {
      const testResults = [
        {
          name: '测试1',
          status: 'failed' as const,
          error: 'error',
          duration: 1000,
        },
        {
          name: '测试2',
          status: 'failed' as const,
          error: 'error',
          duration: 1000,
        },
        { name: '测试3', status: 'passed' as const, duration: 1000 },
        { name: '测试4', status: 'passed' as const, duration: 1000 },
      ];

      const result = service.diagnose(testResults);

      expect(result.failureRate).toBe(50);
    });

    it('应该按严重程度排序问题', () => {
      const testResults = [
        {
          name: '低优先级问题',
          status: 'failed' as const,
          error: 'Expected 5 items but got 3',
          duration: 1000,
        },
        {
          name: '高优先级问题',
          status: 'failed' as const,
          error: 'fetch failed: ECONNREFUSED',
          duration: 5000,
        },
      ];

      const result = service.diagnose(testResults);

      // 高严重程度的问题应该排在前面
      const severities = result.problems.map(p => p.severity);
      const highIndex = severities.indexOf(ProblemSeverity.HIGH);
      const lowIndex = severities.indexOf(ProblemSeverity.LOW);

      if (highIndex !== -1 && lowIndex !== -1) {
        expect(highIndex).toBeLessThan(lowIndex);
      }
    });

    it('应该生成修复建议', () => {
      const testResults = [
        {
          name: 'Mock问题测试',
          status: 'failed' as const,
          error: 'fetch failed: ECONNREFUSED',
          duration: 5000,
        },
      ];

      const result = service.diagnose(testResults);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('应该处理空测试结果', () => {
      const result = service.diagnose([]);

      expect(result.totalTests).toBe(0);
      expect(result.failedTests).toBe(0);
      expect(result.passedTests).toBe(0);
      expect(result.failureRate).toBe(0);
      expect(result.problems).toEqual([]);
    });

    it('应该处理全部通过的测试', () => {
      const testResults = [
        { name: '测试1', status: 'passed' as const, duration: 1000 },
        { name: '测试2', status: 'passed' as const, duration: 1000 },
      ];

      const result = service.diagnose(testResults);

      expect(result.failureRate).toBe(0);
      expect(result.problems).toEqual([]);
    });
  });

  describe('calculateProblemDistribution', () => {
    it('应该正确计算问题分布', () => {
      const testResults = [
        // Mock问题 - 3个
        {
          name: '测试1',
          status: 'failed' as const,
          error: 'fetch failed',
          duration: 1000,
        },
        {
          name: '测试2',
          status: 'failed' as const,
          error: 'ECONNREFUSED',
          duration: 1000,
        },
        {
          name: '测试3',
          status: 'failed' as const,
          error: 'rate limit',
          duration: 1000,
        },
        // API问题 - 2个
        {
          name: '测试4',
          status: 'failed' as const,
          error: 'Timeout exceeded',
          duration: 5000,
        },
        {
          name: '测试5',
          status: 'failed' as const,
          error: 'undefined data',
          duration: 1000,
        },
        // 状态同步问题 - 1个
        {
          name: '测试6',
          status: 'failed' as const,
          error: 'Element not found',
          duration: 1000,
        },
        // 通过的测试 - 4个
        { name: '测试7', status: 'passed' as const, duration: 1000 },
        { name: '测试8', status: 'passed' as const, duration: 1000 },
        { name: '测试9', status: 'passed' as const, duration: 1000 },
        { name: '测试10', status: 'passed' as const, duration: 1000 },
      ];

      const result = service.diagnose(testResults);
      const distribution = result.problemDistribution;

      expect(distribution.mockConfig).toBeGreaterThan(0);
      expect(distribution.apiResponse).toBeGreaterThan(0);
      expect(distribution.stateSync).toBeGreaterThan(0);
    });
  });

  describe('getSeverity', () => {
    it('应该为Mock配置问题返回HIGH严重程度', () => {
      const severity = service.getSeverity(ProblemCategory.MOCK_CONFIG);
      expect(severity).toBe(ProblemSeverity.HIGH);
    });

    it('应该为API响应问题返回MEDIUM严重程度', () => {
      const severity = service.getSeverity(ProblemCategory.API_RESPONSE);
      expect(severity).toBe(ProblemSeverity.MEDIUM);
    });

    it('应该为状态同步问题返回LOW严重程度', () => {
      const severity = service.getSeverity(ProblemCategory.STATE_SYNC);
      expect(severity).toBe(ProblemSeverity.LOW);
    });
  });
});
