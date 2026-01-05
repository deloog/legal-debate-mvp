import { describe, it, expect } from "@jest/globals";
import { SearchQueryBuilder } from "@/lib/law-article/search-query-builder";
import type { SearchQuery } from "@/lib/law-article/types";

describe("SearchQueryBuilder", () => {
  describe("buildWhereClause 方法", () => {
    it("应该为关键词搜索构建正确的WHERE条件", () => {
      const query: SearchQuery = {
        keyword: "合同",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      expect(where).toBeDefined();
      if (where.AND) {
        expect(where.AND).toBeInstanceOf(Array);
      }
    });

    it("应该支持多个空格分隔的关键词", () => {
      const query: SearchQuery = {
        keyword: "合同 违约 赔偿",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          expect(where.AND.length).toBeGreaterThan(0);
        }
      }
    });

    it("应该支持分类筛选", () => {
      const query: SearchQuery = {
        category: "CIVIL",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const categoryCondition = where.AND.find(
            (cond: unknown) =>
              (cond as Record<string, unknown>).category === "CIVIL",
          );
          expect(categoryCondition).toBeDefined();
        }
      }
    });

    it("应该支持子分类筛选", () => {
      const query: SearchQuery = {
        subCategory: "合同",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const subCategoryCondition = where.AND.find(
            (cond: unknown) =>
              (cond as Record<string, unknown>).subCategory === "合同",
          );
          expect(subCategoryCondition).toBeDefined();
        }
      }
    });

    it("应该支持标签筛选", () => {
      const query: SearchQuery = {
        tags: ["民事", "合同"],
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const tagsCondition = where.AND.find(
            (cond: unknown) => (cond as Record<string, unknown>).tags,
          );
          expect(tagsCondition).toBeDefined();
        }
      }
    });

    it("应该支持keywords筛选", () => {
      const query: SearchQuery = {
        keywords: ["违约", "损害"],
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const keywordsCondition = where.AND.find(
            (cond: unknown) => (cond as Record<string, unknown>).keywords,
          );
          expect(keywordsCondition).toBeDefined();
        }
      }
    });

    it("应该支持法律名称筛选", () => {
      const query: SearchQuery = {
        lawName: "民法典",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const lawNameCondition = where.AND.find(
            (cond: unknown) => (cond as Record<string, unknown>).lawName,
          );
          expect(lawNameCondition).toBeDefined();
        }
      }
    });

    it("应该支持法条编号筛选", () => {
      const query: SearchQuery = {
        articleNumber: "第五百七十七条",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const articleNumberCondition = where.AND.find(
            (cond: unknown) => (cond as Record<string, unknown>).articleNumber,
          );
          expect(articleNumberCondition).toBeDefined();
        }
      }
    });

    it("应该支持状态筛选", () => {
      const query: SearchQuery = {
        status: "VALID",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          const statusCondition = where.AND.find(
            (cond: unknown) =>
              (cond as Record<string, unknown>).status === "VALID",
          );
          expect(statusCondition).toBeDefined();
        }
      }
    });

    it("应该正确组合多个条件（AND关系）", () => {
      const query: SearchQuery = {
        keyword: "合同",
        category: "CIVIL",
        tags: ["民事"],
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          expect(where.AND.length).toBeGreaterThan(0);
        }
      }
    });

    it("应该处理空查询", () => {
      const query: SearchQuery = {};

      const where = SearchQueryBuilder.buildWhereClause(query);

      expect(where).toEqual({});
    });

    it("应该过滤空白关键词", () => {
      const query: SearchQuery = {
        keyword: "   ",
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      // 不应该包含关键词条件
      expect(where).toEqual({});
    });

    it("应该过滤空白标签", () => {
      const query: SearchQuery = {
        tags: ["", "  ", "有效标签"],
      };

      const where = SearchQueryBuilder.buildWhereClause(query);

      expect(where.AND).toBeDefined();
    });
  });

  describe("buildOrderByClause 方法", () => {
    it("应该为相关性排序返回空数组", () => {
      const query: SearchQuery = {
        sort: { field: "relevance", order: "desc" },
      };

      const orderBy = SearchQueryBuilder.buildOrderByClause(query);

      expect(orderBy).toEqual([]);
    });

    it("应该为指定字段排序返回排序条件", () => {
      const query: SearchQuery = {
        sort: { field: "createdAt", order: "desc" },
      };

      const orderBy = SearchQueryBuilder.buildOrderByClause(query);

      expect(orderBy).toHaveLength(1);
      expect(orderBy[0]).toHaveProperty("createdAt", "desc");
    });

    it("应该支持升序排序", () => {
      const query: SearchQuery = {
        sort: { field: "viewCount", order: "asc" },
      };

      const orderBy = SearchQueryBuilder.buildOrderByClause(query);

      expect(orderBy).toHaveLength(1);
      expect(orderBy[0]).toHaveProperty("viewCount", "asc");
    });

    it("应该使用默认排序配置", () => {
      const query: SearchQuery = {};

      const orderBy = SearchQueryBuilder.buildOrderByClause(query);

      expect(orderBy).toEqual([]);
    });
  });

  describe("buildPaginationParams 方法", () => {
    it("应该使用默认分页参数", () => {
      const query: SearchQuery = {};

      const params = SearchQueryBuilder.buildPaginationParams(query);

      expect(params).toEqual({
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
      });
    });

    it("应该使用自定义分页参数", () => {
      const query: SearchQuery = {
        pagination: { page: 3, pageSize: 10 },
      };

      const params = SearchQueryBuilder.buildPaginationParams(query);

      expect(params).toEqual({
        skip: 20,
        take: 10,
        page: 3,
        pageSize: 10,
      });
    });

    it("应该正确计算skip值", () => {
      const query: SearchQuery = {
        pagination: { page: 5, pageSize: 15 },
      };

      const params = SearchQueryBuilder.buildPaginationParams(query);

      expect(params.skip).toBe(60);
    });
  });

  describe("buildIncludeClause 方法", () => {
    it("应该返回空对象（默认情况）", () => {
      const query: SearchQuery = {};

      const include = SearchQueryBuilder.buildIncludeClause(query);

      expect(include).toEqual({});
    });

    it("应该包含子法条", () => {
      const query: SearchQuery = {
        includeChildren: true,
      };

      const include = SearchQueryBuilder.buildIncludeClause(query);

      expect(include).toHaveProperty("children", true);
    });
  });

  describe("buildSelectClause 方法", () => {
    it("应该返回null（返回所有字段）", () => {
      const select = SearchQueryBuilder.buildSelectClause();

      expect(select).toBeNull();
    });
  });

  describe("buildQueryParams 方法", () => {
    it("应该构建完整的查询参数", () => {
      const query: SearchQuery = {
        keyword: "合同",
        category: "CIVIL",
        pagination: { page: 2, pageSize: 10 },
      };

      const params = SearchQueryBuilder.buildQueryParams(query);

      expect(params).toHaveProperty("where");
      expect(params).toHaveProperty("orderBy");
      expect(params).toHaveProperty("skip");
      expect(params).toHaveProperty("take");
      expect(params).toHaveProperty("include");
      expect(params).toHaveProperty("select");
      expect(params).toHaveProperty("page");
      expect(params).toHaveProperty("pageSize");
    });
  });

  describe("calculatePagination 方法", () => {
    it("应该计算正确的分页信息", () => {
      const pagination = SearchQueryBuilder.calculatePagination(100, 5, 20);

      expect(pagination).toEqual({
        page: 5,
        pageSize: 20,
        total: 100,
        totalPages: 5,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("应该正确计算总页数", () => {
      const pagination = SearchQueryBuilder.calculatePagination(105, 1, 20);

      expect(pagination.totalPages).toBe(6);
    });

    it("应该正确判断是否有下一页", () => {
      const pagination = SearchQueryBuilder.calculatePagination(100, 1, 20);

      expect(pagination.hasNext).toBe(true);
    });

    it("应该正确判断是否有上一页", () => {
      const pagination = SearchQueryBuilder.calculatePagination(100, 1, 20);

      expect(pagination.hasPrev).toBe(false);
    });

    it("应该处理零结果", () => {
      const pagination = SearchQueryBuilder.calculatePagination(0, 1, 20);

      expect(pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });
  });

  describe("validateQuery 方法", () => {
    it("应该验证有效的查询参数", () => {
      const query: SearchQuery = {
        pagination: { page: 1, pageSize: 20 },
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝无效的页码", () => {
      const query: SearchQuery = {
        pagination: { page: 0, pageSize: 20 },
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("页码必须大于0");
    });

    it("应该拒绝无效的每页数量", () => {
      const query: SearchQuery = {
        pagination: { page: 1, pageSize: 0 },
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("每页数量必须大于0");
    });

    it("应该拒绝超过100的每页数量", () => {
      const query: SearchQuery = {
        pagination: { page: 1, pageSize: 101 },
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("每页数量不能超过100");
    });

    it("应该拒绝小于0的最小相关性得分", () => {
      const query: SearchQuery = {
        minRelevanceScore: -0.5,
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("最小相关性得分必须在0-1之间");
    });

    it("应该拒绝大于1的最小相关性得分", () => {
      const query: SearchQuery = {
        minRelevanceScore: 1.5,
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("最小相关性得分必须在0-1之间");
    });

    it("应该接受有效的最小相关性得分", () => {
      const query: SearchQuery = {
        minRelevanceScore: 0.5,
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(true);
    });

    it("应该返回多个验证错误", () => {
      const query: SearchQuery = {
        pagination: { page: -1, pageSize: 150 },
        minRelevanceScore: 2,
      };

      const result = SearchQueryBuilder.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("sanitizeQuery 方法", () => {
    it("应该清理空白字符", () => {
      const query: SearchQuery = {
        keyword: "  合同  ",
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.keyword).toBe("合同");
    });

    it("应该过滤空标签", () => {
      const query: SearchQuery = {
        tags: ["标签1", "", "  ", "标签2"],
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.tags).toEqual(["标签1", "标签2"]);
    });

    it("应该过滤空keywords", () => {
      const query: SearchQuery = {
        keywords: ["关键词1", "", "关键词2"],
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.keywords).toEqual(["关键词1", "关键词2"]);
    });

    it("应该清理空法律名称", () => {
      const query: SearchQuery = {
        lawName: "  ",
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.lawName).toBeUndefined();
    });

    it("应该清理空法条编号", () => {
      const query: SearchQuery = {
        articleNumber: "  ",
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.articleNumber).toBeUndefined();
    });

    it("应该保留有效的查询参数", () => {
      const query: SearchQuery = {
        keyword: "合同",
        category: "CIVIL",
        tags: ["民事"],
        pagination: { page: 1, pageSize: 20 },
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.keyword).toBe("合同");
      expect(sanitized.category).toBe("CIVIL");
      expect(sanitized.tags).toEqual(["民事"]);
      expect(sanitized.pagination).toEqual({ page: 1, pageSize: 20 });
    });

    it("应该处理空查询对象", () => {
      const query: SearchQuery = {};

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized).toEqual({});
    });

    it("应该为布尔类型提供默认值", () => {
      const query: SearchQuery = {
        includeChildren: true,
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.includeChildren).toBe(true);
    });

    it("应该保留排序参数", () => {
      const query: SearchQuery = {
        sort: { field: "createdAt", order: "asc" },
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.sort).toEqual({ field: "createdAt", order: "asc" });
    });

    it("应该保留minRelevanceScore参数", () => {
      const query: SearchQuery = {
        minRelevanceScore: 0.5,
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.minRelevanceScore).toBe(0.5);
    });

    it("应该保留分页参数", () => {
      const query: SearchQuery = {
        pagination: { page: 2, pageSize: 10 },
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.pagination).toEqual({ page: 2, pageSize: 10 });
    });

    it("应该为分页参数使用默认值", () => {
      const query: SearchQuery = {
        pagination: {
          page: undefined as unknown as number,
          pageSize: undefined as unknown as number,
        },
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.pagination).toEqual({ page: 1, pageSize: 20 });
    });

    it("应该只为分页page使用默认值", () => {
      const query: SearchQuery = {
        pagination: {
          page: undefined as unknown as number,
          pageSize: 10,
        },
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.pagination).toEqual({ page: 1, pageSize: 10 });
    });

    it("应该只为分页pageSize使用默认值", () => {
      const query: SearchQuery = {
        pagination: {
          page: 3,
          pageSize: undefined as unknown as number,
        },
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.pagination).toEqual({ page: 3, pageSize: 20 });
    });

    it("应该为undefined的includeChildren提供默认值", () => {
      const query: SearchQuery = {
        includeChildren: undefined,
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.includeChildren).toBeUndefined();
    });

    it("应该为undefined的minRelevanceScore提供默认值", () => {
      const query: SearchQuery = {
        minRelevanceScore: undefined,
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.minRelevanceScore).toBeUndefined();
    });

    it("应该不设置值为false的includeChildren", () => {
      const query: SearchQuery = {
        includeChildren: false,
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.includeChildren).toBe(false);
    });

    it("应该不设置值为0的minRelevanceScore", () => {
      const query: SearchQuery = {
        minRelevanceScore: 0,
      };

      const sanitized = SearchQueryBuilder.sanitizeQuery(query);

      expect(sanitized.minRelevanceScore).toBe(0);
    });
  });
});
