import type { Prisma } from "@prisma/client";
import type { SearchQuery } from "./types";

/**
 * 法条检索查询构建器
 * 负责根据检索条件构建Prisma查询对象
 */
export class SearchQueryBuilder {
  /**
   * 构建基础查询条件
   */
  static buildWhereClause(query: SearchQuery): Prisma.LawArticleWhereInput {
    const conditions: Prisma.LawArticleWhereInput[] = [];

    // 关键词搜索（模糊匹配）- 支持多个空格分隔的关键词
    if (query.keyword && query.keyword.trim()) {
      const keywords = query.keyword
        .trim()
        .split(/\s+/)
        .filter((k) => k.length > 0);

      if (keywords.length > 0) {
        // 为每个关键词分别构建搜索条件（OR关系）
        const keywordConditions = keywords.map((keyword) => ({
          OR: [
            { fullText: { contains: keyword, mode: "insensitive" } },
            { searchableText: { contains: keyword, mode: "insensitive" } },
            { lawName: { contains: keyword, mode: "insensitive" } },
          ],
        })) as Prisma.LawArticleWhereInput[];

        conditions.push({ OR: keywordConditions });
      }
    }

    // 法律分类筛选
    if (query.category) {
      conditions.push({ category: query.category });
    }

    // 子分类筛选
    if (query.subCategory && query.subCategory.trim()) {
      conditions.push({ subCategory: query.subCategory.trim() });
    }

    // 标签筛选
    if (query.tags && query.tags.length > 0) {
      conditions.push({ tags: { hasEvery: query.tags } });
    }

    // 关键词筛选
    if (query.keywords && query.keywords.length > 0) {
      conditions.push({ keywords: { hasSome: query.keywords } });
    }

    // 法律名称（模糊匹配）
    if (query.lawName && query.lawName.trim()) {
      conditions.push({
        lawName: { contains: query.lawName.trim(), mode: "insensitive" },
      });
    }

    // 法条编号（模糊匹配）
    if (query.articleNumber && query.articleNumber.trim()) {
      const articleNumber = query.articleNumber.trim();
      conditions.push({
        articleNumber: { contains: articleNumber, mode: "insensitive" },
      });
    }

    // 法律状态筛选
    if (query.status) {
      conditions.push({ status: query.status });
    }

    // 组合所有条件（AND关系）
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /**
   * 构建排序条件
   */
  static buildOrderByClause(
    query: SearchQuery,
  ): Prisma.LawArticleOrderByWithRelationInput[] {
    const sortConfig = query.sort || { field: "relevance", order: "desc" };

    // 如果是按相关性排序，返回空（相关性在内存中计算）
    if (sortConfig.field === "relevance") {
      return [];
    }

    return [{ [sortConfig.field]: sortConfig.order }];
  }

  /**
   * 构建分页参数
   */
  static buildPaginationParams(query: SearchQuery) {
    const page = query.pagination?.page || 1;
    const pageSize = query.pagination?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    return {
      skip,
      take: pageSize,
      page,
      pageSize,
    };
  }

  /**
   * 构建包含关系
   */
  static buildIncludeClause(query: SearchQuery): Prisma.LawArticleInclude {
    const include: Prisma.LawArticleInclude = {};

    // 如果需要包含子法条
    if (query.includeChildren) {
      include.children = true;
    }

    return include;
  }

  /**
   * 构建选择字段（优化查询性能）
   */
  static buildSelectClause(): Prisma.LawArticleSelect | null {
    // 默认返回所有字段，可以根据需要优化
    return null;
  }

  /**
   * 构建完整的查询参数
   */
  static buildQueryParams(query: SearchQuery) {
    const where = this.buildWhereClause(query);
    const orderBy = this.buildOrderByClause(query);
    const { skip, take, page, pageSize } = this.buildPaginationParams(query);
    const include = this.buildIncludeClause(query);
    const select = this.buildSelectClause();

    return {
      where,
      orderBy,
      skip,
      take,
      include,
      select,
      page,
      pageSize,
    };
  }

  /**
   * 计算分页信息
   */
  static calculatePagination(total: number, page: number, pageSize: number) {
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page,
      pageSize,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  /**
   * 验证查询参数
   */
  static validateQuery(query: SearchQuery): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 验证分页参数
    if (query.pagination) {
      if (query.pagination.page !== undefined && query.pagination.page < 1) {
        errors.push("页码必须大于0");
      }
      if (
        query.pagination.pageSize !== undefined &&
        query.pagination.pageSize < 1
      ) {
        errors.push("每页数量必须大于0");
      }
      if (
        query.pagination.pageSize !== undefined &&
        query.pagination.pageSize > 100
      ) {
        errors.push("每页数量不能超过100");
      }
    }

    // 验证最小相关性得分
    if (query.minRelevanceScore !== undefined) {
      if (query.minRelevanceScore < 0 || query.minRelevanceScore > 1) {
        errors.push("最小相关性得分必须在0-1之间");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 清理查询参数（去除空值）
   */
  static sanitizeQuery(query: SearchQuery): SearchQuery {
    const sanitized: SearchQuery = {};

    // 关键词
    if (query.keyword && query.keyword.trim()) {
      sanitized.keyword = query.keyword.trim();
    }

    // 分类
    if (query.category) {
      sanitized.category = query.category;
    }

    // 子分类
    if (query.subCategory && query.subCategory.trim()) {
      sanitized.subCategory = query.subCategory.trim();
    }

    // 标签
    if (query.tags && query.tags.length > 0) {
      sanitized.tags = query.tags
        .filter((tag) => tag.trim())
        .map((tag) => tag.trim());
    }

    // 关键词
    if (query.keywords && query.keywords.length > 0) {
      sanitized.keywords = query.keywords
        .filter((kw) => kw.trim())
        .map((kw) => kw.trim());
    }

    // 法律名称
    if (query.lawName && query.lawName.trim()) {
      sanitized.lawName = query.lawName.trim();
    }

    // 法条编号
    if (query.articleNumber && query.articleNumber.trim()) {
      sanitized.articleNumber = query.articleNumber.trim();
    }

    // 状态
    if (query.status) {
      sanitized.status = query.status;
    }

    // 分页
    if (query.pagination) {
      sanitized.pagination = {
        page: query.pagination.page || 1,
        pageSize: query.pagination.pageSize || 20,
      };
    }

    // 排序
    if (query.sort) {
      sanitized.sort = query.sort;
    }

    // 其他布尔值
    if (query.includeChildren !== undefined) {
      sanitized.includeChildren = query.includeChildren;
    }

    if (query.minRelevanceScore !== undefined) {
      sanitized.minRelevanceScore = query.minRelevanceScore;
    }

    return sanitized;
  }
}
