import { prisma } from '@/lib/db/prisma';
import type {
  CreateCaseExampleInput,
  UpdateCaseExampleInput,
  CaseExampleQueryParams,
  CaseExampleListResponse,
  CaseExampleStatistics,
} from '@/types/case-example';
import type { CaseType, CaseResult, Prisma } from '@prisma/client';
import { CaseEmbeddingServiceFactory } from './embedding-service';

/**
 * 案例库服务类
 * 负责案例的CRUD操作和查询
 */
export class CaseExampleService {
  /**
   * 创建新案例
   */
  static async create(input: CreateCaseExampleInput) {
    return prisma.caseExample.create({
      data: {
        title: input.title,
        caseNumber: input.caseNumber,
        court: input.court,
        type: input.type,
        cause: input.cause,
        facts: input.facts,
        judgment: input.judgment,
        result: input.result,
        judgmentDate: input.judgmentDate,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 获取案例详情
   */
  static async getById(id: string) {
    return prisma.caseExample.findUnique({
      where: { id },
    });
  }

  /**
   * 更新案例
   */
  static async update(id: string, input: UpdateCaseExampleInput) {
    return prisma.caseExample.update({
      where: { id },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.caseNumber && { caseNumber: input.caseNumber }),
        ...(input.court && { court: input.court }),
        ...(input.type && { type: input.type }),
        ...(input.cause !== undefined && { cause: input.cause }),
        ...(input.facts && { facts: input.facts }),
        ...(input.judgment && { judgment: input.judgment }),
        ...(input.result && { result: input.result }),
        ...(input.judgmentDate && { judgmentDate: input.judgmentDate }),
        ...(input.metadata !== undefined && {
          metadata: input.metadata as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * 删除案例
   */
  static async delete(id: string) {
    return prisma.caseExample.delete({
      where: { id },
    });
  }

  /**
   * 查询案例列表
   */
  static async list(
    params: CaseExampleQueryParams
  ): Promise<CaseExampleListResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(params);

    const [examples, total] = await Promise.all([
      prisma.caseExample.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildOrderBy(params),
      }),
      prisma.caseExample.count({ where }),
    ]);

    return {
      examples,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取案例统计信息
   */
  static async getStatistics(): Promise<CaseExampleStatistics> {
    const [total, byType, byResult, byCourt, byCause] = await Promise.all([
      prisma.caseExample.count(),
      this.groupByField('type'),
      this.groupByField('result'),
      this.groupByField('court'),
      this.groupByField('cause'),
    ]);

    const winCount = byResult.WIN ?? 0;
    const loseCount = byResult.LOSE ?? 0;
    const totalResultCount = winCount + loseCount;
    const winRate =
      totalResultCount > 0 ? (winCount / totalResultCount) * 100 : 0;

    return {
      total,
      byType: byType as Record<CaseType, number>,
      byResult: byResult as Record<CaseResult, number>,
      byCourt: byCourt as Record<string, number>,
      byCause: byCause as Record<string, number>,
      winRate,
    };
  }

  /**
   * 按字段分组统计
   */
  private static async groupByField(
    field: string
  ): Promise<Record<string, number>> {
    const results = await prisma.caseExample.groupBy({
      by: [field as 'type' | 'result' | 'court' | 'cause'],
      _count: true,
    });

    return results.reduce(
      (acc, item) => {
        const key = item[field as keyof typeof item];
        if (key !== null && typeof key === 'string') {
          acc[key] = item._count;
        }
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * 构建查询条件
   */
  private static buildWhereClause(params: CaseExampleQueryParams) {
    const conditions: Record<string, unknown>[] = [];

    if (params.type) {
      conditions.push({ type: params.type });
    }
    if (params.result) {
      conditions.push({ result: params.result });
    }
    if (params.court) {
      conditions.push({
        court: { contains: params.court, mode: 'insensitive' },
      });
    }
    if (params.cause) {
      conditions.push({
        cause: { contains: params.cause, mode: 'insensitive' },
      });
    }
    if (params.startDate || params.endDate) {
      conditions.push({
        judgmentDate: {
          ...(params.startDate && { gte: params.startDate }),
          ...(params.endDate && { lte: params.endDate }),
        },
      });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /**
   * 构建排序条件
   */
  private static buildOrderBy(params: CaseExampleQueryParams) {
    const field = params.sortBy ?? 'judgmentDate';
    const direction = params.sortOrder ?? 'desc';

    return { [field]: direction };
  }

  /**
   * 为案例生成向量嵌入
   * @param id 案例ID
   * @returns 生成结果
   */
  static async generateEmbedding(id: string): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> {
    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    return await embeddingService.generateAndStoreEmbedding(id);
  }

  /**
   * 批量为案例生成向量嵌入
   * @param ids 案例ID列表
   * @returns 批量生成结果
   */
  static async batchGenerateEmbeddings(ids: string[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      id: string;
      success: boolean;
      embedding?: number[];
      error?: string;
    }>;
  }> {
    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    return await embeddingService.batchGenerateAndStore(ids);
  }

  /**
   * 获取案例的向量嵌入
   * @param id 案例ID
   * @returns 向量嵌入数据
   */
  static async getEmbedding(id: string): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> {
    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    return await embeddingService.getEmbedding(id);
  }

  /**
   * 删除案例的向量嵌入
   * @param id 案例ID
   * @returns 删除结果
   */
  static async deleteEmbedding(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    return await embeddingService.deleteEmbedding(id);
  }

  /**
   * 获取向量嵌入统计信息
   * @returns 统计数据
   */
  static async getEmbeddingStatistics(): Promise<{
    totalCases: number;
    casesWithEmbedding: number;
    casesWithoutEmbedding: number;
  }> {
    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    return await embeddingService.getStatistics();
  }
}
