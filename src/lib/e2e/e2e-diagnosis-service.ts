/**
 * E2E诊断服务
 * 分析E2E测试失败原因，识别Mock配置、API响应、状态同步等问题
 */

/**
 * 问题类别枚举
 */
export enum ProblemCategory {
  MOCK_CONFIG = 'mock_config',
  API_RESPONSE = 'api_response',
  STATE_SYNC = 'state_sync',
  OTHER = 'other',
}

/**
 * 问题严重程度枚举
 */
export enum ProblemSeverity {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 测试结果接口
 */
export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  duration: number;
}

/**
 * 诊断问题接口
 */
export interface DiagnosisProblem {
  category: ProblemCategory;
  severity: ProblemSeverity;
  description: string;
  affectedTests: string[];
  suggestedFix: string;
}

/**
 * 问题分布接口
 */
export interface ProblemDistribution {
  mockConfig: number;
  apiResponse: number;
  stateSync: number;
  other: number;
}

/**
 * 诊断结果接口
 */
export interface DiagnosisResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  failureRate: number;
  problems: DiagnosisProblem[];
  problemDistribution: ProblemDistribution;
  recommendations: string[];
}

/**
 * E2E诊断服务类
 */
export class E2EDiagnosisService {
  // Mock配置问题的错误模式
  private readonly mockConfigPatterns = [
    { pattern: /fetch failed/i, description: 'API Mock未正确配置' },
    { pattern: /ECONNREFUSED/i, description: '网络连接被拒绝，Mock未配置' },
    { pattern: /rate limit/i, description: '真实AI服务未Mock，触发限流' },
    { pattern: /API key/i, description: 'API密钥问题，应使用Mock' },
    { pattern: /PrismaClient/i, description: '数据库Mock不完整' },
    { pattern: /Foreign key/i, description: '数据库外键约束，Mock数据不完整' },
    { pattern: /authentication/i, description: '认证服务未Mock' },
  ];

  // API响应问题的错误模式
  private readonly apiResponsePatterns = [
    { pattern: /Timeout/i, description: 'API超时配置不正确' },
    { pattern: /exceeded/i, description: '超时时间设置过短' },
    { pattern: /undefined/i, description: '响应格式不匹配' },
    { pattern: /Cannot read/i, description: '响应数据结构错误' },
    { pattern: /Unhandled rejection/i, description: '错误处理不完整' },
    { pattern: /500/i, description: '服务器错误未正确处理' },
    { pattern: /404/i, description: 'API路由未正确配置' },
  ];

  // 状态同步问题的错误模式
  private readonly stateSyncPatterns = [
    { pattern: /Element not found/i, description: '页面状态不同步' },
    { pattern: /not visible/i, description: '元素未渲染完成' },
    { pattern: /Expected.*but got/i, description: '异步操作未等待完成' },
    { pattern: /加载中/i, description: '数据加载状态未同步' },
    { pattern: /items/i, description: '列表数据未完全加载' },
    { pattern: /stale/i, description: '状态过期，需要刷新' },
  ];

  /**
   * 分析Mock配置问题
   */
  analyzeMockConfigProblems(testResults: TestResult[]): DiagnosisProblem[] {
    const problems: DiagnosisProblem[] = [];
    const failedTests = testResults.filter(t => t.status === 'failed');

    for (const test of failedTests) {
      if (!test.error) continue;

      for (const { pattern, description } of this.mockConfigPatterns) {
        if (pattern.test(test.error)) {
          const existingProblem = problems.find(
            p => p.description === description
          );

          if (existingProblem) {
            existingProblem.affectedTests.push(test.name);
          } else {
            problems.push({
              category: ProblemCategory.MOCK_CONFIG,
              severity: ProblemSeverity.HIGH,
              description,
              affectedTests: [test.name],
              suggestedFix: this.getMockConfigFix(description),
            });
          }
          break;
        }
      }
    }

    return problems;
  }

  /**
   * 分析API响应问题
   */
  analyzeAPIResponseProblems(testResults: TestResult[]): DiagnosisProblem[] {
    const problems: DiagnosisProblem[] = [];
    const failedTests = testResults.filter(t => t.status === 'failed');

    for (const test of failedTests) {
      if (!test.error) continue;

      for (const { pattern, description } of this.apiResponsePatterns) {
        if (pattern.test(test.error)) {
          const existingProblem = problems.find(
            p => p.description === description
          );

          if (existingProblem) {
            existingProblem.affectedTests.push(test.name);
          } else {
            problems.push({
              category: ProblemCategory.API_RESPONSE,
              severity: ProblemSeverity.MEDIUM,
              description,
              affectedTests: [test.name],
              suggestedFix: this.getAPIResponseFix(description),
            });
          }
          break;
        }
      }
    }

    return problems;
  }

  /**
   * 分析状态同步问题
   */
  analyzeStateSyncProblems(testResults: TestResult[]): DiagnosisProblem[] {
    const problems: DiagnosisProblem[] = [];
    const failedTests = testResults.filter(t => t.status === 'failed');

    for (const test of failedTests) {
      if (!test.error) continue;

      for (const { pattern, description } of this.stateSyncPatterns) {
        if (pattern.test(test.error)) {
          const existingProblem = problems.find(
            p => p.description === description
          );

          if (existingProblem) {
            existingProblem.affectedTests.push(test.name);
          } else {
            problems.push({
              category: ProblemCategory.STATE_SYNC,
              severity: ProblemSeverity.LOW,
              description,
              affectedTests: [test.name],
              suggestedFix: this.getStateSyncFix(description),
            });
          }
          break;
        }
      }
    }

    return problems;
  }

