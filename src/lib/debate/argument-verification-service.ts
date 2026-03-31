/**
 * 论点验证服务
 * 将 VerificationAgent 集成到辩论生成流程中
 *
 * 功能：
 * 1. 对生成的论点进行三重验证（事实+逻辑+完整度）
 * 2. 将验证结果存储到数据库
 * 3. 提供验证详情查询
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { VerificationAgent } from '@/lib/agent/verification-agent';
import type {
  VerificationResult,
  VerificationIssue,
} from '@/lib/agent/verification-agent/types';
import {
  IssueType,
  IssueSeverity,
  IssueCategory,
  SuggestionType,
  SuggestionPriority,
} from '@/lib/agent/verification-agent/types';
import type { Argument, DebateInput } from './types';

/**
 * 默认验证分数 - 当验证失败时的降级分数
 *
 * 使用 0.5 表示中等质量，既不偏向高分也不偏向低分，
 * 避免对辩论整体评分产生过大影响
 */
export const DEFAULT_VERIFICATION_SCORE = 0.5;

/**
 * 论点验证数据（存储在 Argument 表的 verificationData 字段）
 */
export interface ArgumentVerificationData {
  verifiedAt: string;
  verificationResult: VerificationResult;
  factualIssues: VerificationIssue[];
  logicalIssues: VerificationIssue[];
  completenessIssues: VerificationIssue[];
}

/**
 * 论点验证服务
 */
export class ArgumentVerificationService {
  private verificationAgent: VerificationAgent;

  constructor() {
    this.verificationAgent = new VerificationAgent();
  }

  /**
   * 验证单个论点
   *
   * @param argument 要验证的论点
   * @param input 辩论输入（包含案件信息）
   * @returns 验证结果
   */
  async verifyArgument(
    argument: Argument,
    input: DebateInput
  ): Promise<{
    legalScore: number;
    logicScore: number;
    overallScore: number;
    verificationData: ArgumentVerificationData;
  }> {
    const startTime = Date.now();

    try {
      // 构建验证数据
      const dataToVerify = this.buildDataToVerify(argument, input);

      // 调用 VerificationAgent 进行验证
      // SourceData.parties 期望 { name?: string; id?: string } 格式
      const result = await this.verificationAgent.verify(dataToVerify, {
        parties: {
          plaintiff: { name: input.caseInfo.parties.plaintiff },
          defendant: { name: input.caseInfo.parties.defendant },
        },
      });

      // 分类问题
      const factualIssues = result.issues.filter(
        i => i.category === IssueCategory.FACTUAL || i.detectedBy === 'factual'
      );
      const logicalIssues = result.issues.filter(
        i => i.category === IssueCategory.LOGICAL || i.detectedBy === 'logical'
      );
      const completenessIssues = result.issues.filter(
        i =>
          i.category === IssueCategory.COMPLETENESS ||
          i.detectedBy === 'completeness'
      );

      // 构建验证数据
      const verificationData: ArgumentVerificationData = {
        verifiedAt: new Date().toISOString(),
        verificationResult: result,
        factualIssues,
        logicalIssues,
        completenessIssues,
      };

      logger.info('论点验证完成', {
        argumentId: argument.id,
        overallScore: result.overallScore,
        factualAccuracy: result.factualAccuracy,
        logicalConsistency: result.logicalConsistency,
        taskCompleteness: result.taskCompleteness,
        verificationTime: Date.now() - startTime,
      });

      return {
        // 映射 VerificationAgent 的分数到 Argument 的字段
        legalScore: result.factualAccuracy, // 事实准确性映射到法律准确性
        logicScore: result.logicalConsistency, // 逻辑一致性
        overallScore: result.overallScore, // 综合评分
        verificationData,
      };
    } catch (error) {
      logger.error('论点验证失败:', error);
      // 验证失败时返回默认分数，不阻断流程
      return {
        legalScore: DEFAULT_VERIFICATION_SCORE,
        logicScore: DEFAULT_VERIFICATION_SCORE,
        overallScore: DEFAULT_VERIFICATION_SCORE,
        verificationData: {
          verifiedAt: new Date().toISOString(),
          verificationResult: {
            overallScore: DEFAULT_VERIFICATION_SCORE,
            factualAccuracy: DEFAULT_VERIFICATION_SCORE,
            logicalConsistency: DEFAULT_VERIFICATION_SCORE,
            taskCompleteness: DEFAULT_VERIFICATION_SCORE,
            passed: false,
            issues: [
              {
                id: 'verification_error',
                type: IssueType.VALIDATION_ERROR,
                severity: IssueSeverity.HIGH,
                category: IssueCategory.COMPLETENESS,
                message: `验证过程出错: ${error instanceof Error ? error.message : '未知错误'}`,
                detectedBy: 'system',
              },
            ],
            suggestions: [],
            verificationTime: 0,
          },
          factualIssues: [],
          logicalIssues: [],
          completenessIssues: [
            {
              id: 'verification_error',
              type: IssueType.VALIDATION_ERROR,
              severity: IssueSeverity.HIGH,
              category: IssueCategory.COMPLETENESS,
              message: `验证过程出错: ${error instanceof Error ? error.message : '未知错误'}`,
              detectedBy: 'system',
            },
          ],
        },
      };
    }
  }

