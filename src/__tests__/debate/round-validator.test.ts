// 轮次验证器单元测试

import { RoundValidator } from '@/lib/debate/round';
import { prisma } from '@/lib/db/prisma';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createDebate,
  createCase,
} from '@/test-utils';

describe('RoundValidator', () => {
  let validator: RoundValidator;
  let debateId: string;

  beforeEach(async () => {
    validator = new RoundValidator();
  });

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  // 辅助函数：创建测试辩论
  async function createTestDebate(): Promise<string> {
    // 创建测试用户
    const testUserId = `test-user-round-validator-${Date.now()}-${Math.random()}`;
    const testUser = await prisma.user.create({
      data: {
        id: testUserId,
        email: `round-validator-${Date.now()}@test.com`,
        username: `roundvalidator-${Date.now()}`,
        name: 'Round Validator Test',
        role: 'USER',
      },
    });

    const testCase = await prisma.case.create({
      data: {
        ...createCase({ userId: testUser.id, id: undefined }),
        id: undefined,
        userId: testUser.id,
      },
    });

    const debate = await prisma.debate.create({
      data: {
        ...createDebate({ id: undefined }),
        id: undefined,
        caseId: testCase.id,
        userId: testUser.id,
      },
    });
    return debate.id;
  }

  describe('validateStatusTransition', () => {
    it('应该允许从PENDING转换为IN_PROGRESS', () => {
      const result = validator.validateStatusTransition(
        'PENDING',
        'IN_PROGRESS'
      );
      expect(result).toBe(true);
    });

    it('应该允许从PENDING转换为FAILED', () => {
      const result = validator.validateStatusTransition('PENDING', 'FAILED');
      expect(result).toBe(true);
    });

    it('应该允许从IN_PROGRESS转换为COMPLETED', () => {
      const result = validator.validateStatusTransition(
        'IN_PROGRESS',
        'COMPLETED'
      );
      expect(result).toBe(true);
    });

    it('应该允许从IN_PROGRESS转换为FAILED', () => {
      const result = validator.validateStatusTransition(
        'IN_PROGRESS',
        'FAILED'
      );
      expect(result).toBe(true);
    });

    it('应该允许从FAILED转换为PENDING', () => {
      const result = validator.validateStatusTransition('FAILED', 'PENDING');
      expect(result).toBe(true);
    });

    it('应该不允许从PENDING直接转换为COMPLETED', () => {
      const result = validator.validateStatusTransition('PENDING', 'COMPLETED');
      expect(result).toBe(false);
    });

    it('应该不允许从COMPLETED转换为任何状态', () => {
      const result1 = validator.validateStatusTransition(
        'COMPLETED',
        'IN_PROGRESS'
      );
      const result2 = validator.validateStatusTransition('COMPLETED', 'FAILED');
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('validateRoundConfig', () => {
    it('应该接受空的配置', () => {
      const result = validator.validateRoundConfig(undefined);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('使用默认轮次配置');
    });

    it('应该接受有效的配置', () => {
      const config = {
        maxArguments: 3,
        argumentDepth: 2 as 1 | 2 | 3,
        enableProgression: true,
        progressionStrategy: 'depth' as const,
      };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝负数的maxArguments', () => {
      const config = { maxArguments: -1 };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'maxArguments',
        })
      );
    });

    it('应该拒绝非整数的maxArguments', () => {
      const config = { maxArguments: 3.5 };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'maxArguments',
        })
      );
    });

    it('应该拒绝大于10的maxArguments并发出警告', () => {
      const config = { maxArguments: 15 };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('最大论点数量超过10可能会影响生成质量');
    });

    it('应该拒绝无效的argumentDepth', () => {
      const config = { argumentDepth: 5 as 1 | 2 | 3 };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'argumentDepth',
        })
      );
    });

    it('应该接受1、2、3作为argumentDepth', () => {
      for (const depth of [1, 2, 3]) {
        const config = { argumentDepth: depth as 1 | 2 | 3 };
        const result = validator.validateRoundConfig(config);
        expect(result.valid).toBe(true);
      }
    });

    it('应该拒绝无效的progressionStrategy', () => {
      const config = {
        progressionStrategy: 'invalid' as unknown as
          | 'depth'
          | 'breadth'
          | 'refutation',
      };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'progressionStrategy',
        })
      );
    });

    it('应该在enableProgression为true但未指定strategy时发出警告', () => {
      const config = { enableProgression: true };
      const result = validator.validateRoundConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        '已启用论点递进但未指定递进策略，将使用默认策略（depth）'
      );
    });
  });

  describe('validateCanStart', () => {
    const mockDebateId = 'test-debate-validate-start';

    beforeEach(async () => {
      // 为 createTestDebate 的 DB 操作配置 mock 返回值
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'test-user-id',
      });
      (prisma.case.create as jest.Mock).mockResolvedValue({
        id: 'test-case-id',
      });
      (prisma.debate.create as jest.Mock).mockResolvedValue({
        id: mockDebateId,
      });
      // 默认：debate 存在，DRAFT 状态，无进行中轮次
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: mockDebateId,
        status: 'DRAFT',
        debateConfig: null,
        rounds: [],
      });
      (prisma.debateRound.count as jest.Mock).mockResolvedValue(0);

      debateId = await createTestDebate();
    });

    it('应该允许在DRAFT状态开始轮次', async () => {
      const debate = await prisma.debate.findUnique({
        where: { id: debateId },
      });
      expect(debate).toBeDefined();

      const result = await validator.validateCanStart(debateId);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝在不存在的辩论开始轮次', async () => {
      // 对 non-existent-id 返回 null
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await validator.validateCanStart('non-existent-id');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'debateId',
          message: '辩论不存在',
        })
      );
    });

    it('应该拒绝在有进行中轮次的辩论开始新轮次', async () => {
      // 模拟 debate 包含进行中的轮次
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: debateId,
        status: 'IN_PROGRESS',
        debateConfig: null,
        rounds: [{ id: 'round-1', status: 'IN_PROGRESS' }],
      });

      const result = await validator.validateCanStart(debateId);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'concurrentRounds',
        })
      );
    });
  });

  describe('getErrorSummary', () => {
    it('应该返回验证通过消息', () => {
      const result = { valid: true, errors: [], warnings: [] };
      const summary = validator.getErrorSummary(result);
      expect(summary).toBe('验证通过');
    });

    it('应该返回包含所有错误的摘要', () => {
      const result = {
        valid: false,
        errors: [
          { field: 'field1', message: 'error1' },
          { field: 'field2', message: 'error2' },
        ],
        warnings: [],
      };
      const summary = validator.getErrorSummary(result);
      expect(summary).toContain('field1');
      expect(summary).toContain('error1');
      expect(summary).toContain('field2');
      expect(summary).toContain('error2');
    });
  });

  describe('getWarningSummary', () => {
    it('应该返回无警告消息', () => {
      const result = { valid: true, errors: [], warnings: [] };
      const summary = validator.getWarningSummary(result);
      expect(summary).toBe('无警告');
    });

    it('应该返回包含所有警告的摘要', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: ['warning1', 'warning2', 'warning3'],
      };
      const summary = validator.getWarningSummary(result);
      expect(summary).toBe('warning1; warning2; warning3');
    });
  });
});
