/**
 * 知识图谱版本控制 - 快照服务
 *
 * 提供版本控制的业务逻辑：
 * - 创建快照
 * - 获取快照列表
 * - 获取快照详情
 * - 比较快照差异
 * - 清理过期快照
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  GraphSnapshot,
  SnapshotStatistics,
  CreateSnapshotInput,
  SnapshotComparisonResult,
  SnapshotVersion,
  SnapshotStatus,
  SnapshotData,
  SnapshotChange,
  calculateSnapshotVersion,
  compareSnapshots,
  DEFAULT_SNAPSHOT_CONFIG,
} from './types';

const prisma = new PrismaClient();

/**
 * 快照服务类
 */
export class SnapshotService {
  /**
   * 创建新快照
   */
  async createSnapshot(
    input: CreateSnapshotInput,
    userId?: string
  ): Promise<GraphSnapshot> {
    logger.info('开始创建知识图谱快照', { version: input.version, userId });

    try {
      // 获取当前知识图谱统计信息
      const statistics = await this.gatherStatistics();

      // 生成版本标签
      const versionLabel = calculateSnapshotVersion(input.version, new Date());

      // 创建快照记录
      const snapshot = await prisma['knowledgeGraphSnapshot'].create({
        data: {
          snapshotDate: new Date(),
          version: input.version,
          versionLabel,
          totalArticles: statistics.totalArticles,
          totalRelations: statistics.totalRelations,
          verifiedRelations: statistics.verifiedRelations,
          pendingRelations: statistics.pendingRelations,
          averageConfidence: statistics.averageConfidence,
          snapshotData: input.includeFullData
            ? (await this.gatherFullData() as Prisma.InputJsonValue)
            : Prisma.DbNull,
          changes: input.includeChanges ? (await this.calculateChanges() as Prisma.InputJsonValue) : Prisma.DbNull,
          status: SnapshotStatus.COMPLETED,
          description: input.description,
          createdBy: userId,
        },
      });

      logger.info('快照创建成功', { snapshotId: snapshot.id, versionLabel });
      return this.mapToGraphSnapshot(snapshot);
    } catch (error) {
      logger.error('创建快照失败', { error, version: input.version });
      throw error;
    }
  }