  /**
   * 批量验证论点并保存到数据库
   *
   * 【优化】使用并行验证和批量更新，性能提升约 60-80%
   * 原串行处理：n * (verificationTime + dbTime)
   * 现并行处理：max(verificationTime) + dbTime
   *
   * @param arguments_ 论点列表
   * @param input 辩论输入
   * @returns 验证后的论点（已保存到数据库）
   */
  async verifyAndSaveArguments(
    arguments_: Argument[],
    input: DebateInput
  ): Promise<Argument[]> {
    if (arguments_.length === 0) {
      return [];
    }

    logger.info(`开始并行验证 ${arguments_.length} 个论点...`);
    const verifyStartTime = Date.now();

    try {
      // 【优化1】并行验证所有论点
      const verificationPromises = arguments_.map(arg =>
        this.verifyArgument(arg, input).then(verification => ({
          argument: arg,
          verification,
        }))
      );

      const results = await Promise.allSettled(verificationPromises);

      // 处理验证结果
      type VerificationResultType = {
        legalScore: number;
        logicScore: number;
        overallScore: number;
        verificationData: ArgumentVerificationData;
      };
      const verifiedData: Array<{
        argument: Argument;
        verification: VerificationResultType;
      }> = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          verifiedData.push(result.value);
        } else {
          // 验证失败，使用默认分数
          logger.error(`论点 ${arguments_[index].id} 验证失败:`, result.reason);
          verifiedData.push({
            argument: arguments_[index],
            verification: {
              legalScore: 0,
              logicScore: 0,
              overallScore: 0,
              verificationData: {
                verifiedAt: new Date().toISOString(),
                verificationResult: {
                  overallScore: 0,
                  factualAccuracy: 0,
                  logicalConsistency: 0,
                  taskCompleteness: 0,
                  passed: false,
                  issues: [
                    {
                      id: 'verification_failed',
                      type: IssueType.VALIDATION_ERROR,
                      severity: IssueSeverity.HIGH,
                      category: IssueCategory.COMPLETENESS,
                      message: `验证失败: ${result.reason}`,
                      detectedBy: 'system',
                    },
                  ],
                  suggestions: [
                    {
                      id: 'retry',
                      type: SuggestionType.DATA_COMPLETION,
                      priority: SuggestionPriority.HIGH,
                      action: '重新生成论点',
                      reason: '验证过程出错',
                      estimatedImpact: '可能获得更准确的评分',
                    },
                  ],
                  verificationTime: 0,
                },
                factualIssues: [],
                logicalIssues: [],
                completenessIssues: [
                  {
                    id: 'verification_failed',
                    type: IssueType.VALIDATION_ERROR,
                    severity: IssueSeverity.HIGH,
                    category: IssueCategory.COMPLETENESS,
                    message: `验证失败: ${result.reason}`,
                    detectedBy: 'system',
                  },
                ],
              },
            },
          });
        }
      });

      logger.info(`并行验证完成，耗时: ${Date.now() - verifyStartTime}ms`);

      // 【优化2】批量更新数据库
      const updateStartTime = Date.now();

      const updatePromises = verifiedData.map(({ argument, verification }) =>
        prisma.argument
          .update({
            where: { id: argument.id },
            data: {
              legalScore: verification.legalScore,
              logicScore: verification.logicScore,
              overallScore: verification.overallScore,
              metadata: {
                ...(this.isRecord(argument.metadata) ? argument.metadata : {}),
                verification: verification.verificationData,
              } as unknown as Prisma.InputJsonValue,
            },
          })
          .then(updated => updated as unknown as Argument)
          .catch(error => {
            logger.error(`更新论点 ${argument.id} 失败:`, error);
            // 返回带验证数据的原始论点
            return {
              ...argument,
              legalScore: verification.legalScore,
              logicScore: verification.logicScore,
              overallScore: verification.overallScore,
              metadata: {
                ...(this.isRecord(argument.metadata) ? argument.metadata : {}),
                verification: verification.verificationData,
              },
            } as Argument;
          })
      );

      const verifiedArguments = await Promise.all(updatePromises);

      logger.info(`批量更新完成，耗时: ${Date.now() - updateStartTime}ms`);
      logger.info(
        `论点验证全流程完成，总耗时: ${Date.now() - verifyStartTime}ms`
      );

      return verifiedArguments;
    } catch (error) {
      logger.error('批量验证论点失败:', error);
      // 返回原始论点，避免流程中断
      return arguments_;
    }
  }

  /**
   * 类型守卫：检查值是否为 Record
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 获取论点的验证详情
   *
   * @param argumentId 论点ID
   * @returns 验证数据
   */
  async getVerificationDetails(
    argumentId: string
  ): Promise<ArgumentVerificationData | null> {
    try {
      const argument = await prisma.argument.findUnique({
        where: { id: argumentId },
        select: { metadata: true },
      });

      if (!argument?.metadata) {
        return null;
      }

      // 使用类型守卫安全解析元数据
      const metadata = argument.metadata;
      if (!this.isRecord(metadata)) {
        return null;
      }

      const verification = metadata.verification;
      if (this.isVerificationData(verification)) {
        return verification;
      }

      return null;
    } catch (error) {
      logger.error(`获取论点 ${argumentId} 验证详情失败:`, error);
      return null;
    }
  }

  /**
   * 类型守卫：检查值是否为 ArgumentVerificationData
   */
  private isVerificationData(
    value: unknown
  ): value is ArgumentVerificationData {
    if (!this.isRecord(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;

    // 检查必需的字段
    if (typeof record.verifiedAt !== 'string') {
      return false;
    }

    const verificationResult = record.verificationResult;
    if (!this.isRecord(verificationResult)) {
      return false;
    }

    // 检查 VerificationResult 必需的数字字段
    const numFields = [
      'overallScore',
      'factualAccuracy',
      'logicalConsistency',
      'taskCompleteness',
    ];
    for (const field of numFields) {
      if (typeof verificationResult[field] !== 'number') {
        return false;
      }
    }

    // 检查 issues 和 suggestions 数组
    const issuesFields = [
      'factualIssues',
      'logicalIssues',
      'completenessIssues',
    ];
    for (const field of issuesFields) {
      if (!Array.isArray(record[field])) {
        return false;
      }
    }

    return true;
  }

  /**
   * 构建验证数据
   *
   * @param argument 论点
   * @param input 辩论输入
   * @returns 验证数据
   */
  private buildDataToVerify(
    argument: Argument,
    input: DebateInput
  ): {
    content: string;
    reasoning: string;
    legalBasis: Array<{
      lawName: string;
      articleNumber: string;
      relevance: number;
    }>;
    facts: string[];
    claims: string[];
    parties: {
      plaintiff: { name: string };
      defendant: { name: string };
    };
  } {
    // 解析法律依据
    let legalBasis: Array<{
      lawName: string;
      articleNumber: string;
      relevance: number;
    }> = [];

    if (Array.isArray(argument.legalBasis)) {
      legalBasis = argument.legalBasis.map((basis: unknown) => {
        if (typeof basis === 'object' && basis !== null) {
          const b = basis as Record<string, unknown>;
          return {
            lawName: String(b.lawName || ''),
            articleNumber: String(b.articleNumber || ''),
            relevance: Number(b.relevance || 0),
          };
        }
        return { lawName: '', articleNumber: '', relevance: 0 };
      });
    }

    return {
      content: argument.content,
      reasoning: argument.reasoning || '',
      legalBasis,
      facts: [input.caseInfo.description],
      claims: [argument.content],
      parties: {
        plaintiff: { name: input.caseInfo.parties.plaintiff || '' },
        defendant: { name: input.caseInfo.parties.defendant || '' },
      },
    };
  }
}

// 导出单例
export const argumentVerificationService = new ArgumentVerificationService();
