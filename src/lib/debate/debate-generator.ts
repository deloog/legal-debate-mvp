// 辩论生成器：协调整个辩论生成流程

import { AIClient } from '@/lib/ai/clients';
import { DebateInput, DebateResult, DebateGenerationConfig } from './types';
import { ArgumentGenerator } from './argument-generator';
import { LogicValidator } from './validators';
import { QualityAssessor } from './assessors';

/**
 * 辩论生成器类
 */
export class DebateGenerator {
  private argumentGenerator: ArgumentGenerator;
  private config: DebateGenerationConfig;

  constructor(
    aiClient: AIClient,
    config: Partial<DebateGenerationConfig> = {}
  ) {
    this.config = {
      aiProvider: 'deepseek',
      temperature: 0.7,
      maxTokens: 2000,
      balanceStrictness: 'medium',
      includeLegalAnalysis: true,
      enableReview: true,
      ...config,
    };
    this.argumentGenerator = new ArgumentGenerator(aiClient, this.config);
  }

  /**
   * 生成单轮辩论
   */
  async generate(input: DebateInput): Promise<DebateResult> {
    const startTime = Date.now();

    try {
      // 1. 验证输入
      this.validateInput(input);

      // 2. 生成正方论点
      const plaintiffArguments =
        await this.argumentGenerator.generatePlaintiffArguments(input);

      // 3. 生成反方论点
      const defendantArguments =
        await this.argumentGenerator.generateDefendantArguments(input);

      // 4. 验证论点
      const allArguments = [...plaintiffArguments, ...defendantArguments];
      LogicValidator.validateArguments(allArguments);

      // 5. 计算质量指标
      const qualityMetrics = QualityAssessor.createQualityMetrics(
        plaintiffArguments,
        defendantArguments
      );

      // 6. 计算生成统计
      const generationTime = Date.now() - startTime;
      const generationStats = {
        totalGenerationTime: generationTime,
        averageArgumentTime: generationTime / allArguments.length,
        argumentCount: allArguments.length,
        aiProvider: this.config.aiProvider,
      };

      // 7. 构建结果
      const result: DebateResult = {
        id: `debate_${Date.now()}`,
        input,
        generatedAt: new Date().toISOString(),
        plaintiffArguments,
        defendantArguments,
        qualityMetrics,
        generationStats,
      };

      // 8. 可选：AI审查
      if (this.config.enableReview) {
        await this.performAIReview();
      }

      return result;
    } catch (error) {
      console.error('辩论生成失败:', error);
      throw new Error(
        `辩论生成失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 生成并评估辩论
   */
  async generateAndAssess(input: DebateInput): Promise<DebateResult> {
    const result = await this.generate(input);
    const assessment = QualityAssessor.assessDebate(
      result.plaintiffArguments,
      result.defendantArguments
    );

    // 将评估结果附加到结果中（作为扩展）
    (result as { assessment?: typeof assessment }).assessment = assessment;

    return result;
  }

  /**
   * 验证输入
   */
  private validateInput(input: DebateInput): void {
    if (!input.caseInfo) {
      throw new Error('案件信息不能为空');
    }

    if (!input.caseInfo.title || input.caseInfo.title.trim().length === 0) {
      throw new Error('案件名称不能为空');
    }

    if (
      !input.caseInfo.description ||
      input.caseInfo.description.trim().length === 0
    ) {
      throw new Error('案件描述不能为空');
    }

    if (!input.caseInfo.parties) {
      throw new Error('当事人信息不能为空');
    }

    if (!input.caseInfo.parties.plaintiff) {
      throw new Error('原告信息不能为空');
    }

    if (!input.caseInfo.parties.defendant) {
      throw new Error('被告信息不能为空');
    }

    if (!input.lawArticles || input.lawArticles.length === 0) {
      throw new Error('法条列表不能为空');
    }
  }

  /**
   * 执行AI审查（可选）
   */
  private async performAIReview(): Promise<void> {
    // AI审查层可以在这里实现
    // 例如：调用另一个AI模型对生成的论点进行审查
    // 目前暂不实现，可作为扩展点
    console.log('AI审查层已启用（当前版本暂未实现）');
  }

  /**
   * 获取配置
   */
  getConfig(): DebateGenerationConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DebateGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
