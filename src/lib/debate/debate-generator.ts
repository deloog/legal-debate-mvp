// 辩论生成器：协调整个辩论生成流程

import { AIClient } from '@/lib/ai/clients';
import { ArgumentGenerator } from './argument-generator';
import { QualityAssessor } from './assessors';
import {
  Argument,
  DebateGenerationConfig,
  DebateInput,
  DebateResult,
} from './types';
import { LogicValidator } from './validators';
import { DebateAIReviewer, ReviewResult } from './validators/ai-reviewer';
import { logger } from '@/lib/logger';
import { argumentVerificationService } from './argument-verification-service';

/**
 * 辩论生成器类
 */
export class DebateGenerator {
  private argumentGenerator: ArgumentGenerator;
  private config: DebateGenerationConfig;
  private aiReviewer: DebateAIReviewer;

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
      debateMode: 'standard', // 添加默认值
      ...config,
    };
    this.argumentGenerator = new ArgumentGenerator(aiClient, this.config);
    this.aiReviewer = new DebateAIReviewer();
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

      // 4. 验证论点（逻辑验证）
      const allArguments = [...plaintiffArguments, ...defendantArguments];
      LogicValidator.validateArguments(allArguments);

      // 5. 【新增】使用 VerificationAgent 验证论点质量
      logger.info('开始验证论点质量...');
      const verifiedPlaintiffArgs =
        await argumentVerificationService.verifyAndSaveArguments(
          plaintiffArguments,
          input
        );
      const verifiedDefendantArgs =
        await argumentVerificationService.verifyAndSaveArguments(
          defendantArguments,
          input
        );
      const allVerifiedArguments = [
        ...verifiedPlaintiffArgs,
        ...verifiedDefendantArgs,
      ];

      // 6. 计算质量指标
      const qualityMetrics = QualityAssessor.createQualityMetrics(
        verifiedPlaintiffArgs,
        verifiedDefendantArgs
      );

      // 7. 计算生成统计
      const generationTime = Date.now() - startTime;
      const generationStats = {
        totalGenerationTime: generationTime,
        averageArgumentTime: generationTime / allVerifiedArguments.length,
        argumentCount: allVerifiedArguments.length,
        aiProvider: this.config.aiProvider,
      };

      // 8. 构建结果（使用验证后的论点）
      const result: DebateResult = {
        id: `debate_${Date.now()}`,
        input,
        generatedAt: new Date().toISOString(),
        plaintiffArguments: verifiedPlaintiffArgs,
        defendantArguments: verifiedDefendantArgs,
        qualityMetrics,
        generationStats,
      };

      // 9. AI审查（如果启用）
      if (this.config.enableReview) {
        const reviewResult = await this.performAIReview(
          verifiedPlaintiffArgs,
          verifiedDefendantArgs,
          input
        );
        (result as { reviewResult?: ReviewResult }).reviewResult = reviewResult;

        // 如果审查未通过，记录警告
        if (!reviewResult.passed) {
          logger.warn('AI审查未通过:', reviewResult.issues);
        }
      }

      return result;
    } catch (error) {
      logger.error('辩论生成失败:', error);
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
   * 执行AI审查
   */
  private async performAIReview(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
    input: DebateInput
  ): Promise<ReviewResult> {
    return this.aiReviewer.review(
      plaintiffArguments,
      defendantArguments,
      input
    );
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