  /**
   * 综合诊断
   */
  diagnose(testResults: TestResult[]): DiagnosisResult {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.status === 'passed').length;
    const failedTests = testResults.filter(t => t.status === 'failed').length;
    const skippedTests = testResults.filter(t => t.status === 'skipped').length;
    const failureRate = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;

    // 分析各类问题
    const mockProblems = this.analyzeMockConfigProblems(testResults);
    const apiProblems = this.analyzeAPIResponseProblems(testResults);
    const stateProblems = this.analyzeStateSyncProblems(testResults);

    // 合并并排序问题
    const allProblems = [...mockProblems, ...apiProblems, ...stateProblems];
    allProblems.sort((a, b) => {
      const severityOrder = {
        [ProblemSeverity.HIGH]: 0,
        [ProblemSeverity.MEDIUM]: 1,
        [ProblemSeverity.LOW]: 2,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // 计算问题分布
    const problemDistribution = this.calculateDistribution(
      mockProblems,
      apiProblems,
      stateProblems,
      failedTests
    );

    // 生成建议
    const recommendations = this.generateRecommendations(allProblems);

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      failureRate,
      problems: allProblems,
      problemDistribution,
      recommendations,
    };
  }

  /**
   * 获取问题严重程度
   */
  getSeverity(category: ProblemCategory): ProblemSeverity {
    switch (category) {
      case ProblemCategory.MOCK_CONFIG:
        return ProblemSeverity.HIGH;
      case ProblemCategory.API_RESPONSE:
        return ProblemSeverity.MEDIUM;
      case ProblemCategory.STATE_SYNC:
        return ProblemSeverity.LOW;
      default:
        return ProblemSeverity.LOW;
    }
  }

  /**
   * 计算问题分布
   */
  private calculateDistribution(
    mockProblems: DiagnosisProblem[],
    apiProblems: DiagnosisProblem[],
    stateProblems: DiagnosisProblem[],
    totalFailed: number
  ): ProblemDistribution {
    if (totalFailed === 0) {
      return { mockConfig: 0, apiResponse: 0, stateSync: 0, other: 0 };
    }

    const mockCount = mockProblems.reduce(
      (sum, p) => sum + p.affectedTests.length,
      0
    );
    const apiCount = apiProblems.reduce(
      (sum, p) => sum + p.affectedTests.length,
      0
    );
    const stateCount = stateProblems.reduce(
      (sum, p) => sum + p.affectedTests.length,
      0
    );
    const identifiedCount = mockCount + apiCount + stateCount;
    const otherCount = Math.max(0, totalFailed - identifiedCount);

    return {
      mockConfig: Math.round((mockCount / totalFailed) * 100),
      apiResponse: Math.round((apiCount / totalFailed) * 100),
      stateSync: Math.round((stateCount / totalFailed) * 100),
      other: Math.round((otherCount / totalFailed) * 100),
    };
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(problems: DiagnosisProblem[]): string[] {
    const recommendations: string[] = [];
    const categories = new Set(problems.map(p => p.category));

    if (categories.has(ProblemCategory.MOCK_CONFIG)) {
      recommendations.push('配置完整的API Mock拦截器');
      recommendations.push('确保所有外部服务调用都被Mock');
    }

    if (categories.has(ProblemCategory.API_RESPONSE)) {
      recommendations.push('增加API超时时间配置');
      recommendations.push('完善API错误处理逻辑');
    }

    if (categories.has(ProblemCategory.STATE_SYNC)) {
      recommendations.push('使用waitForSelector等待元素渲染');
      recommendations.push('添加适当的等待时间处理异步操作');
    }

    return recommendations;
  }

  /**
   * 获取Mock配置修复建议
   */
  private getMockConfigFix(description: string): string {
    const fixes: Record<string, string> = {
      'API Mock未正确配置': '在测试setup中配置page.route拦截API请求',
      '网络连接被拒绝，Mock未配置': '确保Mock服务器正确启动或配置网络拦截',
      '真实AI服务未Mock，触发限流': '使用Mock数据替代真实AI服务调用',
      'API密钥问题，应使用Mock': '配置Mock环境变量或拦截认证请求',
      数据库Mock不完整: '完善Prisma Mock配置，确保所有查询被拦截',
      '数据库外键约束，Mock数据不完整': '在Mock数据中添加完整的关联数据',
      认证服务未Mock: '配置认证服务Mock，返回测试用户token',
    };
    return fixes[description] || '检查并完善Mock配置';
  }

  /**
   * 获取API响应修复建议
   */
  private getAPIResponseFix(description: string): string {
    const fixes: Record<string, string> = {
      API超时配置不正确: '增加test.setTimeout或配置更长的超时时间',
      超时时间设置过短: '根据实际API响应时间调整超时配置',
      响应格式不匹配: '检查Mock响应数据结构是否与实际API一致',
      响应数据结构错误: '更新Mock数据以匹配API响应格式',
      错误处理不完整: '添加try-catch处理API错误响应',
      服务器错误未正确处理: '实现500错误的降级处理逻辑',
      API路由未正确配置: '检查API路由配置和Mock路由匹配',
    };
    return fixes[description] || '检查API响应处理逻辑';
  }

  /**
   * 获取状态同步修复建议
   */
  private getStateSyncFix(description: string): string {
    const fixes: Record<string, string> = {
      页面状态不同步: '使用waitForSelector等待元素出现',
      元素未渲染完成: '添加waitForLoadState等待页面加载完成',
      异步操作未等待完成: '使用Promise.all或await等待所有异步操作',
      数据加载状态未同步: '等待加载状态变化后再进行断言',
      列表数据未完全加载: '使用waitForFunction等待数据加载完成',
      '状态过期，需要刷新': '在操作前刷新页面或重新获取状态',
    };
    return fixes[description] || '添加适当的等待逻辑';
  }
}
