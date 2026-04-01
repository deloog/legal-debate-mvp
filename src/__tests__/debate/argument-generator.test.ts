/**
 * ArgumentGenerator 单元测试
 * TDD: Red-Green-Refactor
 *
 * 目标覆盖率: 85%+
 * 测试范围:
 * 1. 构造函数和配置
 * 2. 生成正方论点 (generatePlaintiffArguments)
 * 3. 生成反方论点 (generateDefendantArguments)
 * 4. AI响应解析 (parseAIResponse)
 * 5. 论点转换 (convertToArguments)
 * 6. 评分计算 (calculateLogicScore, calculateLegalAccuracyScore)
 * 7. 平衡性保证 (ensureBalance)
 * 8. 错误处理
 */

import { ArgumentGenerator } from '@/lib/debate/argument-generator';
import { AIClient } from '@/lib/ai/clients';
import { DebateInput, DebateGenerationConfig } from '@/lib/debate/types';

// Mock dependencies
jest.mock('@/lib/logger');
jest.mock('@/lib/debate/prompt-builder');

import { PromptBuilder } from '@/lib/debate/prompt-builder';
import { logger } from '@/lib/logger';

describe('ArgumentGenerator', () => {
  let generator: ArgumentGenerator;
  let mockAIClient: jest.Mocked<AIClient>;

  const mockInput: DebateInput = {
    caseTitle: '测试案件',
    caseDescription: '这是一起测试案件',
    legalIssue: '合同违约纠纷',
    caseType: '合同纠纷',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup AI client mock
    mockAIClient = {
      chat: jest.fn(),
    } as any;

    // Setup PromptBuilder mock
    (PromptBuilder.buildDebatePrompt as jest.Mock).mockReturnValue({
      systemPrompt: '系统提示词',
      userPrompt: '用户提示词',
      temperature: 0.7,
      maxTokens: 2000,
    });

    generator = new ArgumentGenerator(mockAIClient);
  });

  describe('构造函数', () => {
    it('应该使用默认配置初始化', () => {
      const gen = new ArgumentGenerator(mockAIClient);
      expect(gen).toBeDefined();
    });

    it('应该接受自定义配置', () => {
      const customConfig: Partial<DebateGenerationConfig> = {
        temperature: 0.5,
        maxTokens: 1500,
        debateMode: 'quick',
      };
      const gen = new ArgumentGenerator(mockAIClient, customConfig);
      expect(gen).toBeDefined();
    });
  });

  describe('生成正方论点', () => {
    beforeEach(() => {
      mockAIClient.chat.mockResolvedValue(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: '被告违反合同约定',
              reasoning:
                '根据合同条款，被告应在2024年1月1日前支付款项，但至今未支付。',
              legalBasis: [
                {
                  lawName: '合同法',
                  articleNumber: '第107条',
                  relevance: 0.95,
                  explanation:
                    '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
                },
              ],
            },
          ],
        })
      );
    });

    it('应该生成正方论点数组', async () => {
      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(Array.isArray(arguments_)).toBe(true);
      expect(arguments_.length).toBeGreaterThan(0);
    });

    it('生成的论点应该包含必要字段', async () => {
      const arguments_ = await generator.generatePlaintiffArguments(mockInput);
      const arg = arguments_[0];

      expect(arg.id).toBeDefined();
      expect(arg.side).toBe('plaintiff');
      expect(arg.content).toBeDefined();
      expect(arg.reasoning).toBeDefined();
      expect(arg.legalBasis).toBeDefined();
      expect(arg.logicScore).toBeDefined();
      expect(arg.legalAccuracyScore).toBeDefined();
      expect(arg.overallScore).toBeDefined();
    });

    it('应该调用AI客户端', async () => {
      await generator.generatePlaintiffArguments(mockInput);

      expect(mockAIClient.chat).toHaveBeenCalled();
    });

    it('应该使用PromptBuilder构建提示词', async () => {
      await generator.generatePlaintiffArguments(mockInput);

      expect(PromptBuilder.buildDebatePrompt).toHaveBeenCalledWith(
        mockInput,
        'plaintiff',
        expect.any(Object)
      );
    });
  });

  describe('生成反方论点', () => {
    beforeEach(() => {
      mockAIClient.chat.mockResolvedValue(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: '原告未履行先合同义务',
              reasoning: '根据合同约定，原告应先交付货物，被告才需支付款项。',
              legalBasis: [
                {
                  lawName: '合同法',
                  articleNumber: '第67条',
                  relevance: 0.9,
                  explanation:
                    '当事人互负债务，有先后履行顺序，先履行一方未履行的，后履行一方有权拒绝其履行要求。',
                },
              ],
            },
          ],
        })
      );
    });

    it('应该生成反方论点数组', async () => {
      const arguments_ = await generator.generateDefendantArguments(mockInput);

      expect(Array.isArray(arguments_)).toBe(true);
      expect(arguments_.length).toBeGreaterThan(0);
    });

    it('生成的论点side字段应为defendant', async () => {
      const arguments_ = await generator.generateDefendantArguments(mockInput);

      arguments_.forEach(arg => {
        expect(arg.side).toBe('defendant');
      });
    });

    it('应该使用defendant侧调用PromptBuilder', async () => {
      await generator.generateDefendantArguments(mockInput);

      expect(PromptBuilder.buildDebatePrompt).toHaveBeenCalledWith(
        mockInput,
        'defendant',
        expect.any(Object)
      );
    });
  });

  describe('AI响应解析', () => {
    it('应该解析标准JSON格式', async () => {
      const response = JSON.stringify({
        arguments: [
          {
            type: 'main_point',
            content: '测试',
            reasoning: '测试',
            legalBasis: [],
          },
        ],
      });
      mockAIClient.chat.mockResolvedValue(response);

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_.length).toBe(1);
    });

    it('应该解析数组格式', async () => {
      const response = JSON.stringify([
        {
          type: 'main_point',
          content: '测试',
          reasoning: '测试',
          legalBasis: [],
        },
      ]);
      mockAIClient.chat.mockResolvedValue(response);

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_.length).toBe(1);
    });

    it('应该解析JSON代码块', async () => {
      const response =
        '```json\n{"arguments": [{"type": "main_point", "content": "测试", "reasoning": "测试", "legalBasis": []}]}\n```';
      mockAIClient.chat.mockResolvedValue(response);

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_.length).toBe(1);
    });

    it('应该在解析失败时返回空数组', async () => {
      const response = '无效的响应';
      mockAIClient.chat.mockResolvedValue(response);

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该在AI调用失败时抛出错误', async () => {
      mockAIClient.chat.mockRejectedValue(new Error('AI服务不可用'));

      await expect(
        generator.generatePlaintiffArguments(mockInput)
      ).rejects.toThrow('论点生成失败');
    });

    it('应该在AI返回空响应时处理 gracefully', async () => {
      mockAIClient.chat.mockResolvedValue('');

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(Array.isArray(arguments_)).toBe(true);
    });

    it('应该处理非Error类型的异常', async () => {
      mockAIClient.chat.mockRejectedValue('字符串错误');

      await expect(
        generator.generatePlaintiffArguments(mockInput)
      ).rejects.toThrow('论点生成失败');
      expect(logger.error).toHaveBeenCalled();
    });

    it('应该处理AI响应中缺少arguments的情况', async () => {
      mockAIClient.chat.mockResolvedValue(JSON.stringify({ other: 'data' }));

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_).toEqual([]);
    });
  });

  describe('论点类型验证', () => {
    beforeEach(() => {
      mockAIClient.chat.mockResolvedValue(
        JSON.stringify({
          arguments: [
            {
              type: 'invalid_type',
              content: '测试',
              reasoning: '测试',
              legalBasis: [],
            },
            {
              type: 'main_point',
              content: '测试2',
              reasoning: '测试2',
              legalBasis: [],
            },
          ],
        })
      );
    });

    it('应该将无效类型转换为main_point', async () => {
      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_[0].type).toBe('main_point');
      expect(arguments_[1].type).toBe('main_point');
    });
  });

  describe('评分计算', () => {
    beforeEach(() => {
      mockAIClient.chat.mockResolvedValue(
        JSON.stringify({
          arguments: [
            {
              type: 'main_point',
              content: 'a'.repeat(100), // 适当长度
              reasoning: 'b'.repeat(200), // 适当长度
              legalBasis: [
                {
                  lawName: '合同法',
                  articleNumber: '第1条',
                  relevance: 0.9,
                  explanation: '说明文字',
                },
                {
                  lawName: '民法典',
                  articleNumber: '第2条',
                  relevance: 0.8,
                  explanation: '说明文字',
                },
              ],
            },
          ],
        })
      );
    });

    it('应该计算逻辑分数', async () => {
      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_[0].logicScore).toBeGreaterThan(0);
      expect(arguments_[0].logicScore).toBeLessThanOrEqual(10);
    });

    it('应该计算法律准确性分数', async () => {
      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_[0].legalAccuracyScore).toBeGreaterThan(0);
      expect(arguments_[0].legalAccuracyScore).toBeLessThanOrEqual(10);
    });

    it('overallScore应该是两个分数的平均值', async () => {
      const arguments_ = await generator.generatePlaintiffArguments(mockInput);
      const arg = arguments_[0];

      expect(arg.overallScore).toBe(
        (arg.logicScore + arg.legalAccuracyScore) / 2
      );
    });
  });

  describe('平衡性保证', () => {
    it('应该在论点过多时截断', async () => {
      const manyArguments = Array(10)
        .fill(null)
        .map((_, i) => ({
          type: 'main_point',
          content: `论点${i}`,
          reasoning: `推理${i}`,
          legalBasis: [],
        }));

      mockAIClient.chat.mockResolvedValue(
        JSON.stringify({ arguments: manyArguments })
      );

      const arguments_ = await generator.generatePlaintiffArguments(mockInput);

      expect(arguments_.length).toBeLessThanOrEqual(6); // 标准模式最多5+1=6个
    });
  });

  describe('配置选项', () => {
    it('应该根据temperature配置调用PromptBuilder', async () => {
      const customGenerator = new ArgumentGenerator(mockAIClient, {
        temperature: 0.3,
        maxTokens: 1500,
      });

      mockAIClient.chat.mockResolvedValue(JSON.stringify({ arguments: [] }));

      await customGenerator.generatePlaintiffArguments(mockInput);

      // PromptBuilder应该使用自定义配置
      expect(PromptBuilder.buildDebatePrompt).toHaveBeenCalledWith(
        mockInput,
        'plaintiff',
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 1500,
        })
      );
    });

    it('应该根据maxTokens配置调用PromptBuilder', async () => {
      const customGenerator = new ArgumentGenerator(mockAIClient, {
        maxTokens: 1000,
      });

      mockAIClient.chat.mockResolvedValue(JSON.stringify({ arguments: [] }));

      await customGenerator.generatePlaintiffArguments(mockInput);

      expect(PromptBuilder.buildDebatePrompt).toHaveBeenCalledWith(
        mockInput,
        'plaintiff',
        expect.objectContaining({ maxTokens: 1000 })
      );
    });
  });

  describe('边缘情况分支覆盖', () => {
    it('应该处理花括号解析失败的情况', async () => {
      mockAIClient.chat.mockResolvedValue('{ invalid json }');

      const result = await generator.generatePlaintiffArguments(mockInput);

      expect(result).toHaveLength(0);
    });

    it('应该处理AI响应缺少arguments数组的情况', async () => {
      mockAIClient.chat.mockResolvedValue(JSON.stringify({ other: 'data' }));

      const result = await generator.generatePlaintiffArguments(mockInput);

      expect(result).toHaveLength(0);
    });

    it('应该处理content长度在20-50之间的逻辑分支', async () => {
      const shortContentArg = {
        arguments: [
          {
            title: '短内容论点',
            content: 'a'.repeat(30), // 30字符，触发else if分支
            reasoning: '充分的推理说明'.repeat(10),
            legalBasis: [{ law: '民法典', article: '第1条', relevance: 0.9 }],
          },
        ],
      };
      mockAIClient.chat.mockResolvedValue(JSON.stringify(shortContentArg));

      const result = await generator.generatePlaintiffArguments(mockInput);

      expect(result).toHaveLength(1);
      expect(result[0].logicScore).toBeGreaterThan(0);
    });

    it('应该处理reasoning长度在50-100之间的逻辑分支', async () => {
      const mediumReasoningArg = {
        arguments: [
          {
            title: '中等推理论点',
            content: 'a'.repeat(100), // 100字符，符合50-200范围
            reasoning: 'b'.repeat(60), // 60字符，触发50-100分支
            legalBasis: [{ law: '民法典', article: '第1条', relevance: 0.9 }],
          },
        ],
      };
      mockAIClient.chat.mockResolvedValue(JSON.stringify(mediumReasoningArg));

      const result = await generator.generatePlaintiffArguments(mockInput);

      expect(result).toHaveLength(1);
      expect(result[0].logicScore).toBeGreaterThan(0);
    });

    it('应该处理法条数量大于3的逻辑分支', async () => {
      const manyLawsArg = {
        arguments: [
          {
            title: '多法条论点',
            content: 'a'.repeat(100),
            reasoning: 'b'.repeat(100),
            legalBasis: [
              { law: '民法典', article: '第1条', relevance: 0.9 },
              { law: '民法典', article: '第2条', relevance: 0.8 },
              { law: '民法典', article: '第3条', relevance: 0.7 },
              { law: '民法典', article: '第4条', relevance: 0.6 },
              { law: '民法典', article: '第5条', relevance: 0.5 },
            ],
          },
        ],
      };
      mockAIClient.chat.mockResolvedValue(JSON.stringify(manyLawsArg));

      const result = await generator.generatePlaintiffArguments(mockInput);

      expect(result).toHaveLength(1);
      expect(result[0].legalAccuracyScore).toBeGreaterThan(0);
    });

    it('应该处理balanceStrictness为low的情况', async () => {
      const lowStrictGenerator = new ArgumentGenerator(mockAIClient, {
        balanceStrictness: 'low',
      });

      mockAIClient.chat.mockResolvedValue(JSON.stringify({ arguments: [] }));

      await lowStrictGenerator.generatePlaintiffArguments(mockInput);

      expect(PromptBuilder.buildDebatePrompt).toHaveBeenCalled();
    });

    it('应该处理balanceStrictness为high的情况', async () => {
      const highStrictGenerator = new ArgumentGenerator(mockAIClient, {
        balanceStrictness: 'high',
      });

      mockAIClient.chat.mockResolvedValue(JSON.stringify({ arguments: [] }));

      await highStrictGenerator.generatePlaintiffArguments(mockInput);

      expect(PromptBuilder.buildDebatePrompt).toHaveBeenCalled();
    });
  });
});
