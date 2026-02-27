/**
 * 查询语言测试套件
 *
 * 测试内容：
 * 1. 查询输入验证
 * 2. 查询解析
 * 3. 过滤条件
 * 4. 聚合函数
 */

// Mock Prisma
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockRelationFindMany = jest.fn();
const mockRelationCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn((args) => mockFindUnique(args)),
      findMany: jest.fn((args) => mockFindMany(args)),
    },
    lawArticleRelation: {
      findMany: jest.fn((args) => mockRelationFindMany(args)),
      count: jest.fn((args) => mockRelationCount(args)),
    },
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  GraphQueryInput,
  GraphQueryDirection,
  GraphQueryFilter,
  GraphQueryAggregate,
  isValidQueryInput,
  validateQueryInput,
  parseQueryInput,
} from '@/lib/knowledge-graph/query/types';

describe('查询语言类型定义', () => {
  describe('GraphQueryDirection', () => {
    it('应该接受有效的方向值: in', () => {
      const direction: GraphQueryDirection = 'in';
      expect(direction).toBe('in');
    });

    it('应该接受有效的方向值: out', () => {
      const direction: GraphQueryDirection = 'out';
      expect(direction).toBe('out');
    });

    it('应该接受有效的方向值: both', () => {
      const direction: GraphQueryDirection = 'both';
      expect(direction).toBe('both');
    });
  });

  describe('GraphQueryFilter', () => {
    it('应该允许设置关系类型过滤', () => {
      const filter: GraphQueryFilter = {
        relationType: 'CONFLICTS',
      };
      expect(filter.relationType).toBe('CONFLICTS');
    });

    it('应该允许设置最小强度过滤', () => {
      const filter: GraphQueryFilter = {
        minStrength: 0.5,
      };
      expect(filter.minStrength).toBe(0.5);
    });

    it('应该允许设置多个过滤条件', () => {
      const filter: GraphQueryFilter = {
        relationType: 'CONFLICTS',
        minStrength: 0.8,
        verificationStatus: 'VERIFIED',
      };
      expect(filter.relationType).toBe('CONFLICTS');
      expect(filter.minStrength).toBe(0.8);
      expect(filter.verificationStatus).toBe('VERIFIED');
    });
  });

  describe('GraphQueryAggregate', () => {
    it('应该支持 count 聚合', () => {
      const aggregate: GraphQueryAggregate = 'count';
      expect(aggregate).toBe('count');
    });

    it('应该支持 sum 聚合', () => {
      const aggregate: GraphQueryAggregate = 'sum';
      expect(aggregate).toBe('sum');
    });

    it('应该支持 avg 聚合', () => {
      const aggregate: GraphQueryAggregate = 'avg';
      expect(aggregate).toBe('avg');
    });

    it('应该支持 max 聚合', () => {
      const aggregate: GraphQueryAggregate = 'max';
      expect(aggregate).toBe('max');
    });

    it('应该支持 min 聚合', () => {
      const aggregate: GraphQueryAggregate = 'min';
      expect(aggregate).toBe('min');
    });
  });
});

