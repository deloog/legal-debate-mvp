import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { DebateGenerator } from '@/lib/debate/debate-generator';
import { AIClient } from '@/lib/ai/clients';
import type { DebateInput, DebateGenerationConfig } from '@/lib/debate/types';
import { DEFAULT_DEBATE_CONFIG } from '@/lib/debate/types';

describe('DebateGenerator', () => {
  let mockAIClient: jest.Mocked<AIClient>;
  let debateGenerator: DebateGenerator;

  const mockDebateInput: DebateInput = {
    caseInfo: {
      title: '合同纠纷案',
      description: '原告与被告签订合同后发生违约',
      caseType: 'CIVIL',
      parties: {
        plaintiff: '张三',
        defendant: '李四',
      },
      claims: ['支付违约金'],
      facts: ['合同于2024年1月1日签订', '被告未按时付款'],
    },
    lawArticles: [
      {
        lawName: '民法典',
        articleNumber: '第五百七十七条',
        content: '当事人一方不履行合同义务...',
        category: 'CIVIL',
      },
    ],
  };

  beforeEach(() => {
    // Mock AIClient
    mockAIClient = {
      chat: jest.fn(),
    } as unknown as jest.Mocked<AIClient>;

    debateGenerator = new DebateGenerator(mockAIClient);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该使用默认配置初始化', () => {
      const generator = new DebateGenerator(mockAIClient);
      const config = generator.getConfig();

      expect(config.aiProvider).toBe(DEFAULT_DEBATE_CONFIG.aiProvider);
      expect(config.temperature).toBe(DEFAULT_DEBATE_CONFIG.temperature);
      expect(config.maxTokens).toBe(DEFAULT_DEBATE_CONFIG.maxTokens);
    });

    it('应该支持自定义配置', () => {
      const customConfig: Partial<DebateGenerationConfig> = {
        temperature: 0.5,
        maxTokens: 3000,
      };

      const generator = new DebateGenerator(mockAIClient, customConfig);
      const config = generator.getConfig();

      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(3000);
      expect(config.aiProvider).toBe(DEFAULT_DEBATE_CONFIG.aiProvider);
    });
  });

  describe('generate方法', () => {
    it('应该生成完整的辩论结果', async () => {
      // Mock AI响应
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: '原告有权要求被告承担违约责任',
              reasoning: '根据合同约定...',
              legalBasis: [
                {
                  lawName: '民法典',
                  articleNumber: '第五百七十七条',
                  relevance: 0.9,
                  explanation: '该条款规定违约责任',
                },
              ],
            },
          ],
        })
      );

      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: '被告不应承担违约责任',
              reasoning: '合同条款存在歧义...',
              legalBasis: [],
            },
          ],
        })
      );

      const result = await debateGenerator.generate(mockDebateInput);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.input).toEqual(mockDebateInput);
      expect(result.plaintiffArguments).toBeDefined();
      expect(result.defendantArguments).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
      expect(result.generationStats).toBeDefined();
    });

    it('应该验证输入参数', async () => {
      const invalidInput = {
        caseInfo: {
          title: '',
          description: '',
          caseType: 'CIVIL',
          parties: { plaintiff: '', defendant: '' },
          claims: [],
          facts: [],
        },
        lawArticles: [],
      } as DebateInput;

      await expect(debateGenerator.generate(invalidInput)).rejects.toThrow(
        '案件名称不能为空'
      );
    });

    it('应该在案件描述为空时抛出错误', async () => {
      const invalidInput = {
        caseInfo: {
          title: '测试案件',
          description: '',
          caseType: 'CIVIL',
          parties: { plaintiff: '张三', defendant: '李四' },
          claims: [],
          facts: [],
        },
        lawArticles: [],
      } as DebateInput;

      await expect(debateGenerator.generate(invalidInput)).rejects.toThrow(
        '案件描述不能为空'
      );
    });

    it('应该在当事人信息为空时抛出错误', async () => {
      const invalidInput = {
        caseInfo: {
          title: '测试案件',
          description: '测试描述',
          caseType: 'CIVIL',
          parties: {} as { plaintiff?: string; defendant?: string },
          claims: [],
          facts: [],
        },
        lawArticles: [],
      } as DebateInput;

      await expect(debateGenerator.generate(invalidInput)).rejects.toThrow(
        '原告信息不能为空'
      );
    });

    it('应该在法条列表为空时抛出错误', async () => {
      const invalidInput = {
        caseInfo: {
          title: '测试案件',
          description: '测试描述',
          caseType: 'CIVIL',
          parties: { plaintiff: '张三', defendant: '李四' },
          claims: [],
          facts: [],
        },
        lawArticles: [],
      } as DebateInput;

      await expect(debateGenerator.generate(invalidInput)).rejects.toThrow(
        '法条列表不能为空'
      );
    });

    it('应该正确处理AI调用失败', async () => {
      mockAIClient.chat.mockRejectedValueOnce(new Error('AI服务不可用'));

      await expect(debateGenerator.generate(mockDebateInput)).rejects.toThrow(
        '辩论生成失败'
      );
    });

    it('应该计算生成统计信息', async () => {
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({ arguments: [] })
      );
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({ arguments: [] })
      );

      const result = await debateGenerator.generate(mockDebateInput);

      expect(result.generationStats).toBeDefined();
      expect(result.generationStats.aiProvider).toBe(
        DEFAULT_DEBATE_CONFIG.aiProvider
      );
      expect(result.generationStats.totalGenerationTime).toBeGreaterThanOrEqual(
        0
      );
    });
  });

  describe('generateAndAssess方法', () => {
    it('应该生成辩论并进行评估', async () => {
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: '正方论点',
              reasoning: '正方推理',
              legalBasis: [],
            },
          ],
        })
      );

      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: '反方论点',
              reasoning: '反方推理',
              legalBasis: [],
            },
          ],
        })
      );

      const result = await debateGenerator.generateAndAssess(mockDebateInput);

      expect(result).toBeDefined();
      expect('assessment' in result).toBe(true);
      expect(result.plaintiffArguments).toHaveLength(1);
      expect(result.defendantArguments).toHaveLength(1);
    });
  });

  describe('getConfig方法', () => {
    it('应该返回配置的副本', () => {
      const config = debateGenerator.getConfig();
      expect(config).toEqual(expect.any(Object));
    });

    it('应该支持修改配置', () => {
      debateGenerator.updateConfig({ temperature: 0.9 });
      const config = debateGenerator.getConfig();

      expect(config.temperature).toBe(0.9);
    });
  });

  describe('updateConfig方法', () => {
    it('应该更新部分配置', () => {
      debateGenerator.updateConfig({
        temperature: 0.8,
        maxTokens: 2500,
      });

      const config = debateGenerator.getConfig();

      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(2500);
      expect(config.aiProvider).toBe(DEFAULT_DEBATE_CONFIG.aiProvider);
    });

    it('应该覆盖默认配置', () => {
      const customConfig: Partial<DebateGenerationConfig> = {
        aiProvider: 'zhipu',
        balanceStrictness: 'high',
      };

      debateGenerator.updateConfig(customConfig);
      const config = debateGenerator.getConfig();

      expect(config.aiProvider).toBe('zhipu');
      expect(config.balanceStrictness).toBe('high');
    });
  });

  describe('质量指标', () => {
    it('应该正确计算整体质量分数', async () => {
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({ arguments: [] })
      );
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({ arguments: [] })
      );

      const result = await debateGenerator.generate(mockDebateInput);

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.overallQuality).toBeLessThanOrEqual(10);
    });

    it('应该计算正反方平衡度', async () => {
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({ arguments: [] })
      );
      mockAIClient.chat.mockResolvedValueOnce(
        JSON.stringify({ arguments: [] })
      );

      const result = await debateGenerator.generate(mockDebateInput);

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.balanceScore).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该捕获并包装错误', async () => {
      mockAIClient.chat.mockRejectedValueOnce(new Error('网络连接失败'));

      await expect(debateGenerator.generate(mockDebateInput)).rejects.toThrow(
        '辩论生成失败'
      );
    });

    it('应该处理非Error类型的异常', async () => {
      mockAIClient.chat.mockRejectedValueOnce('字符串错误');

      await expect(debateGenerator.generate(mockDebateInput)).rejects.toThrow(
        '辩论生成失败'
      );
    });
  });
});
