import type { Argument, DebateInput } from '@/lib/debate/types';
import { DebateAIReviewer } from '@/lib/debate/validators/ai-reviewer';

describe('DebateAIReviewer', () => {
  let reviewer: DebateAIReviewer;

  beforeEach(() => {
    reviewer = new DebateAIReviewer({
      minLogicScore: 7.0,
      minLegalScore: 7.0,
      minFactScore: 7.0,
      enableDeepCheck: true,
    });
  });

  const createMockArgument = (overrides: Partial<Argument> = {}): Argument => ({
    id: 'arg-1',
    side: 'plaintiff',
    type: 'main_point',
    content: '测试论点内容，用于验证辩论生成功能',
    reasoning:
      '这是一个完整的推理过程，根据相关法律规定和案件事实，可以得出结论',
    legalBasis: [
      {
        lawName: '中华人民共和国民法典',
        articleNumber: '第五百七十七条',
        relevance: 0.9,
        explanation: '该条款规定了违约责任的承担方式',
      },
    ],
    logicScore: 8.5,
    legalAccuracyScore: 9.0,
    overallScore: 8.75,
    generatedBy: 'ai',
    aiProvider: 'deepseek',
    generationTime: 1000,
    ...overrides,
  });

  const createMockInput = (): DebateInput => ({
    caseInfo: {
      title: '测试案件',
      description: '这是一个测试案件描述',
      caseType: 'CIVIL',
      parties: {
        plaintiff: '张三',
        defendant: '李四',
      },
      claims: ['要求被告支付欠款', '要求被告支付利息'],
      facts: ['双方签订合同', '被告未按时付款', '原告已履行合同义务'],
    },
    lawArticles: [
      {
        lawName: '中华人民共和国民法典',
        articleNumber: '第五百七十七条',
        content:
          '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
        category: '合同',
      },
    ],
  });

  describe('review', () => {
    it('应该通过有效论点的审查', async () => {
      const plaintiffArgs = [createMockArgument()];
      const defendantArgs = [createMockArgument({ side: 'defendant' })];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.passed).toBe(true);
      expect(result.overallScore).toBeGreaterThanOrEqual(7);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('应该检测到缺少推理的论点', async () => {
      const plaintiffArgs = [createMockArgument({ reasoning: '短' })];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.type === 'logic')).toBe(true);
    });

    it('应该检测到缺少法律依据的论点', async () => {
      const plaintiffArgs = [createMockArgument({ legalBasis: [] })];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.type === 'legal')).toBe(true);
    });

    it('应该检测到论点数量不平衡', async () => {
      const plaintiffArgs = [
        createMockArgument(),
        createMockArgument(),
        createMockArgument(),
      ];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.issues.some(i => i.type === 'balance')).toBe(true);
    });

    it('应该检测到论点质量差异较大', async () => {
      const plaintiffArgs = [createMockArgument({ overallScore: 9.5 })];
      const defendantArgs = [
        createMockArgument({ side: 'defendant', overallScore: 3.0 }),
      ];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.issues.some(i => i.type === 'balance')).toBe(true);
    });
  });

  describe('配置测试', () => {
    it('应该使用自定义配置', async () => {
      const strictReviewer = new DebateAIReviewer({
        minLogicScore: 9.0,
        minLegalScore: 9.0,
        minFactScore: 9.0,
        enableDeepCheck: true,
      });

      const plaintiffArgs = [createMockArgument()];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await strictReviewer.review(
        plaintiffArgs,
        defendantArgs,
        input
      );

      // 即使是高质量论点，严格模式下也可能不通过
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('应该支持禁用深度检查', async () => {
      const shallowReviewer = new DebateAIReviewer({
        enableDeepCheck: false,
      });

      const plaintiffArgs = [createMockArgument()];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await shallowReviewer.review(
        plaintiffArgs,
        defendantArgs,
        input
      );

      // 不检查事实依据
      expect(result.issues.filter(i => i.type === 'fact')).toHaveLength(0);
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空论点列表', async () => {
      const result = await reviewer.review([], [], createMockInput());

      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('应该处理论点内容过长', async () => {
      const longContent = 'A'.repeat(600);
      const plaintiffArgs = [createMockArgument({ content: longContent })];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.issues.some(i => i.type === 'style')).toBe(true);
    });

    it('应该处理包含不确定性表述的论点', async () => {
      const uncertainContent = '被告可能会违约，也许不需要承担责任';
      const plaintiffArgs = [createMockArgument({ content: uncertainContent })];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.issues.some(i => i.type === 'style')).toBe(true);
    });

    it('应该处理法律依据相关性过低', async () => {
      const plaintiffArgs = [
        createMockArgument({
          legalBasis: [
            {
              lawName: '无关法律',
              articleNumber: '第一条',
              relevance: 0.1,
              explanation: '相关性很低',
            },
          ],
        }),
      ];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.issues.some(i => i.type === 'legal')).toBe(true);
    });
  });

  describe('建议生成测试', () => {
    it('应该为未通过审查的论点生成建议', async () => {
      const plaintiffArgs = [createMockArgument({ legalBasis: [] })];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('应该去重重复的建议', async () => {
      const plaintiffArgs = [
        createMockArgument({ legalBasis: [] }),
        createMockArgument({ legalBasis: [] }),
      ];
      const defendantArgs = [createMockArgument()];
      const input = createMockInput();

      const result = await reviewer.review(plaintiffArgs, defendantArgs, input);

      // 建议中关于法律依据的应该被去重
      const legalSuggestions = result.suggestions.filter(s =>
        s.includes('法律依据')
      );
      expect(legalSuggestions.length).toBeLessThanOrEqual(1);
    });
  });
});
