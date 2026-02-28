/**
 * 冲突检测工具
 *
 * 用于检测法条间的冲突关系
 */

import type { PrismaClient } from '@prisma/client';
import type { RelationType } from '@prisma/client';
import { RelationType as PrismaRelationType } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  ConflictFinderParams,
  ConflictFinderResult,
  ConflictInfo,
  ToolResult,
  ToolConfig,
} from './types';
import { DEFAULT_TOOL_CONFIG } from './types';

/**
 * 冲突检测工具类
 */
export class ConflictFinderTool {
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
    return 'kg_find_conflicts';
  }

  /**
   * 获取工具描述
   */
  getDescription(): string {
    return '检测法条间的冲突关系，包括直接冲突和间接冲突';
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
   * 执行冲突检测
   */
  async execute(
    params: ConflictFinderParams
  ): Promise<ToolResult<ConflictFinderResult>> {
    const startTime = Date.now();

    try {
      // 参数验证
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        logger.error('ConflictFinderTool 参数验证失败', {
          errors: validationResult.errors,
          params,
        });
        return {
          success: false,
          error: `参数验证失败: ${validationResult.errors.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }

      const maxDepth = params.maxDepth ?? 2;
      const includeIndirect = params.includeIndirect ?? true;

      // 查询所有法条
      const articles = await this.prisma.lawArticle.findMany({
        where: {
          id: { in: params.articleIds },
        },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
        },
      });

      if (articles.length === 0) {
        return {
          success: false,
          error: '未找到指定的法条',
          executionTime: Date.now() - startTime,
        };
      }

      // 构建冲突检测结果
      const conflicts: ConflictInfo[] = [];
      let directConflicts = 0;
      let indirectConflicts = 0;

      for (const article of articles) {
        const conflictInfo = await this.findConflictsForArticle(
          article.id,
          `${article.lawName} 第${article.articleNumber}条`,
          maxDepth,
          includeIndirect
        );

        if (conflictInfo.conflictsWith.length > 0) {
          conflicts.push(conflictInfo);

          // 统计直接和间接冲突
          for (const conflict of conflictInfo.conflictsWith) {
            if (conflict.strength >= 0.8) {
              directConflicts++;
            } else {
              indirectConflicts++;
            }
          }
        }
      }

      // 构建统计信息
      const stats = {
        totalArticles: articles.length,
        totalConflicts: conflicts.reduce(
          (sum, c) => sum + c.conflictsWith.length,
          0
        ),
        directConflicts,
        indirectConflicts,
      };

      const result: ConflictFinderResult = {
        conflicts,
        stats,
      };

      logger.info('ConflictFinderTool 检测成功', {
        articleCount: params.articleIds.length,
        conflictCount: stats.totalConflicts,
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
      logger.error('ConflictFinderTool 执行失败', {
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
  private validateParams(params: ConflictFinderParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (
      !params.articleIds ||
      !Array.isArray(params.articleIds) ||
      params.articleIds.length === 0
    ) {
      errors.push('articleIds 是必需的非空数组');
    }

    if (params.maxDepth !== undefined) {
      if (
        typeof params.maxDepth !== 'number' ||
        params.maxDepth < 1 ||
        params.maxDepth > 3
      ) {
        errors.push('maxDepth 必须是 1-3 之间的数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 查找单个法条的冲突
   */
  private async findConflictsForArticle(
    articleId: string,
    articleTitle: string,
    maxDepth: number,
    includeIndirect: boolean
  ): Promise<ConflictInfo> {
    const conflictsWith: ConflictInfo['conflictsWith'] = [];

    // 查询直接冲突关系
    const directConflicts = await this.prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          { sourceId: articleId, relationType: PrismaRelationType.CONFLICTS },
          { targetId: articleId, relationType: PrismaRelationType.CONFLICTS },
        ],
      },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        description: true,
      },
    });

    for (const relation of directConflicts) {
      const conflictArticleId =
        relation.sourceId === articleId ? relation.targetId : relation.sourceId;

      const article = await this.prisma.lawArticle.findUnique({
        where: { id: conflictArticleId },
        select: {
          lawName: true,
          articleNumber: true,
        },
      });

      if (article) {
        conflictsWith.push({
          articleId: conflictArticleId,
          articleTitle: `${article.lawName} 第${article.articleNumber}条`,
          relationType: relation.relationType as RelationType,
          reason: relation.description || '法条内容存在冲突',
          strength: relation.strength,
        });
      }
    }

    // 查询间接冲突（通过传递性推理）
    if (includeIndirect && maxDepth > 1) {
      const indirectConflicts = await this.findIndirectConflicts(
        articleId,
        conflictsWith
      );

      for (const indirect of indirectConflicts) {
        // 避免重复
        const existingConflict = conflictsWith.find(
          c => c.articleId === indirect.articleId
        );

        if (!existingConflict) {
          conflictsWith.push(indirect);
        }
      }
    }

    return {
      articleId,
      articleTitle,
      conflictsWith,
    };
  }

  /**
   * 查找间接冲突
   */
  private async findIndirectConflicts(
    articleId: string,
    existingConflicts: ConflictInfo['conflictsWith']
  ): Promise<ConflictInfo['conflictsWith']> {
    const indirectConflicts: ConflictInfo['conflictsWith'] = [];

    // 查询引用关系的法条
    const citedArticles = await this.prisma.lawArticleRelation.findMany({
      where: {
        sourceId: articleId,
        relationType: PrismaRelationType.CITES,
      },
      select: {
        targetId: true,
      },
    });

    for (const citedRelation of citedArticles) {
      // 查询被引用法条的冲突
      const citedArticleConflicts =
        await this.prisma.lawArticleRelation.findMany({
          where: {
            OR: [
              {
                sourceId: citedRelation.targetId,
                relationType: PrismaRelationType.CONFLICTS,
              },
              {
                targetId: citedRelation.targetId,
                relationType: PrismaRelationType.CONFLICTS,
              },
            ],
            // 排除已经检测到的冲突
            sourceId: { notIn: existingConflicts.map(c => c.articleId) },
            targetId: { notIn: existingConflicts.map(c => c.articleId) },
          },
          select: {
            id: true,
            sourceId: true,
            targetId: true,
            relationType: true,
            strength: true,
            description: true,
          },
          take: 10,
        });

      for (const conflict of citedArticleConflicts) {
        const conflictArticleId =
          conflict.sourceId === citedRelation.targetId
            ? conflict.targetId
            : conflict.sourceId;

        const article = await this.prisma.lawArticle.findUnique({
          where: { id: conflictArticleId },
          select: {
            lawName: true,
            articleNumber: true,
          },
        });

        if (article) {
          indirectConflicts.push({
            articleId: conflictArticleId,
            articleTitle: `${article.lawName} 第${article.articleNumber}条`,
            relationType: conflict.relationType as RelationType,
            reason: `间接冲突（通过引用关系传递）：${conflict.description || '内容冲突'}`,
            strength: Math.max(0.3, conflict.strength - 0.3), // 间接冲突强度降低
          });
        }
      }
    }

    return indirectConflicts;
  }
}
