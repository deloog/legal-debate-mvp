/**
 * 效力链追踪工具
 *
 * 用于追踪法条的效力链，包括替代关系和引用关系
 */

import type { PrismaClient } from '@prisma/client';
import { RelationType as PrismaRelationType } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  ValidityTracerParams,
  ValidityTracerResult,
  ValidityChainNode,
  ToolResult,
  ToolConfig,
} from './types';
import { DEFAULT_TOOL_CONFIG } from './types';

/**
 * 效力链追踪工具类
 */
export class ValidityTracerTool {
  private readonly prisma: PrismaClient;
  private config: ToolConfig;

  constructor(prisma: PrismaClient, config: Partial<ToolConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_TOOL_CONFIG, ...config };
  }

  /**
   * 获取工具名称
   */
  getName(): string {
    return 'kg_trace_validity';
  }

  /**
   * 获取工具描述
   */
  getDescription(): string {
    return '追踪法条的效力链，查找替代法条和效力状态';
  }

  /**
   * 获取工具配置
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }

  /**
   * 更新工具配置
   */
  updateConfig(updates: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 执行效力链追踪
   */
  async execute(
    params: ValidityTracerParams
  ): Promise<ToolResult<ValidityTracerResult>> {
    const startTime = Date.now();

    try {
      // 参数验证
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        logger.error('ValidityTracerTool 参数验证失败', {
          errors: validationResult.errors,
          params,
        });
        return {
          success: false,
          error: `参数验证失败: ${validationResult.errors.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }

      const maxDepth = params.maxDepth ?? 5;
      const includeReplacements = params.includeReplacements ?? true;
      const includeCitations = params.includeCitations ?? false;

      // 查询起始法条
      const startArticle = await this.prisma.lawArticle.findUnique({
        where: { id: params.articleId },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          status: true,
          effectiveDate: true,
        },
      });

      if (!startArticle) {
        return {
          success: false,
          error: `法条不存在: ${params.articleId}`,
          executionTime: Date.now() - startTime,
        };
      }

      // 构建效力链
      const chain: ValidityChainNode[] = [];
      const visitedIds = new Set<string>([params.articleId]);

      const startNode: ValidityChainNode = {
        articleId: startArticle.id,
        title: `${startArticle.lawName} 第${startArticle.articleNumber}条`,
        status: startArticle.status as ValidityChainNode['status'],
        effectiveDate: startArticle.effectiveDate,
      };
      chain.push(startNode);

      // 追踪替代关系
      if (includeReplacements) {
        await this.traceReplacements(
          startArticle.id,
          chain,
          visitedIds,
          maxDepth - 1
        );
      }

      // 追踪引用关系
      if (includeCitations) {
        await this.traceCitations(
          startArticle.id,
          chain,
          visitedIds,
          maxDepth - 1
        );
      }

      // 确定链的当前状态
      const currentStatus = this.determineCurrentStatus(chain);

      // 查找有效法条（链的末端）
      const validArticle = this.findValidArticle(chain);

      // 计算统计信息
      const replacementCount = this.countReplacements(chain);

      const result: ValidityTracerResult = {
        articleId: params.articleId,
        chain,
        currentStatus,
        validArticle,
        stats: {
          chainLength: chain.length,
          replacementCount,
        },
      };

      logger.info('ValidityTracerTool 追踪成功', {
        articleId: params.articleId,
        chainLength: chain.length,
        currentStatus,
        executionTime: Date.now() - startTime,
      });

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('ValidityTracerTool 执行失败', {
        error: errorMessage,
        params,
      });
      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParams(params: ValidityTracerParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!params.articleId || typeof params.articleId !== 'string') {
      errors.push('articleId 是必需的字符串');
    }

    if (params.maxDepth !== undefined) {
      if (
        typeof params.maxDepth !== 'number' ||
        params.maxDepth < 1 ||
        params.maxDepth > 10
      ) {
        errors.push('maxDepth 必须是 1-10 之间的数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 追踪替代关系
   */
  private async traceReplacements(
    articleId: string,
    chain: ValidityChainNode[],
    visitedIds: Set<string>,
    maxDepth: number
  ): Promise<void> {
    if (maxDepth <= 0) {
      return;
    }

    // 查询被替代关系（谁替代了当前法条）
    const supersedingRelations = await this.prisma.lawArticleRelation.findMany({
      where: {
        targetId: articleId,
        relationType: PrismaRelationType.SUPERSEDES,
      },
      select: {
        id: true,
        sourceId: true,
        createdAt: true,
      },
      take: 1, // 只取最新的替代关系
      orderBy: { createdAt: 'desc' },
    });

    // 查询替代关系（当前法条替代了谁）
    const supersededRelations = await this.prisma.lawArticleRelation.findMany({
      where: {
        sourceId: articleId,
        relationType: PrismaRelationType.SUPERSEDES,
      },
      select: {
        id: true,
        targetId: true,
        createdAt: true,
      },
      take: 1, // 只取最新的替代关系
      orderBy: { createdAt: 'desc' },
    });

    // 处理被替代关系（向上查找）
    if (supersedingRelations.length > 0) {
      const relation = supersedingRelations[0];
      if (!visitedIds.has(relation.sourceId)) {
        const article = await this.prisma.lawArticle.findUnique({
          where: { id: relation.sourceId },
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
            effectiveDate: true,
          },
        });

        if (article) {
          visitedIds.add(article.id);

          const node: ValidityChainNode = {
            articleId: article.id,
            title: `${article.lawName} 第${article.articleNumber}条`,
            status: article.status as ValidityChainNode['status'],
            effectiveDate: article.effectiveDate,
            replacedBy: {
              articleId: article.id,
              replacedAt: relation.createdAt,
            },
          };
          chain.push(node);

          // 继续追踪
          await this.traceReplacements(
            article.id,
            chain,
            visitedIds,
            maxDepth - 1
          );
        }
      }
    }

    // 处理替代关系（向下查找）
    if (supersededRelations.length > 0) {
      const relation = supersededRelations[0];
      if (!visitedIds.has(relation.targetId)) {
        const article = await this.prisma.lawArticle.findUnique({
          where: { id: relation.targetId },
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
            effectiveDate: true,
          },
        });

        if (article) {
          visitedIds.add(article.id);

          const node: ValidityChainNode = {
            articleId: article.id,
            title: `${article.lawName} 第${article.articleNumber}条`,
            status: article.status as ValidityChainNode['status'],
            effectiveDate: article.effectiveDate,
            replacedBy: {
              articleId: article.id,
              replacedAt: relation.createdAt,
            },
          };
          chain.push(node);

          // 继续追踪
          await this.traceReplacements(
            article.id,
            chain,
            visitedIds,
            maxDepth - 1
          );
        }
      }
    }
  }

  /**
   * 追踪引用关系
   */
  private async traceCitations(
    articleId: string,
    chain: ValidityChainNode[],
    visitedIds: Set<string>,
    maxDepth: number
  ): Promise<void> {
    if (maxDepth <= 0) {
      return;
    }

    // 查询引用关系
    const citations = await this.prisma.lawArticleRelation.findMany({
      where: {
        sourceId: articleId,
        relationType: PrismaRelationType.CITES,
      },
      select: {
        id: true,
        targetId: true,
      },
      take: 5, // 限制引用数量
      orderBy: { createdAt: 'desc' },
    });

    for (const citation of citations) {
      if (!visitedIds.has(citation.targetId)) {
        const article = await this.prisma.lawArticle.findUnique({
          where: { id: citation.targetId },
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
            effectiveDate: true,
          },
        });

        if (article) {
          visitedIds.add(article.id);

          const node: ValidityChainNode = {
            articleId: article.id,
            title: `${article.lawName} 第${article.articleNumber}条`,
            status: article.status as ValidityChainNode['status'],
            effectiveDate: article.effectiveDate,
          };
          chain.push(node);

          // 继续追踪
          await this.traceCitations(
            article.id,
            chain,
            visitedIds,
            maxDepth - 1
          );
        }
      }
    }
  }

  /**
   * 确定链的当前状态
   */
  private determineCurrentStatus(
    chain: ValidityChainNode[]
  ): ValidityChainNode['status'] {
    if (chain.length === 0) {
      return 'VALID';
    }

    // 优先级: VALID > OBSOLETE > REPEALED > IN_EFFECT
    const statusPriority: Record<ValidityChainNode['status'], number> = {
      VALID: 4,
      IN_EFFECT: 3,
      OBSOLETE: 2,
      REPEALED: 1,
    };

    let highestStatus = chain[0].status;
    let highestPriority = statusPriority[highestStatus];

    for (const node of chain) {
      const priority = statusPriority[node.status];
      if (priority > highestPriority) {
        highestStatus = node.status;
        highestPriority = priority;
      }
    }

    return highestStatus;
  }

  /**
   * 查找有效法条（链的末端）
   */
  private findValidArticle(
    chain: ValidityChainNode[]
  ): ValidityChainNode | undefined {
    // 查找状态为 VALID 或 IN_EFFECT 的法条
    const validArticles = chain.filter(
      node => node.status === 'VALID' || node.status === 'IN_EFFECT'
    );

    if (validArticles.length === 0) {
      return undefined;
    }

    // 返回最后一个有效法条（最新的）
    return validArticles[validArticles.length - 1];
  }

  /**
   * 计算替代次数
   */
  private countReplacements(chain: ValidityChainNode[]): number {
    return chain.filter(node => node.replacedBy !== undefined).length;
  }
}
