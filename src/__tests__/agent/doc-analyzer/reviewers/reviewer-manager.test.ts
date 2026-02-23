/**
 * ReviewerManager单元测试
 */

import {
  ReviewerManager,
  IReviewer,
} from '../../../../lib/agent/doc-analyzer/reviewers/reviewer-manager';
import type {
  ExtractedData,
  ReviewResult,
  ReviewerConfig,
} from '../../../../lib/agent/doc-analyzer/core/types';

// Mock审查器
class MockReviewer implements IReviewer {
  public readonly name: string;
  private result: ReviewResult;

  constructor(name: string, result: ReviewResult) {
    this.name = name;
    this.result = result;
  }

  public async review(
    _data: ExtractedData,
    _fullText: string,
    _config: ReviewerConfig
  ): Promise<ReviewResult> {
    return this.result;
  }
}

describe('ReviewerManager', () => {
  let manager: ReviewerManager;

  beforeEach(() => {
    manager = new ReviewerManager();
  });

  describe('注册和注销审查器', () => {
    test('应该能够注册审查器', () => {
      const mockReviewer = new MockReviewer('TestReviewer', {
        passed: true,
        score: 1.0,
        issues: [],
        corrections: [],
        reviewer: 'TestReviewer',
      });

      manager.registerReviewer(mockReviewer);

      expect(manager.hasReviewer('TestReviewer')).toBe(true);
      expect(manager.getReviewers()).toContain('TestReviewer');
    });

    test('应该能够注销审查器', () => {
      const mockReviewer = new MockReviewer('TestReviewer', {
        passed: true,
        score: 1.0,
        issues: [],
        corrections: [],
        reviewer: 'TestReviewer',
      });

      manager.registerReviewer(mockReviewer);
      expect(manager.hasReviewer('TestReviewer')).toBe(true);

      manager.unregisterReviewer('TestReviewer');
      expect(manager.hasReviewer('TestReviewer')).toBe(false);
    });

    test('检查不存在的审查器应该返回false', () => {
      expect(manager.hasReviewer('NonExistent')).toBe(false);
    });
  });

  describe('执行审查', () => {
    const testData: ExtractedData = {
      parties: [
        { type: 'plaintiff', name: '张三' },
        { type: 'defendant', name: '李四' },
      ],
      claims: [
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还本金100万元',
          amount: 1000000,
          currency: 'CNY',
        },
      ],
    };

    test('未启用审查时应该直接通过', async () => {
      const mockReviewer = new MockReviewer('TestReviewer', {
        passed: true,
        score: 1.0,
        issues: [],
        corrections: [],
        reviewer: 'TestReviewer',
      });

      manager.registerReviewer(mockReviewer);

      const result = await manager.review(testData, '测试文档', {
        enabled: false,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.issues).toHaveLength(0);
    });

    test('应该能够执行所有注册的审查器', async () => {
      const mockReviewer1 = new MockReviewer('Reviewer1', {
        passed: true,
        score: 0.9,
        issues: [],
        corrections: [],
        reviewer: 'Reviewer1',
      });

      const mockReviewer2 = new MockReviewer('Reviewer2', {
        passed: true,
        score: 0.8,
        issues: [],
        corrections: [],
        reviewer: 'Reviewer2',
      });

      manager.registerReviewer(mockReviewer1);
      manager.registerReviewer(mockReviewer2);

      const result = await manager.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.7,
        rules: [],
      });

      expect(result.details).toHaveLength(2);
      expect(result.score).toBeCloseTo(0.85, 10); // (0.9 + 0.8) / 2, 使用toBeCloseTo处理浮点数精度
    });

    test('应该汇总所有审查器的问题', async () => {
      const mockReviewer1 = new MockReviewer('Reviewer1', {
        passed: true,
        score: 0.9,
        issues: [
          {
            severity: 'WARNING',
            category: 'FORM',
            message: '问题1',
          },
        ],
        corrections: [],
        reviewer: 'Reviewer1',
      });

      const mockReviewer2 = new MockReviewer('Reviewer2', {
        passed: true,
        score: 0.8,
        issues: [
          {
            severity: 'ERROR',
            category: 'LOGIC',
            message: '问题2',
          },
        ],
        corrections: [],
        reviewer: 'Reviewer2',
      });

      manager.registerReviewer(mockReviewer1);
      manager.registerReviewer(mockReviewer2);

      const result = await manager.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.7,
        rules: [],
      });

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].message).toBe('问题1');
      expect(result.issues[1].message).toBe('问题2');
    });

    test('应该汇总所有审查器的修正建议', async () => {
      const mockReviewer = new MockReviewer('TestReviewer', {
        passed: true,
        score: 1.0,
        issues: [],
        corrections: [
          {
            type: 'ADD_CLAIM',
            description: '添加诉讼费用',
            rule: 'TEST_RULE',
          },
        ],
        reviewer: 'TestReviewer',
      });

      manager.registerReviewer(mockReviewer);

      const result = await manager.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.corrections).toHaveLength(1);
      expect(result.corrections[0].type).toBe('ADD_CLAIM');
    });

    test('应该根据评分判断是否通过', async () => {
      const mockReviewer = new MockReviewer('TestReviewer', {
        passed: true,
        score: 0.6,
        issues: [],
        corrections: [],
        reviewer: 'TestReviewer',
      });

      manager.registerReviewer(mockReviewer);

      const result = await manager.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0.6);
    });

    test('审查器失败时应该继续执行其他审查器', async () => {
      class FailingReviewer implements IReviewer {
        public readonly name = 'FailingReviewer';

        public async review(
          _data: ExtractedData,
          _fullText: string,
          _config: ReviewerConfig
        ): Promise<ReviewResult> {
          throw new Error('测试错误');
        }
      }

      const passingReviewer = new MockReviewer('PassingReviewer', {
        passed: true,
        score: 1.0,
        issues: [],
        corrections: [],
        reviewer: 'PassingReviewer',
      });

      manager.registerReviewer(new FailingReviewer());
      manager.registerReviewer(passingReviewer);

      const result = await manager.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      // 应该继续执行通过的审查器
      expect(result.details).toHaveLength(1);
      expect(result.details[0].reviewer).toBe('PassingReviewer');
    });
  });

  describe('无审查器时', () => {
    test('没有审查器时应该返回通过', async () => {
      const result = await manager.review(testData, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.issues).toHaveLength(0);
      expect(result.details).toHaveLength(0);
    });
  });
});

const testData: ExtractedData = {
  parties: [
    { type: 'plaintiff', name: '张三' },
    { type: 'defendant', name: '李四' },
  ],
  claims: [
    {
      type: 'PAY_PRINCIPAL',
      content: '偿还本金100万元',
      amount: 1000000,
      currency: 'CNY',
    },
  ],
};
