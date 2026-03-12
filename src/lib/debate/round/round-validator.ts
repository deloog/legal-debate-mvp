// 轮次验证器：验证轮次状态和配置的有效性

import { RoundConfig, RoundValidationResult } from './types';
import { prisma } from '@/lib/db/prisma';
import { RoundStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * 辩论配置类型
 */
interface DebateConfig {
  maxRounds?: number;
  [key: string]: unknown;
}

/**
 * 轮次验证器类
 * 负责验证轮次创建、状态转换和配置的有效性
 */
export class RoundValidator {
  /**
   * 允许的状态转换映射
   */
  private static readonly VALID_TRANSITIONS: Record<
    RoundStatus,
    RoundStatus[]
  > = {
    PENDING: ['IN_PROGRESS', 'FAILED'],
    IN_PROGRESS: ['COMPLETED', 'FAILED'],
    COMPLETED: [],
    FAILED: ['PENDING'],
  };

  /**
   * 验证是否可以开始新轮次
   *
   * @param debateId - 辩论ID
   * @returns 验证结果
   */
  async validateCanStart(debateId: string): Promise<RoundValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: string[] = [];

    try {
      // 检查辩论是否存在
      const debate = await prisma.debate.findUnique({
        where: { id: debateId },
        include: {
          rounds: {
            where: { status: 'IN_PROGRESS' },
            orderBy: { roundNumber: 'desc' },
          },
        },
      });

      if (!debate) {
        errors.push({
          field: 'debateId',
          message: '辩论不存在',
        });
        return { valid: false, errors, warnings };
      }

      // 检查辩论状态
      if (debate.status !== 'IN_PROGRESS' && debate.status !== 'DRAFT') {
        errors.push({
          field: 'debateStatus',
          message: `辩论状态为${debate.status}，无法开始新轮次`,
        });
      }

      // 检查是否有进行中的轮次
      if (debate.rounds.length > 0) {
        errors.push({
          field: 'concurrentRounds',
          message: '存在进行中的轮次，请先完成当前轮次',
        });
        warnings.push('建议先完成当前轮次再开始新轮次');
      }

      // 检查是否超过最大轮次限制
      const maxRounds =
        (debate.debateConfig as DebateConfig | null)?.maxRounds || 5;
      const completedRounds = await prisma.debateRound.count({
        where: {
          debateId,
          status: 'COMPLETED',
        },
      });

      if (completedRounds >= maxRounds) {
        warnings.push(`已达到最大轮次限制（${maxRounds}轮）`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('验证轮次开始时出错：', error);
      return {
        valid: false,
        errors: [
          {
            field: 'validation',
            message:
              error instanceof Error ? error.message : '验证过程中发生未知错误',
          },
        ],
        warnings,
      };
    }
  }

  /**
   * 验证状态转换是否合法
   *
   * @param from - 源状态
   * @param to - 目标状态
   * @returns 是否允许转换
   */
  validateStatusTransition(from: RoundStatus, to: RoundStatus): boolean {
    const allowedTargets = RoundValidator.VALID_TRANSITIONS[from];
    return allowedTargets?.includes(to) || false;
  }

  /**
   * 验证轮次配置
   *
   * @param config - 轮次配置
   * @returns 验证结果
   */
  validateRoundConfig(config?: RoundConfig): RoundValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: string[] = [];

    if (!config) {
      // 使用默认配置
      return { valid: true, errors: [], warnings: ['使用默认轮次配置'] };
    }

    // 验证最大论点数量
    if (config.maxArguments !== undefined) {
      if (!Number.isInteger(config.maxArguments)) {
        errors.push({
          field: 'maxArguments',
          message: '最大论点数量必须是整数',
        });
      } else if (config.maxArguments < 1) {
        errors.push({
          field: 'maxArguments',
          message: '最大论点数量不能小于1',
        });
      } else if (config.maxArguments > 10) {
        warnings.push('最大论点数量超过10可能会影响生成质量');
      }
    }

    // 验证论点深度
    if (config.argumentDepth !== undefined) {
      if (![1, 2, 3].includes(config.argumentDepth)) {
        errors.push({
          field: 'argumentDepth',
          message: '论点深度必须是1、2或3',
        });
      }
    }

    // 验证递进策略
    if (config.progressionStrategy !== undefined) {
      const validStrategies = ['depth', 'breadth', 'refutation'];
      if (!validStrategies.includes(config.progressionStrategy)) {
        errors.push({
          field: 'progressionStrategy',
          message: `递进策略必须是${validStrategies.join('、')}之一`,
        });
      }
    }

    // 验证论点递进配置
    if (config.enableProgression === true && !config.progressionStrategy) {
      warnings.push('已启用论点递进但未指定递进策略，将使用默认策略（depth）');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证轮次完整性
   * 检查轮次是否包含必要的论点信息
   *
   * @param roundId - 轮次ID
   * @returns 验证结果
   */
  async validateRoundCompleteness(
    roundId: string
  ): Promise<RoundValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: string[] = [];

    try {
      const round = await prisma.debateRound.findUnique({
        where: { id: roundId },
        include: {
          arguments: true,
          debate: true,
        },
      });

      if (!round) {
        errors.push({
          field: 'roundId',
          message: '轮次不存在',
        });
        return { valid: false, errors, warnings };
      }

      // 检查论点数量
      const plaintiffArgs = round.arguments.filter(a => a.side === 'PLAINTIFF');
      const defendantArgs = round.arguments.filter(a => a.side === 'DEFENDANT');

      if (plaintiffArgs.length === 0) {
        errors.push({
          field: 'plaintiffArguments',
          message: '缺少原告论点',
        });
      }

      if (defendantArgs.length === 0) {
        errors.push({
          field: 'defendantArguments',
          message: '缺少被告论点',
        });
      }

      // 检查论点平衡性
      const argDiff = Math.abs(plaintiffArgs.length - defendantArgs.length);
      if (argDiff > 2) {
        warnings.push(
          `正反方论点数量差异较大（原告${plaintiffArgs.length}个，被告${defendantArgs.length}个）`
        );
      }

      // 检查论点质量
      const lowQualityArgs = round.arguments.filter(
        a => (a.confidence || 0) < 0.5
      );
      if (lowQualityArgs.length > 0) {
        warnings.push(
          `有${lowQualityArgs.length}个论点置信度低于0.5，建议人工审查`
        );
      }

      // 检查时间记录
      if (!round.startedAt) {
        warnings.push('轮次缺少开始时间记录');
      }

      if (round.status === 'COMPLETED' && !round.completedAt) {
        errors.push({
          field: 'completedAt',
          message: '已完成的轮次必须记录完成时间',
        });
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('验证轮次完整性时出错：', error);
      return {
        valid: false,
        errors: [
          {
            field: 'validation',
            message:
              error instanceof Error ? error.message : '验证过程中发生未知错误',
          },
        ],
        warnings,
      };
    }
  }

  /**
   * 获取错误摘要
   *
   * @param result - 验证结果
   * @returns 错误摘要字符串
   */
  getErrorSummary(result: RoundValidationResult): string {
    if (result.valid) {
      return '验证通过';
    }

    const errorMessages = result.errors.map(e => `${e.field}: ${e.message}`);
    return `验证失败：${errorMessages.join('; ')}`;
  }

  /**
   * 获取警告摘要
   *
   * @param result - 验证结果
   * @returns 警告摘要字符串
   */
  getWarningSummary(result: RoundValidationResult): string {
    if (result.warnings.length === 0) {
      return '无警告';
    }

    return result.warnings.join('; ');
  }
}
