/**
 * VerificationAgent 单元测试
 * TDD: Red-Green-Refactor
 *
 * 目标覆盖率: 85%+
 * 测试范围:
 * 1. 构造函数和配置
 * 2. verify() 完整验证流程
 * 3. 单项验证方法 (verifyFactual, verifyLogical, verifyCompleteness)
 * 4. 报告生成 (generateReport)
 * 5. 改进计划 (getImprovementPlan)
 * 6. 配置管理 (updateConfig, getConfig)
 * 7. 错误处理
 */

import {
  VerificationAgent,
  VerificationConfig,
  DEFAULT_VERIFICATION_CONFIG,
  IssueType,
  IssueSeverity,
  IssueCategory,
} from '@/lib/agent/verification-agent';

// Mock all dependencies
jest.mock('@/lib/agent/verification-agent/verifiers/factual-verifier');
jest.mock('@/lib/agent/verification-agent/verifiers/logical-verifier');
jest.mock('@/lib/agent/verification-agent/verifiers/completeness-verifier');
jest.mock('@/lib/agent/verification-agent/analyzers/score-calculator');
jest.mock('@/lib/agent/verification-agent/analyzers/issue-collector');
jest.mock('@/lib/agent/verification-agent/analyzers/suggestion-generator');

import { FactualVerifier } from '@/lib/agent/verification-agent/verifiers/factual-verifier';
import { LogicalVerifier } from '@/lib/agent/verification-agent/verifiers/logical-verifier';
import { CompletenessVerifier } from '@/lib/agent/verification-agent/verifiers/completeness-verifier';
import { ScoreCalculator } from '@/lib/agent/verification-agent/analyzers/score-calculator';
import { IssueCollector } from '@/lib/agent/verification-agent/analyzers/issue-collector';
import { SuggestionGenerator } from '@/lib/agent/verification-agent/analyzers/suggestion-generator';