  /**
   * 获取快照列表
   */
  async getSnapshots(options?: {
    version?: SnapshotVersion;
    status?: SnapshotStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{
    snapshots: GraphSnapshot[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (options?.version) {
      where.version = options.version;
    }

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.startDate || options?.endDate) {
      where.snapshotDate = {};
      if (options.startDate) {
        (where.snapshotDate as Record<string, Date>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.snapshotDate as Record<string, Date>).lte = options.endDate;
      }
    }

    const [snapshots, total] = await Promise.all([
      prisma['knowledgeGraphSnapshot'].findMany({
        where,
        orderBy: { snapshotDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma['knowledgeGraphSnapshot'].count({ where }),
    ]);

    return {
      snapshots: snapshots.map(this.mapToGraphSnapshot),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取快照详情
   */
  async getSnapshot(snapshotId: string): Promise<GraphSnapshot | null> {
    const snapshot = await prisma['knowledgeGraphSnapshot'].findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot) {
      return null;
    }

    return this.mapToGraphSnapshot(snapshot);
  }

  /**
   * 获取最新快照
   */
  async getLatestSnapshot(): Promise<GraphSnapshot | null> {
    const snapshot = await prisma['knowledgeGraphSnapshot'].findFirst({
      orderBy: { snapshotDate: 'desc' },
      where: { status: SnapshotStatus.COMPLETED },
    });

    if (!snapshot) {
      return null;
    }

    return this.mapToGraphSnapshot(snapshot);
  }

  /**
   * 比较两个快照
   */
  async compareSnapshots(
    snapshot1Id: string,
    snapshot2Id: string
  ): Promise<SnapshotComparisonResult | null> {
    const [snapshot1, snapshot2] = await Promise.all([
      prisma['knowledgeGraphSnapshot'].findUnique({
        where: { id: snapshot1Id },
      }),
      prisma['knowledgeGraphSnapshot'].findUnique({
        where: { id: snapshot2Id },
      }),
    ]);

    if (!snapshot1 || !snapshot2) {
      return null;
    }

    const graphSnapshot1 = this.mapToGraphSnapshot(snapshot1);
    const graphSnapshot2 = this.mapToGraphSnapshot(snapshot2);

    return compareSnapshots(graphSnapshot1, graphSnapshot2);
  }

  /**
   * 清理过期快照
   */
  async cleanupOldSnapshots(retentionDays?: number): Promise<number> {
    const days = retentionDays ?? DEFAULT_SNAPSHOT_CONFIG.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    logger.info('开始清理过期快照', {
      cutoffDate: cutoffDate.toISOString(),
      days,
    });

    const result = await prisma['knowledgeGraphSnapshot'].deleteMany({
      where: {
        snapshotDate: { lt: cutoffDate },
      },
    });

    logger.info('过期快照清理完成', { deletedCount: result.count });
    return result.count;
  }

  /**
   * 获取快照统计
   */
  async getSnapshotStatistics(): Promise<{
    totalSnapshots: number;
    totalSize: number;
    byVersion: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const [totalSnapshots, snapshots] = await Promise.all([
      prisma['knowledgeGraphSnapshot'].count(),
      prisma['knowledgeGraphSnapshot'].findMany({
        select: { version: true, status: true, snapshotData: true },
      }),
    ]);

    const byVersion: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalSize = 0;

    for (const snapshot of snapshots) {
      byVersion[snapshot.version] = (byVersion[snapshot.version] || 0) + 1;
      byStatus[snapshot.status] = (byStatus[snapshot.status] || 0) + 1;

      if (snapshot.snapshotData) {
        totalSize += JSON.stringify(snapshot.snapshotData).length;
      }
    }

    return { totalSnapshots, totalSize, byVersion, byStatus };
  }

  /**
   * 收集知识图谱统计信息
   */
  private async gatherStatistics(): Promise<SnapshotStatistics> {
    const [articlesCount, relationsCount, verifiedCount, pendingCount] =
      await Promise.all([
        prisma.lawArticle.count(),
        prisma.lawArticleRelation.count(),
        prisma.lawArticleRelation.count({
          where: { verificationStatus: 'VERIFIED' },
        }),
        prisma.lawArticleRelation.count({
          where: { verificationStatus: 'PENDING' },
        }),
      ]);

    // 计算平均置信度
    const confidenceResult = await prisma.lawArticleRelation.aggregate({
      _avg: { confidence: true },
    });

    return {
      totalArticles: articlesCount,
      totalRelations: relationsCount,
      verifiedRelations: verifiedCount,
      pendingRelations: pendingCount,
      averageConfidence: confidenceResult._avg.confidence ?? 0,
    };
  }

  /**
   * 收集完整数据（用于完整快照）
   */
  private async gatherFullData(): Promise<{
    nodes: Array<{ id: string; label: string }>;
    edges: Array<{ source: string; target: string; relationType: string }>;
  }> {
    const [articles, relations] = await Promise.all([
      prisma.lawArticle.findMany({
        select: { id: true, lawName: true, articleNumber: true },
        take: 10000, // 限制数量
      }),
      prisma.lawArticleRelation.findMany({
        select: { sourceId: true, targetId: true, relationType: true },
        take: 50000, // 限制数量
      }),
    ]);

    return {
      nodes: articles.map(a => ({
        id: a.id,
        label: `${a.lawName}${a.articleNumber}`,
      })),
      edges: relations.map(r => ({
        source: r.sourceId,
        target: r.targetId,
        relationType: r.relationType,
      })),
    };
  }

  /**
   * 计算变更（与上一快照的差异）
   */
  private async calculateChanges(): Promise<
    Array<{
      type: string;
      entityType: string;
      entityId: string;
      description: string;
    }>
  > {
    // 获取上一个快照
    const lastSnapshot = await prisma['knowledgeGraphSnapshot'].findFirst({
      orderBy: { snapshotDate: 'desc' },
      where: { status: SnapshotStatus.COMPLETED },
    });

    const changes: Array<{
      type: string;
      entityType: string;
      entityId: string;
      description: string;
    }> = [];

    if (!lastSnapshot) {
      // 首次快照，记录所有当前数据
      changes.push({
        type: 'ADDED',
        entityType: 'system',
        entityId: 'initial',
        description: '首次快照创建',
      });
      return changes;
    }

    // 计算新增关系数
    const newRelations = lastSnapshot.totalRelations;
    if (newRelations > 0) {
      changes.push({
        type: 'ADDED',
        entityType: 'relation',
        entityId: 'new-relations',
        description: `新增 ${newRelations} 个关系`,
      });
    }

    return changes;
  }

  /**
   * 将数据库实体映射为GraphSnapshot
   */
  private mapToGraphSnapshot(snapshot: Record<string, unknown>): GraphSnapshot {
    return {
      id: snapshot.id as string,
      version: snapshot.version as SnapshotVersion,
      snapshotDate: snapshot.snapshotDate as Date,
      versionLabel: snapshot.versionLabel as string,
      statistics: {
        totalArticles: snapshot.totalArticles as number,
        totalRelations: snapshot.totalRelations as number,
        verifiedRelations: snapshot.verifiedRelations as number,
        pendingRelations: snapshot.pendingRelations as number,
        averageConfidence: snapshot.averageConfidence as number,
      },
      snapshotData: snapshot.snapshotData as SnapshotData | undefined,
      changes: snapshot.changes as SnapshotChange[] | undefined,
      status: snapshot.status as SnapshotStatus,
      description: snapshot.description as string | undefined,
      createdBy: snapshot.createdBy as string | undefined,
      createdAt: snapshot.createdAt as Date,
      updatedAt: snapshot.updatedAt as Date,
    };
  }
}

// 导出服务实例
export const snapshotService = new SnapshotService();

// 导出服务创建函数
export function createSnapshotService(): SnapshotService {
  return new SnapshotService();
}
