/**
 * E2E诊断报告生成器测试
 * 测试诊断报告生成功能
 */

import {
  E2EDiagnosisReportGenerator,
  DiagnosisReport,
} from '../../../lib/e2e/e2e-diagnosis-report-generator';
import {
  DiagnosisResult,
  ProblemCategory,
  ProblemSeverity,
  DiagnosisProblem,
} from '../../../lib/e2e/e2e-diagnosis-service';

describe('E2EDiagnosisReportGenerator', () => {
  let generator: E2EDiagnosisReportGenerator;

  beforeEach(() => {
    generator = new E2EDiagnosisReportGenerator();
  });

  describe('generateReport', () => {
    it('应该生成完整的诊断报告', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 6,
        failedTests: 4,
        skippedTests: 0,
        failureRate: 40,
        problems: [
          {
            category: ProblemCategory.MOCK_CONFIG,
            severity: ProblemSeverity.HIGH,
            description: 'API Mock未正确配置',
            affectedTests: ['测试1', '测试2'],
            suggestedFix: '配置Mock拦截器',
          },
        ],
        problemDistribution: {
          mockConfig: 30,
          apiResponse: 25,
          stateSync: 10,
          other: 35,
        },
        recommendations: ['配置完整的Mock', '增加超时时间'],
      };

      const report = generator.generateReport(diagnosisResult);

      expect(report.summary).toBeDefined();
      expect(report.summary.totalTests).toBe(10);
      expect(report.summary.failureRate).toBe(40);
      expect(report.problems).toHaveLength(1);
      expect(report.recommendations).toHaveLength(2);
    });

    it('应该包含执行时间戳', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        skippedTests: 0,
        failureRate: 0,
        problems: [],
        problemDistribution: {
          mockConfig: 0,
          apiResponse: 0,
          stateSync: 0,
          other: 0,
        },
        recommendations: [],
      };

      const report = generator.generateReport(diagnosisResult);

      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp).getTime()).not.toBeNaN();
    });

    it('应该正确分类问题', () => {
      const problems: DiagnosisProblem[] = [
        {
          category: ProblemCategory.MOCK_CONFIG,
          severity: ProblemSeverity.HIGH,
          description: 'Mock问题1',
          affectedTests: ['测试1'],
          suggestedFix: '修复1',
        },
        {
          category: ProblemCategory.API_RESPONSE,
          severity: ProblemSeverity.MEDIUM,
          description: 'API问题1',
          affectedTests: ['测试2'],
          suggestedFix: '修复2',
        },
        {
          category: ProblemCategory.STATE_SYNC,
          severity: ProblemSeverity.LOW,
          description: '状态问题1',
          affectedTests: ['测试3'],
          suggestedFix: '修复3',
        },
      ];

      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 7,
        failedTests: 3,
        skippedTests: 0,
        failureRate: 30,
        problems,
        problemDistribution: {
          mockConfig: 10,
          apiResponse: 10,
          stateSync: 10,
          other: 0,
        },
        recommendations: [],
      };

      const report = generator.generateReport(diagnosisResult);

      expect(report.problemsByCategory.mockConfig).toHaveLength(1);
      expect(report.problemsByCategory.apiResponse).toHaveLength(1);
      expect(report.problemsByCategory.stateSync).toHaveLength(1);
    });
  });

  describe('generateMarkdown', () => {
    it('应该生成有效的Markdown格式报告', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 6,
        failedTests: 4,
        skippedTests: 0,
        failureRate: 40,
        problems: [
          {
            category: ProblemCategory.MOCK_CONFIG,
            severity: ProblemSeverity.HIGH,
            description: 'API Mock未正确配置',
            affectedTests: ['测试1'],
            suggestedFix: '配置Mock拦截器',
          },
        ],
        problemDistribution: {
          mockConfig: 30,
          apiResponse: 25,
          stateSync: 10,
          other: 35,
        },
        recommendations: ['配置完整的Mock'],
      };

      const markdown = generator.generateMarkdown(diagnosisResult);

      expect(markdown).toContain('# E2E测试诊断报告');
      expect(markdown).toContain('## 概要');
      expect(markdown).toContain('## 问题分析');
      expect(markdown).toContain('## 修复建议');
      expect(markdown).toContain('Mock配置问题');
    });

    it('应该包含问题分布统计', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 4,
        failedTests: 6,
        skippedTests: 0,
        failureRate: 60,
        problems: [],
        problemDistribution: {
          mockConfig: 30,
          apiResponse: 25,
          stateSync: 10,
          other: 35,
        },
        recommendations: [],
      };

      const markdown = generator.generateMarkdown(diagnosisResult);

      expect(markdown).toContain('30%');
      expect(markdown).toContain('25%');
      expect(markdown).toContain('10%');
    });

    it('应该在没有问题时显示成功信息', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        failureRate: 0,
        problems: [],
        problemDistribution: {
          mockConfig: 0,
          apiResponse: 0,
          stateSync: 0,
          other: 0,
        },
        recommendations: [],
      };

      const markdown = generator.generateMarkdown(diagnosisResult);

      expect(markdown).toContain('所有测试通过');
    });
  });

  describe('generateJSON', () => {
    it('应该生成有效的JSON格式报告', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 5,
        passedTests: 3,
        failedTests: 2,
        skippedTests: 0,
        failureRate: 40,
        problems: [],
        problemDistribution: {
          mockConfig: 20,
          apiResponse: 20,
          stateSync: 0,
          other: 0,
        },
        recommendations: [],
      };

      const json = generator.generateJSON(diagnosisResult);
      const parsed = JSON.parse(json);

      expect(parsed.summary.totalTests).toBe(5);
      expect(parsed.summary.failureRate).toBe(40);
    });

    it('应该包含所有必要字段', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        failureRate: 20,
        problems: [
          {
            category: ProblemCategory.MOCK_CONFIG,
            severity: ProblemSeverity.HIGH,
            description: '测试问题',
            affectedTests: ['测试1'],
            suggestedFix: '修复方案',
          },
        ],
        problemDistribution: {
          mockConfig: 10,
          apiResponse: 10,
          stateSync: 0,
          other: 0,
        },
        recommendations: ['建议1'],
      };

      const json = generator.generateJSON(diagnosisResult);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('problems');
      expect(parsed).toHaveProperty('problemDistribution');
      expect(parsed).toHaveProperty('recommendations');
    });
  });

  describe('calculateHealthScore', () => {
    it('应该为100%通过率返回100分', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        failureRate: 0,
        problems: [],
        problemDistribution: {
          mockConfig: 0,
          apiResponse: 0,
          stateSync: 0,
          other: 0,
        },
        recommendations: [],
      };

      const score = generator.calculateHealthScore(diagnosisResult);

      expect(score).toBe(100);
    });

    it('应该根据失败率降低分数', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 5,
        failedTests: 5,
        skippedTests: 0,
        failureRate: 50,
        problems: [],
        problemDistribution: {
          mockConfig: 0,
          apiResponse: 0,
          stateSync: 0,
          other: 0,
        },
        recommendations: [],
      };

      const score = generator.calculateHealthScore(diagnosisResult);

      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('应该根据高严重程度问题降低分数', () => {
      const diagnosisResult: DiagnosisResult = {
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        failureRate: 20,
        problems: [
          {
            category: ProblemCategory.MOCK_CONFIG,
            severity: ProblemSeverity.HIGH,
            description: '严重问题',
            affectedTests: ['测试1', '测试2'],
            suggestedFix: '修复',
          },
        ],
        problemDistribution: {
          mockConfig: 20,
          apiResponse: 0,
          stateSync: 0,
          other: 0,
        },
        recommendations: [],
      };

      const score = generator.calculateHealthScore(diagnosisResult);

      expect(score).toBeLessThan(80);
    });
  });

  describe('getStatusEmoji', () => {
    it('应该为高分返回绿色状态', () => {
      const emoji = generator.getStatusEmoji(90);
      expect(emoji).toBe('✅');
    });

    it('应该为中等分数返回黄色状态', () => {
      const emoji = generator.getStatusEmoji(70);
      expect(emoji).toBe('⚠️');
    });

    it('应该为低分返回红色状态', () => {
      const emoji = generator.getStatusEmoji(50);
      expect(emoji).toBe('❌');
    });
  });

  describe('formatProblemSection', () => {
    it('应该正确格式化Mock配置问题部分', () => {
      const problems: DiagnosisProblem[] = [
        {
          category: ProblemCategory.MOCK_CONFIG,
          severity: ProblemSeverity.HIGH,
          description: 'API Mock未配置',
          affectedTests: ['测试1', '测试2'],
          suggestedFix: '添加Mock配置',
        },
      ];

      const section = generator.formatProblemSection(
        'Mock配置问题',
        problems,
        30
      );

      expect(section).toContain('Mock配置问题');
      expect(section).toContain('30%');
      expect(section).toContain('API Mock未配置');
      expect(section).toContain('测试1');
    });

    it('应该在没有问题时返回空字符串', () => {
      const section = generator.formatProblemSection('Mock配置问题', [], 0);

      expect(section).toBe('');
    });
  });
});