describe('VerificationAgent', () => {
  let agent: VerificationAgent;

  // Mock implementations
  const mockFactualVerify = jest.fn();
  const mockLogicalVerify = jest.fn();
  const mockCompletenessVerify = jest.fn();
  const mockCalculateOverallScore = jest.fn();
  const mockCheckPassed = jest.fn();
  const mockCollectAllIssues = jest.fn();
  const mockGenerateSuggestions = jest.fn();
  const mockGetIssueStatistics = jest.fn();
  const mockGenerateSummary = jest.fn();
  const mockGenerateImprovementPlan = jest.fn();
  const mockGetScoreLevel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup verifier mocks
    (
      FactualVerifier as jest.MockedClass<typeof FactualVerifier>
    ).mockImplementation(
      () =>
        ({
          verify: mockFactualVerify,
        }) as any
    );

    (
      LogicalVerifier as jest.MockedClass<typeof LogicalVerifier>
    ).mockImplementation(
      () =>
        ({
          verify: mockLogicalVerify,
        }) as any
    );

    (
      CompletenessVerifier as jest.MockedClass<typeof CompletenessVerifier>
    ).mockImplementation(
      () =>
        ({
          verify: mockCompletenessVerify,
        }) as any
    );

    // Setup analyzer mocks
    (
      ScoreCalculator as jest.MockedClass<typeof ScoreCalculator>
    ).mockImplementation(
      () =>
        ({
          calculateOverallScore: mockCalculateOverallScore,
          checkPassed: mockCheckPassed,
          getScoreLevel: mockGetScoreLevel,
          updateConfig: jest.fn(),
        }) as any
    );

    (
      IssueCollector as jest.MockedClass<typeof IssueCollector>
    ).mockImplementation(
      () =>
        ({
          collectAllIssues: mockCollectAllIssues,
          getIssueStatistics: mockGetIssueStatistics,
        }) as any
    );

    (
      SuggestionGenerator as jest.MockedClass<typeof SuggestionGenerator>
    ).mockImplementation(
      () =>
        ({
          generateSuggestions: mockGenerateSuggestions,
          generateSummary: mockGenerateSummary,
          generateImprovementPlan: mockGenerateImprovementPlan,
        }) as any
    );

    agent = new VerificationAgent();
  });

  describe('构造函数', () => {
    it('应该使用默认配置初始化', () => {
      const config = agent.getConfig();
      expect(config.factualWeight).toBe(
        DEFAULT_VERIFICATION_CONFIG.factualWeight
      );
      expect(config.logicalWeight).toBe(
        DEFAULT_VERIFICATION_CONFIG.logicalWeight
      );
      expect(config.completenessWeight).toBe(
        DEFAULT_VERIFICATION_CONFIG.completenessWeight
      );
      expect(config.threshold).toBe(DEFAULT_VERIFICATION_CONFIG.threshold);
    });

    it('应该接受自定义配置', () => {
      const customConfig: Partial<VerificationConfig> = {
        threshold: 0.95,
        factualWeight: 0.5,
      };
      const customAgent = new VerificationAgent(customConfig);
      const config = customAgent.getConfig();
      expect(config.threshold).toBe(0.95);
      expect(config.factualWeight).toBe(0.5);
      expect(config.logicalWeight).toBe(
        DEFAULT_VERIFICATION_CONFIG.logicalWeight
      );
    });

    it('应该初始化所有验证器和分析器', () => {
      expect(FactualVerifier).toHaveBeenCalled();
      expect(LogicalVerifier).toHaveBeenCalled();
      expect(CompletenessVerifier).toHaveBeenCalled();
    });
  });

  describe('verify() - 完整验证', () => {
    const mockData = {
      title: '测试案件',
      parties: {
        plaintiff: '张三',
        defendant: '李四',
      },
      amounts: [{ field: '索赔金额', value: 100000 }],
    };

    const mockSource = {
      parties: {
        plaintiff: { name: '张三' },
        defendant: { name: '李四' },
      },
    };

    beforeEach(() => {
      const factualResult = {
        score: 0.95,
        passed: true,
        details: {
          partyCheck: {
            passed: true,
            details: {
              plaintiffValid: true,
              defendantValid: true,
              rolesMatch: true,
            },
            issues: [],
          },
          amountCheck: { passed: true, details: {}, issues: [] },
          dateCheck: { passed: true, details: {}, issues: [] },
          consistencyCheck: { passed: true, details: {}, issues: [] },
        },
      };

      const logicalResult = {
        score: 0.9,
        passed: true,
        details: {
          claimFactMatch: 0.92,
          reasoningChain: { passed: true, details: {}, issues: [] },
          legalLogic: { passed: true, details: {}, issues: [] },
          contradictions: { passed: true, details: {}, issues: [] },
        },
      };

      const completenessResult = {
        score: 0.88,
        passed: true,
        details: {
          requiredFields: { passed: true, missingFields: [], details: {} },
          businessRules: { passed: true, violations: [], details: {} },
          formatCheck: { passed: true, issues: [], details: {} },
          qualityCheck: { passed: true, details: {} },
        },
      };

      mockFactualVerify.mockResolvedValue(factualResult);
      mockLogicalVerify.mockResolvedValue(logicalResult);
      mockCompletenessVerify.mockResolvedValue(completenessResult);

      // Setup analyzer mocks
      mockCalculateOverallScore.mockReturnValue(0.914);
      mockCheckPassed.mockReturnValue(true);
      mockCollectAllIssues.mockReturnValue([]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('良好');
    });

    it('应该并行执行三重验证', async () => {
      await agent.verify(mockData, mockSource);

      expect(mockFactualVerify).toHaveBeenCalledWith(mockData, mockSource);
      expect(mockLogicalVerify).toHaveBeenCalledWith(mockData);
      expect(mockCompletenessVerify).toHaveBeenCalledWith(mockData);
    });

    it('应该计算加权综合评分', async () => {
      const result = await agent.verify(mockData, mockSource);

      // 默认权重: factual 40%, logical 30%, completeness 30%
      // expected = 0.95 * 0.4 + 0.90 * 0.3 + 0.88 * 0.3 = 0.914
      expect(result.overallScore).toBeCloseTo(0.914, 2);
    });

    it('应该返回各项验证分数', async () => {
      const result = await agent.verify(mockData, mockSource);

      expect(result.factualAccuracy).toBe(0.95);
      expect(result.logicalConsistency).toBe(0.9);
      expect(result.taskCompleteness).toBe(0.88);
    });

    it('应该在所有验证通过时返回passed=true', async () => {
      const result = await agent.verify(mockData, mockSource);
      expect(result.passed).toBe(true);
    });

    it('应该在任一验证失败时返回passed=false', async () => {
      mockFactualVerify.mockResolvedValue({
        score: 0.85,
        passed: false,
        details: {
          partyCheck: {
            passed: false,
            details: {
              plaintiffValid: false,
              defendantValid: true,
              rolesMatch: false,
            },
            issues: ['原告信息不匹配'],
          },
          amountCheck: { passed: true, details: {}, issues: [] },
          dateCheck: { passed: true, details: {}, issues: [] },
          consistencyCheck: { passed: true, details: {}, issues: [] },
        },
      });
      mockCheckPassed.mockReturnValue(false);

      const result = await agent.verify(mockData, mockSource);
      expect(result.passed).toBe(false);
    });

    it('应该收集所有验证发现的问题', async () => {
      mockFactualVerify.mockResolvedValue({
        score: 0.85,
        passed: false,
        details: {
          partyCheck: {
            passed: false,
            details: {
              plaintiffValid: false,
              defendantValid: true,
              rolesMatch: false,
            },
            issues: ['原告信息不匹配'],
          },
          amountCheck: { passed: true, details: {}, issues: [] },
          dateCheck: { passed: true, details: {}, issues: [] },
          consistencyCheck: { passed: true, details: {}, issues: [] },
        },
      });
      mockCollectAllIssues.mockReturnValue([
        {
          id: '1',
          type: IssueType.PARTY_MISMATCH,
          severity: IssueSeverity.HIGH,
          category: IssueCategory.FACTUAL,
          message: '原告信息不匹配',
          detectedBy: 'factual',
        },
      ]);

      const result = await agent.verify(mockData, mockSource);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('应该生成改进建议', async () => {
      const result = await agent.verify(mockData, mockSource);
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('应该记录验证耗时', async () => {
      const startTime = Date.now();
      const result = await agent.verify(mockData, mockSource);
      expect(result.verificationTime).toBeGreaterThanOrEqual(0);
      expect(result.verificationTime).toBeLessThan(
        Date.now() - startTime + 100
      );
    });

    it('应该在元数据中包含详细验证结果', async () => {
      const result = await agent.verify(mockData, mockSource);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.factualDetails).toBeDefined();
      expect(result.metadata?.logicalDetails).toBeDefined();
      expect(result.metadata?.completenessDetails).toBeDefined();
    });

    it('应该处理验证过程中的错误', async () => {
      mockFactualVerify.mockRejectedValue(new Error('验证服务异常'));

      const result = await agent.verify(mockData, mockSource);

      expect(result.passed).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe(IssueType.VALIDATION_ERROR);
      expect(result.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('应该支持无源数据验证', async () => {
      await agent.verify(mockData);

      expect(mockFactualVerify).toHaveBeenCalledWith(mockData, undefined);
    });
  });

  describe('单项验证方法', () => {
    const mockData = { title: '测试' };

    beforeEach(() => {
      mockFactualVerify.mockResolvedValue({
        score: 0.95,
        passed: true,
        details: {} as any,
      });

      mockLogicalVerify.mockResolvedValue({
        score: 0.9,
        passed: true,
        details: {} as any,
      });

      mockCompletenessVerify.mockResolvedValue({
        score: 0.88,
        passed: true,
        details: {} as any,
      });
    });

    it('verifyFactual应该只调用事实验证器', async () => {
      const result = await agent.verifyFactual(mockData, { parties: {} });

      expect(mockFactualVerify).toHaveBeenCalled();
      expect(mockLogicalVerify).not.toHaveBeenCalled();
      expect(mockCompletenessVerify).not.toHaveBeenCalled();
      expect(result.score).toBe(0.95);
    });

    it('verifyLogical应该只调用逻辑验证器', async () => {
      const result = await agent.verifyLogical(mockData);

      expect(mockFactualVerify).not.toHaveBeenCalled();
      expect(mockLogicalVerify).toHaveBeenCalled();
      expect(mockCompletenessVerify).not.toHaveBeenCalled();
      expect(result.score).toBe(0.9);
    });

    it('verifyCompleteness应该只调用完成度验证器', async () => {
      const result = await agent.verifyCompleteness(mockData);

      expect(mockFactualVerify).not.toHaveBeenCalled();
      expect(mockLogicalVerify).not.toHaveBeenCalled();
      expect(mockCompletenessVerify).toHaveBeenCalled();
      expect(result.score).toBe(0.88);
    });
  });

  describe('generateReport() - 报告生成', () => {
    const mockData = { title: '测试案件' };

    beforeEach(() => {
      const factualResult = {
        score: 0.95,
        passed: true,
        details: {
          partyCheck: {
            passed: true,
            details: {
              plaintiffValid: true,
              defendantValid: true,
              rolesMatch: true,
            },
            issues: [],
          },
          amountCheck: { passed: true, details: {}, issues: [] },
          dateCheck: { passed: true, details: {}, issues: [] },
          consistencyCheck: { passed: true, details: {}, issues: [] },
        },
      };

      mockFactualVerify.mockResolvedValue(factualResult);
      mockLogicalVerify.mockResolvedValue({
        score: 0.9,
        passed: true,
        details: {
          claimFactMatch: 0.92,
          reasoningChain: { passed: true, details: {}, issues: [] },
          legalLogic: { passed: true, details: {}, issues: [] },
          contradictions: { passed: true, details: {}, issues: [] },
        },
      });

      mockCompletenessVerify.mockResolvedValue({
        score: 0.88,
        passed: true,
        details: {
          requiredFields: { passed: true, missingFields: [], details: {} },
          businessRules: { passed: true, violations: [], details: {} },
          formatCheck: { passed: true, issues: [], details: {} },
          qualityCheck: { passed: true, details: {} },
        },
      });

      mockCalculateOverallScore.mockReturnValue(0.914);
      mockCheckPassed.mockReturnValue(true);
      mockCollectAllIssues.mockReturnValue([]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('良好');
      mockGetIssueStatistics.mockReturnValue({
        total: 0,
        bySeverity: {},
        byCategory: {},
      });
      mockGenerateSummary.mockReturnValue({
        total: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
        summary: '无需改进',
      });
    });

    it('应该生成包含摘要的报告', async () => {
      const report = await agent.generateReport(mockData);

      expect(report.summary).toBeDefined();
      expect(report.summary).toContain('综合评分');
      expect(report.summary).toContain('通过');
    });

    it('应该生成评分详情', async () => {
      const report = await agent.generateReport(mockData);

      expect(report.scores).toBeDefined();
      expect(report.scores.overall).toBeDefined();
      expect(report.scores.factual).toBeDefined();
      expect(report.scores.logical).toBeDefined();
      expect(report.scores.completeness).toBeDefined();
    });

    it('应该包含问题统计', async () => {
      const report = await agent.generateReport(mockData);

      expect(report.issues).toBeDefined();
      expect(report.issues.total).toBeDefined();
      expect(report.issues.bySeverity).toBeDefined();
      expect(report.issues.byCategory).toBeDefined();
    });

    it('应该包含建议统计', async () => {
      const report = await agent.generateReport(mockData);

      expect(report.suggestions).toBeDefined();
      expect(report.suggestions.total).toBeDefined();
      expect(report.suggestions.byPriority).toBeDefined();
      expect(report.suggestions.plan).toBeDefined();
    });
  });

  describe('getImprovementPlan() - 改进计划', () => {
    const mockData = { title: '测试案件' };

    beforeEach(() => {
      const factualResult = {
        score: 0.85,
        passed: false,
        details: {
          partyCheck: {
            passed: false,
            details: {
              plaintiffValid: false,
              defendantValid: true,
              rolesMatch: false,
            },
            issues: ['原告信息不匹配'],
          },
          amountCheck: { passed: true, details: {}, issues: [] },
          dateCheck: { passed: true, details: {}, issues: [] },
          consistencyCheck: { passed: true, details: {}, issues: [] },
        },
      };

      mockFactualVerify.mockResolvedValue(factualResult);
      mockLogicalVerify.mockResolvedValue({
        score: 0.9,
        passed: true,
        details: {
          claimFactMatch: 0.92,
          reasoningChain: { passed: true, details: {}, issues: [] },
          legalLogic: { passed: true, details: {}, issues: [] },
          contradictions: { passed: true, details: {}, issues: [] },
        },
      });

      mockCompletenessVerify.mockResolvedValue({
        score: 0.75,
        passed: false,
        details: {
          requiredFields: {
            passed: false,
            missingFields: ['description'],
            details: {},
          },
          businessRules: { passed: true, violations: [], details: {} },
          formatCheck: { passed: true, issues: [], details: {} },
          qualityCheck: { passed: true, details: {} },
        },
      });

      mockCalculateOverallScore.mockReturnValue(0.835);
      mockCheckPassed.mockReturnValue(false);
      mockCollectAllIssues.mockReturnValue([
        {
          id: '1',
          type: IssueType.PARTY_MISMATCH,
          severity: IssueSeverity.HIGH,
          category: IssueCategory.FACTUAL,
          message: '原告信息不匹配',
          detectedBy: 'factual',
        },
        {
          id: '2',
          type: IssueType.MISSING_REQUIRED_FIELD,
          severity: IssueSeverity.MEDIUM,
          category: IssueCategory.COMPLETENESS,
          message: '缺少描述',
          detectedBy: 'completeness',
        },
      ]);
      mockGenerateSuggestions.mockReturnValue([
        {
          id: '1',
          type: 'DATA_CORRECTION',
          priority: 'high',
          action: '修正原告信息',
          reason: '信息不匹配',
          estimatedImpact: '提高准确性',
        },
        {
          id: '2',
          type: 'DATA_COMPLETION',
          priority: 'medium',
          action: '添加描述',
          reason: '缺少必填字段',
          estimatedImpact: '提高完整性',
        },
      ]);
      mockGenerateImprovementPlan.mockReturnValue([
        {
          priority: 'high',
          suggestions: [
            {
              type: 'DATA_CORRECTION',
              action: '修正原告信息',
              reason: '信息不匹配',
              estimatedImpact: '提高准确性',
            },
          ],
          estimatedTime: '10分钟',
        },
        {
          priority: 'medium',
          suggestions: [
            {
              type: 'DATA_COMPLETION',
              action: '添加描述',
              reason: '缺少必填字段',
              estimatedImpact: '提高完整性',
            },
          ],
          estimatedTime: '5分钟',
        },
      ]);
    });

    it('应该返回按优先级分组的改进计划', async () => {
      const plan = await agent.getImprovementPlan(mockData);

      expect(Array.isArray(plan)).toBe(true);
      expect(plan.length).toBeGreaterThan(0);
    });

    it('应该包含优先级、数量和预估时间', async () => {
      const plan = await agent.getImprovementPlan(mockData);

      plan.forEach((item: any) => {
        expect(item.priority).toBeDefined();
        expect(item.count).toBeDefined();
        expect(item.estimatedTime).toBeDefined();
        expect(item.items).toBeDefined();
        expect(Array.isArray(item.items)).toBe(true);
      });
    });

    it('改进项应该包含类型、行动、原因和影响', async () => {
      const plan = await agent.getImprovementPlan(mockData);

      plan.forEach((item: any) => {
        item.items.forEach((subItem: any) => {
          expect(subItem.type).toBeDefined();
          expect(subItem.action).toBeDefined();
          expect(subItem.reason).toBeDefined();
          expect(subItem.impact).toBeDefined();
        });
      });
    });
  });

  describe('配置管理', () => {
    it('updateConfig应该更新配置', () => {
      agent.updateConfig({ threshold: 0.95 });
      const config = agent.getConfig();
      expect(config.threshold).toBe(0.95);
    });

    it('updateConfig应该合并配置而非替换', () => {
      const originalConfig = agent.getConfig();
      agent.updateConfig({ threshold: 0.95 });
      const newConfig = agent.getConfig();

      expect(newConfig.threshold).toBe(0.95);
      expect(newConfig.factualWeight).toBe(originalConfig.factualWeight);
    });

    it('getConfig应该返回深拷贝', () => {
      const config1 = agent.getConfig();
      const config2 = agent.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('修改返回的配置不应影响内部状态', () => {
      const config = agent.getConfig();
      config.threshold = 0.99;

      const newConfig = agent.getConfig();
      expect(newConfig.threshold).not.toBe(0.99);
    });
  });

  describe('辅助方法', () => {
    it('getIssueCollector应该返回问题收集器实例', () => {
      const collector = agent.getIssueCollector();
      expect(collector).toBeDefined();
    });

    it('getSuggestionGenerator应该返回建议生成器实例', () => {
      const generator = agent.getSuggestionGenerator();
      expect(generator).toBeDefined();
    });
  });

  describe('边界条件和分支覆盖', () => {
    const mockData = { title: '测试案件' };

    it('应该处理验证通过的情况', async () => {
      mockFactualVerify.mockResolvedValue({
        score: 0.95,
        passed: true,
        details: {},
      });
      mockLogicalVerify.mockResolvedValue({
        score: 0.95,
        passed: true,
        details: {},
      });
      mockCompletenessVerify.mockResolvedValue({
        score: 0.95,
        passed: true,
        details: {},
      });
      mockCalculateOverallScore.mockReturnValue(0.95);
      mockCheckPassed.mockReturnValue(true);
      mockCollectAllIssues.mockReturnValue([]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('优秀');
      mockGetIssueStatistics.mockReturnValue({
        total: 0,
        bySeverity: {},
        byCategory: {},
      });
      mockGenerateSummary.mockReturnValue({
        total: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
        summary: '无需改进',
      });

      const result = await agent.verify(mockData);

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('应该处理验证未通过的情况', async () => {
      mockFactualVerify.mockResolvedValue({
        score: 0.6,
        passed: false,
        details: {},
      });
      mockLogicalVerify.mockResolvedValue({
        score: 0.6,
        passed: false,
        details: {},
      });
      mockCompletenessVerify.mockResolvedValue({
        score: 0.6,
        passed: false,
        details: {},
      });
      mockCalculateOverallScore.mockReturnValue(0.6);
      mockCheckPassed.mockReturnValue(false);
      mockCollectAllIssues.mockReturnValue([
        {
          id: '1',
          type: IssueType.VALIDATION_ERROR,
          severity: IssueSeverity.HIGH,
          category: IssueCategory.FACTUAL,
          message: '验证失败',
          detectedBy: 'system',
        },
      ]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('较差');
      mockGetIssueStatistics.mockReturnValue({
        total: 1,
        bySeverity: { HIGH: 1 },
        byCategory: { FACTUAL: 1 },
      });
      mockGenerateSummary.mockReturnValue({
        total: 1,
        urgent: 0,
        high: 1,
        medium: 0,
        low: 0,
        summary: '需要改进',
      });

      const result = await agent.verify(mockData);

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(1);
    });

    it('应该处理部分验证器失败的情况', async () => {
      mockFactualVerify.mockRejectedValue(new Error('事实验证器错误'));

      const result = await agent.verify(mockData);

      expect(result.passed).toBe(false);
      expect(result.issues[0].type).toBe(IssueType.VALIDATION_ERROR);
      expect(result.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    });

    it('应该处理非Error类型的异常', async () => {
      mockFactualVerify.mockRejectedValue('字符串错误');

      const result = await agent.verify(mockData);

      expect(result.passed).toBe(false);
      expect(result.issues[0].message).toContain('未知错误');
    });

    it('应该处理包含所有可选字段的数据', async () => {
      const fullData = {
        title: '完整案件',
        description: '详细描述',
        type: 'case',
        parties: {
          plaintiff: '原告张三',
          defendant: '被告李四',
        },
        amounts: [{ field: 'claimAmount', value: 10000 }],
        dates: [{ field: 'incidentDate', value: '2024-01-01' }],
        claims: ['索赔1', '索赔2'],
        facts: ['事实1', '事实2'],
        arguments: ['论点1', '论点2'],
        legalBasis: [{ lawName: '民法典', articleNumber: '第1条' }],
        reasoning: '推理过程',
      };

      mockFactualVerify.mockResolvedValue({
        score: 0.9,
        passed: true,
        details: {},
      });
      mockLogicalVerify.mockResolvedValue({
        score: 0.9,
        passed: true,
        details: {},
      });
      mockCompletenessVerify.mockResolvedValue({
        score: 0.9,
        passed: true,
        details: {},
      });
      mockCalculateOverallScore.mockReturnValue(0.9);
      mockCheckPassed.mockReturnValue(true);
      mockCollectAllIssues.mockReturnValue([]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('良好');
      mockGetIssueStatistics.mockReturnValue({
        total: 0,
        bySeverity: {},
        byCategory: {},
      });
      mockGenerateSummary.mockReturnValue({
        total: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
        summary: '状态良好',
      });

      const result = await agent.verify(fullData);

      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(0.9);
    });

    it('应该处理空数据情况', async () => {
      mockFactualVerify.mockResolvedValue({
        score: 0,
        passed: false,
        details: {},
      });
      mockLogicalVerify.mockResolvedValue({
        score: 0,
        passed: false,
        details: {},
      });
      mockCompletenessVerify.mockResolvedValue({
        score: 0,
        passed: false,
        details: {},
      });
      mockCalculateOverallScore.mockReturnValue(0);
      mockCheckPassed.mockReturnValue(false);
      mockCollectAllIssues.mockReturnValue([
        {
          id: '1',
          type: IssueType.MISSING_REQUIRED_FIELD,
          severity: IssueSeverity.CRITICAL,
          category: IssueCategory.COMPLETENESS,
          message: '缺少必要字段',
          detectedBy: 'completeness',
        },
      ]);
      mockGenerateSuggestions.mockReturnValue([
        {
          id: '1',
          type: 'DATA_COMPLETION',
          priority: 'urgent',
          action: '添加必要字段',
          reason: '数据不完整',
          estimatedImpact: '提高完整性',
        },
      ]);
      mockGetScoreLevel.mockReturnValue('极差');
      mockGetIssueStatistics.mockReturnValue({
        total: 1,
        bySeverity: { CRITICAL: 1 },
        byCategory: { COMPLETENESS: 1 },
      });
      mockGenerateSummary.mockReturnValue({
        total: 1,
        urgent: 1,
        high: 0,
        medium: 0,
        low: 0,
        summary: '紧急需要改进',
      });

      const result = await agent.verify({});

      expect(result.passed).toBe(false);
      expect(result.overallScore).toBe(0);
    });

    it('应该处理带source参数的验证', async () => {
      const sourceData = {
        parties: {
          plaintiff: { name: '张三', id: 'P001' },
          defendant: { name: '李四', id: 'D001' },
        },
        amounts: [{ field: 'amount', value: 5000 }],
        dates: [{ field: 'date', value: '2024-01-01' }],
      };

      mockFactualVerify.mockResolvedValue({
        score: 0.88,
        passed: true,
        details: {},
      });
      mockLogicalVerify.mockResolvedValue({
        score: 0.88,
        passed: true,
        details: {},
      });
      mockCompletenessVerify.mockResolvedValue({
        score: 0.88,
        passed: true,
        details: {},
      });
      mockCalculateOverallScore.mockReturnValue(0.88);
      mockCheckPassed.mockReturnValue(true);
      mockCollectAllIssues.mockReturnValue([]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('良好');

      const result = await agent.verify(mockData, sourceData);

      expect(mockFactualVerify).toHaveBeenCalledWith(mockData, sourceData);
      expect(result.passed).toBe(true);
    });

    it('应该生成未通过状态的报告摘要', async () => {
      mockFactualVerify.mockResolvedValue({
        score: 0.65,
        passed: false,
        details: {},
      });
      mockLogicalVerify.mockResolvedValue({
        score: 0.65,
        passed: false,
        details: {},
      });
      mockCompletenessVerify.mockResolvedValue({
        score: 0.65,
        passed: false,
        details: {},
      });
      mockCalculateOverallScore.mockReturnValue(0.65);
      mockCheckPassed.mockReturnValue(false);
      mockCollectAllIssues.mockReturnValue([
        {
          id: '1',
          type: IssueType.VALIDATION_ERROR,
          severity: IssueSeverity.HIGH,
          category: IssueCategory.FACTUAL,
          message: '错误1',
          detectedBy: 'system',
        },
      ]);
      mockGenerateSuggestions.mockReturnValue([]);
      mockGetScoreLevel.mockReturnValue('一般');
      mockGetIssueStatistics.mockReturnValue({
        total: 1,
        bySeverity: { HIGH: 1 },
        byCategory: { FACTUAL: 1 },
      });
      mockGenerateSummary.mockReturnValue({
        total: 1,
        urgent: 0,
        high: 1,
        medium: 0,
        low: 0,
        summary: '需要改进',
      });

      const report = await agent.generateReport(mockData);

      expect(report.summary).toContain('未通过');
    });
  });
});