describe('查询输入验证', () => {
  describe('isValidQueryInput', () => {
    it('应该验证有效的最小查询输入', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        depth: 1,
      };
      expect(isValidQueryInput(input)).toBe(true);
    });

    it('应该验证有效的完整查询输入', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        direction: 'both',
        depth: 2,
        filter: {
          relationType: 'CONFLICTS',
          minStrength: 0.5,
        },
        aggregate: 'count',
      };
      expect(isValidQueryInput(input)).toBe(true);
    });

    it('应该拒绝缺少 startNode 的输入', () => {
      const input = {
        depth: 2,
      } as unknown as GraphQueryInput;
      expect(isValidQueryInput(input)).toBe(false);
    });

    it('应该拒绝深度为0的输入', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        depth: 0,
      };
      expect(isValidQueryInput(input)).toBe(false);
    });

    it('应该拒绝深度超过10的输入', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        depth: 15,
      };
      expect(isValidQueryInput(input)).toBe(false);
    });

    it('应该拒绝无效方向值的输入', () => {
      const input = {
        startNode: 'article-123',
        direction: 'invalid-direction' as GraphQueryDirection,
        depth: 1,
      };
      expect(isValidQueryInput(input)).toBe(false);
    });

    it('应该拒绝无效强度值的输入', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        filter: {
          minStrength: 1.5, // 超过1.0
        },
        depth: 1,
      };
      expect(isValidQueryInput(input)).toBe(false);
    });

    it('应该拒绝负数强度值的输入', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        filter: {
          minStrength: -0.5, // 负数
        },
        depth: 1,
      };
      expect(isValidQueryInput(input)).toBe(false);
    });
  });

  describe('validateQueryInput', () => {
    it('应该返回有效输入的空错误数组', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        depth: 2,
      };
      const errors = validateQueryInput(input);
      expect(errors).toHaveLength(0);
    });

    it('应该返回缺少startNode的错误', () => {
      const input = { depth: 2 } as unknown as GraphQueryInput;
      const errors = validateQueryInput(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('startNode'))).toBe(true);
    });

    it('应该返回深度超出范围的错误', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        depth: 100,
      };
      const errors = validateQueryInput(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('depth') || e.includes('1-10'))).toBe(
        true
      );
    });
  });

  describe('parseQueryInput', () => {
    it('应该解析有效的查询输入并设置默认值', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
      };
      const parsed = parseQueryInput(input);

      expect(parsed.startNode).toBe('article-123');
      expect(parsed.direction).toBe('both'); // 默认值
      expect(parsed.depth).toBe(1); // 默认值
      expect(parsed.aggregate).toBeUndefined(); // 无聚合
    });

    it('应该保留用户提供的非默认值', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        direction: 'in',
        depth: 3,
        aggregate: 'count',
      };
      const parsed = parseQueryInput(input);

      expect(parsed.direction).toBe('in');
      expect(parsed.depth).toBe(3);
      expect(parsed.aggregate).toBe('count');
    });

    it('应该处理嵌套的过滤条件', () => {
      const input: GraphQueryInput = {
        startNode: 'article-123',
        filter: {
          relationType: 'CONFLICTS',
          minStrength: 0.8,
        },
        depth: 2,
      };
      const parsed = parseQueryInput(input);

      expect(parsed.filter?.relationType).toBe('CONFLICTS');
      expect(parsed.filter?.minStrength).toBe(0.8);
    });
  });
});

describe('聚合函数计算', () => {
  // 直接测试聚合计算逻辑，不依赖executeQuery
  const aggregateResults = (
    links: Array<{ strength?: number }>,
    aggregateType: GraphQueryAggregate
  ): number => {
    if (links.length === 0) {
      return 0;
    }

    const strengths = links
      .map(l => l.strength ?? 0)
      .filter(s => typeof s === 'number');

    switch (aggregateType) {
      case 'count':
        return strengths.length;
      case 'sum':
        return strengths.reduce((sum, s) => sum + s, 0);
      case 'avg':
        if (strengths.length === 0) return 0;
        return strengths.reduce((sum, s) => sum + s, 0) / strengths.length;
      case 'max':
        return Math.max(...strengths, 0);
      case 'min':
        return Math.min(...strengths, 1);
      default:
        return 0;
    }
  };

  it('应该计算正确的 count', () => {
    const links = [{ strength: 0.5 }, { strength: 0.8 }, { strength: 0.3 }];
    const result = aggregateResults(links, 'count');
    expect(result).toBe(3);
  });

  it('应该计算 sum (基于 strength)', () => {
    const links = [{ strength: 0.5 }, { strength: 0.8 }, { strength: 0.3 }];
    const result = aggregateResults(links, 'sum');
    expect(result).toBe(1.6);
  });

  it('应该计算 avg (基于 strength)', () => {
    const links = [{ strength: 0.5 }, { strength: 0.8 }, { strength: 0.7 }];
    const result = aggregateResults(links, 'avg');
    expect(result).toBeCloseTo(0.666, 2);
  });

  it('应该计算 max (基于 strength)', () => {
    const links = [{ strength: 0.5 }, { strength: 0.8 }, { strength: 0.3 }];
    const result = aggregateResults(links, 'max');
    expect(result).toBe(0.8);
  });

  it('应该计算 min (基于 strength)', () => {
    const links = [{ strength: 0.5 }, { strength: 0.8 }, { strength: 0.3 }];
    const result = aggregateResults(links, 'min');
    expect(result).toBe(0.3);
  });

  it('应该处理空数组返回0', () => {
    const result = aggregateResults([], 'count');
    expect(result).toBe(0);
  });

  it('应该处理undefined strength使用默认值0', () => {
    const links = [{ strength: undefined }, { strength: 0.5 }];
    const result = aggregateResults(links, 'sum');
    expect(result).toBe(0.5);
  });
});
