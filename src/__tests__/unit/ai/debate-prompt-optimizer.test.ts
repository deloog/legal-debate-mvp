/**
 * DebatePromptOptimizer 单元测试
 * 测试提示词优化器的核心功能
 */

import {
  DebatePromptOptimizer,
  createDebatePromptOptimizer,
} from '@/lib/ai/debate-prompt-optimizer';
import type { Argument, CaseInfo } from '@/types/debate';

// Mock AI Service
const mockAIService = {
  chatCompletion: jest.fn(),
};

describe('DebatePromptOptimizer', () => {
  let optimizer: DebatePromptOptimizer;

  beforeEach(() => {
    optimizer = new DebatePromptOptimizer(mockAIService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =============================================================================
  // 基础功能测试
  // =============================================================================

  describe('构造函数', () => {
    it('应该使用默认配置初始化', () => {
      const config = optimizer.getConfig();
      expect(config.enableCoT).toBe(true);
      expect(config.enableFewShot).toBe(true);
      expect(config.maxExamples).toBe(2);
      expect(config.complexityLevel).toBe('advanced');
    });

    it('应该使用自定义配置初始化', () => {
      const customOptimizer = new DebatePromptOptimizer(mockAIService as any, {
        enableCoT: false,
        enableFewShot: false,
        maxExamples: 1,
        complexityLevel: 'basic',
      });
      const config = customOptimizer.getConfig();
      expect(config.enableCoT).toBe(false);
      expect(config.enableFewShot).toBe(false);
      expect(config.maxExamples).toBe(1);
      expect(config.complexityLevel).toBe('basic');
    });
  });

  // =============================================================================
  // generateOptimizedPrompt 方法测试
  // =============================================================================

  describe('generateOptimizedPrompt', () => {
    const mockCaseInfo: CaseInfo = {
      title: '测试案件',
      description: '这是一个测试案件描述',
      type: 'contract',
    };

    it('应该生成优化的提示词', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.systemPrompt).toBeDefined();
      expect(result.userPrompt).toBeDefined();
      expect(result.reasoningSteps).toBeDefined();
      expect(result.examples).toBeDefined();
    });

    it('应该包含逻辑要求', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.systemPrompt).toContain('逻辑要求');
      expect(result.systemPrompt).toContain('主张');
      expect(result.systemPrompt).toContain('法律依据');
    });

    it('应该包含结构要求', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.systemPrompt).toContain('结构要求');
      expect(result.systemPrompt).toContain('3-4个核心论据');
    });

    it('应该包含质量要求', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.systemPrompt).toContain('质量要求');
      expect(result.systemPrompt).toContain('法律依据准确');
    });

    it('应该包含推理步骤', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.reasoningSteps).toBeDefined();
      expect(result.reasoningSteps?.length).toBeGreaterThan(0);
    });

    it('应该在启用Few-Shot时包含示例', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.examples).toBeDefined();
      expect(result.examples?.length).toBeGreaterThan(0);
    });

    it('应该在禁用Few-Shot时不包含示例', async () => {
      const noFewShotOptimizer = new DebatePromptOptimizer(
        mockAIService as any,
        {
          enableFewShot: false,
        }
      );
      const result =
        await noFewShotOptimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.examples).toBeUndefined();
    });

    it('应该在启用CoT时包含推理步骤', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.userPrompt).toContain('推理步骤');
      expect(result.userPrompt).toContain('分析案件争议焦点');
    });

    it('应该在禁用CoT时不包含推理步骤', async () => {
      const noCoTOptimizer = new DebatePromptOptimizer(mockAIService as any, {
        enableCoT: false,
      });
      const result = await noCoTOptimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.userPrompt).not.toContain('推理步骤');
    });

    it('应该支持法律引用', async () => {
      const legalReferences = ['民法典第509条', '合同法第107条'];
      const result = await optimizer.generateOptimizedPrompt(
        mockCaseInfo,
        legalReferences
      );
      expect(result.userPrompt).toContain('相关法条');
      expect(result.userPrompt).toContain('民法典第509条');
      expect(result.userPrompt).toContain('合同法第107条');
    });

    it('应该包含案件信息', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.userPrompt).toContain('当前案件');
      expect(result.userPrompt).toContain('测试案件');
      expect(result.userPrompt).toContain('这是一个测试案件描述');
    });

    it('应该要求正反方论点', async () => {
      const result = await optimizer.generateOptimizedPrompt(mockCaseInfo);
      expect(result.userPrompt).toContain('原告');
      expect(result.userPrompt).toContain('被告');
    });
  });

  // =============================================================================
  // Few-Shot示例管理测试
  // =============================================================================

  describe('Few-Shot示例', () => {
    it('应该加载内置的成功案例', () => {
      const examples = (optimizer as any).successExamples;
      expect(examples).toBeDefined();
      expect(examples.length).toBe(2);
    });

    it('应该包含合同纠纷案例', () => {
      const examples = (optimizer as any).successExamples;
      const contractExample = examples.find(
        (e: any) => e.case.title === '合同纠纷案例'
      );
      expect(contractExample).toBeDefined();
      expect(contractExample.case.type).toBe('contract');
    });

    it('应该包含劳动纠纷案例', () => {
      const examples = (optimizer as any).successExamples;
      const laborExample = examples.find(
        (e: any) => e.case.title === '劳动纠纷案例'
      );
      expect(laborExample).toBeDefined();
      expect(laborExample.case.type).toBe('labor');
    });

    it('示例应该包含完整的评估数据', () => {
      const examples = (optimizer as any).successExamples;
      const example = examples[0] as any;
      expect(example.evaluation).toBeDefined();
      expect(example.evaluation.logicalScore).toBeGreaterThan(0);
      expect(example.evaluation.factualAccuracy).toBeGreaterThan(0);
      expect(example.evaluation.completeness).toBeGreaterThan(0);
    });

    it('应该支持添加新的成功案例', () => {
      const newExample: any = {
        case: {
          title: '新案例',
          description: '新案例描述',
          type: 'labor',
        },
        plaintiff: {
          side: 'plaintiff',
          content: '论点内容',
          legalBasis: '法条',
          reasoning: '推理过程',
          score: 0.9,
        },
        defendant: {
          side: 'defendant',
          content: '论点内容',
          legalBasis: '法条',
          reasoning: '推理过程',
          score: 0.9,
        },
        evaluation: {
          logicalScore: 0.9,
          factualAccuracy: 0.9,
          completeness: 0.9,
        },
      };
      optimizer.addSuccessExample(newExample);
      const examples = (optimizer as any).successExamples;
      expect(examples.length).toBe(3);
      expect(examples[2].case.title).toBe('新案例');
    });

    it('应该支持清空成功案例', () => {
      optimizer.clearSuccessExamples();
      const examples = (optimizer as any).successExamples;
      expect(examples.length).toBe(0);
    });

    it('应该按照maxExamples限制示例数量', async () => {
      const limitedOptimizer = new DebatePromptOptimizer(mockAIService as any, {
        maxExamples: 1,
      });
      const result = await limitedOptimizer.generateOptimizedPrompt({
        title: '测试',
        description: '测试',
        type: 'contract',
      });
      expect(result.examples?.length).toBe(1);
    });
  });

  // =============================================================================
  // 配置管理测试
  // =============================================================================

  describe('配置管理', () => {
    it('应该支持动态配置', () => {
      optimizer.configure({
        enableCoT: false,
        enableFewShot: false,
        maxExamples: 3,
        complexityLevel: 'basic',
      });
      const config = optimizer.getConfig();
      expect(config.enableCoT).toBe(false);
      expect(config.enableFewShot).toBe(false);
      expect(config.maxExamples).toBe(3);
      expect(config.complexityLevel).toBe('basic');
    });

    it('应该部分更新配置', () => {
      const originalConfig = optimizer.getConfig();
      optimizer.configure({
        enableCoT: false,
      });
      const newConfig = optimizer.getConfig();
      expect(newConfig.enableCoT).toBe(false);
      expect(newConfig.enableFewShot).toBe(originalConfig.enableFewShot);
      expect(newConfig.maxExamples).toBe(originalConfig.maxExamples);
      expect(newConfig.complexityLevel).toBe(originalConfig.complexityLevel);
    });

    it('应该返回配置副本', () => {
      const config = optimizer.getConfig();
      config.enableCoT = false;
      const originalConfig = optimizer.getConfig();
      expect(originalConfig.enableCoT).toBe(true);
    });

    it('应该支持所有复杂度级别', () => {
      ['basic', 'intermediate', 'advanced'].forEach(level => {
        optimizer.configure({ complexityLevel: level as any });
        expect(optimizer.getConfig().complexityLevel).toBe(level);
      });
    });
  });

  // =============================================================================
  // verifyLogicalConsistency AI验证方法测试
  // =============================================================================

  describe('verifyLogicalConsistency', () => {
    const mockCaseInfo: CaseInfo = {
      title: '测试案件',
      description: '测试案件描述',
      type: 'contract',
    };

    const mockArgument: Argument = {
      side: 'plaintiff',
      content: '测试论点内容',
      legalBasis: '测试法条',
      reasoning: '测试推理过程',
      score: 0.9,
    };

    beforeEach(() => {
      (mockAIService.chatCompletion as jest.Mock).mockReset();
    });

    it('应该调用AI服务验证论点', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '{\n  "score": 0.9,\n  "issues": [],\n  "suggestions": []\n}',
            },
          },
        ],
      });

      await optimizer.verifyLogicalConsistency(mockArgument, mockCaseInfo);

      expect(mockAIService.chatCompletion).toHaveBeenCalledWith({
        model: 'deepseek-chat',
        provider: 'deepseek',
        messages: expect.arrayContaining([
          {
            role: 'system',
            content: expect.stringContaining('法律论点逻辑性验证专家'),
          },
          {
            role: 'user',
            content: expect.stringContaining('验证以下论点的逻辑一致性'),
          },
        ]),
        temperature: 0.3,
        maxTokens: 1000,
      });
    });

    it('应该成功解析JSON响应', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '{\n  "score": 0.9,\n  "issues": ["问题1"],\n  "suggestions": ["建议1"]\n}',
            },
          },
        ],
      });

      const result = await optimizer.verifyLogicalConsistency(
        mockArgument,
        mockCaseInfo
      );

      expect(result.score).toBe(0.9);
      expect(result.issues).toEqual(['问题1']);
      expect(result.suggestions).toEqual(['建议1']);
    });

    it('应该返回高分（0.9+）', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '{\n  "score": 0.95,\n  "issues": [],\n  "suggestions": []\n}',
            },
          },
        ],
      });

      const result = await optimizer.verifyLogicalConsistency(
        mockArgument,
        mockCaseInfo
      );

      expect(result.score).toBe(0.95);
      expect(result.score).toBeGreaterThanOrEqual(0.9);
    });

    it('应该返回低分并发现问题（<0.7）', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '{\n  "score": 0.65,\n  "issues": ["逻辑不清晰", "法律依据不适用"],\n  "suggestions": ["补充推理过程", "更换适用法条"]\n}',
            },
          },
        ],
      });

      const result = await optimizer.verifyLogicalConsistency(
        mockArgument,
        mockCaseInfo
      );

      expect(result.score).toBeLessThan(0.7);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues).toContain('逻辑不清晰');
      expect(result.suggestions).toContain('补充推理过程');
    });

    it('应该处理JSON解析失败', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: '无效的JSON响应',
            },
          },
        ],
      });

      const result = await optimizer.verifyLogicalConsistency(
        mockArgument,
        mockCaseInfo
      );

      expect(result.score).toBe(0.75);
      expect(result.issues).toContain('无法解析验证结果');
      expect(result.suggestions).toContain('请确保论点结构完整');
    });

    it('应该处理AI服务错误', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockRejectedValue(
        new Error('AI服务不可用')
      );

      const result = await optimizer.verifyLogicalConsistency(
        mockArgument,
        mockCaseInfo
      );

      expect(result.score).toBe(0.7);
      expect(result.issues).toContain('验证服务不可用');
      expect(result.suggestions).toContain('请检查论点格式');
    });

    it('应该包含完整的验证维度', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '{\n  "score": 0.8,\n  "issues": [],\n  "suggestions": []\n}',
            },
          },
        ],
      });

      await optimizer.verifyLogicalConsistency(mockArgument, mockCaseInfo);

      const callArgs = (mockAIService.chatCompletion as jest.Mock).mock
        .calls[0][0];
      const prompt = callArgs.messages[1].content;
      expect(prompt).toContain('主张是否清晰明确');
      expect(prompt).toContain('事实依据是否准确');
      expect(prompt).toContain('法律依据是否适用');
      expect(prompt).toContain('推理过程是否完整');
      expect(prompt).toContain('是否存在逻辑矛盾');
    });

    it('应该要求JSON格式返回', async () => {
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"score": 0.9}',
            },
          },
        ],
      });

      await optimizer.verifyLogicalConsistency(mockArgument, mockCaseInfo);

      const callArgs = (mockAIService.chatCompletion as jest.Mock).mock
        .calls[0][0];
      const prompt = callArgs.messages[1].content;
      expect(prompt).toContain('请以JSON格式返回');
    });
  });

  // =============================================================================
  // 工厂函数测试
  // =============================================================================

  describe('createDebatePromptOptimizer', () => {
    it('应该创建DebatePromptOptimizer实例', () => {
      const optimizerInstance = createDebatePromptOptimizer(
        mockAIService as any
      );
      expect(optimizerInstance).toBeInstanceOf(DebatePromptOptimizer);
    });

    it('应该支持配置参数', () => {
      const optimizerInstance = createDebatePromptOptimizer(
        mockAIService as any,
        {
          enableCoT: false,
        }
      );
      const config = optimizerInstance.getConfig();
      expect(config.enableCoT).toBe(false);
    });
  });
});
