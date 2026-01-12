import {
  PaginationMeta,
  PaginationQuery,
  PaginatedResult,
  buildPaginationOptions,
  buildSearchOptions,
  calculateOffset,
  validatePaginationParams,
} from '@/app/api/lib/responses/pagination-core';

describe('Pagination Core', () => {
  describe('buildPaginationOptions', () => {
    it('should build basic pagination options', () => {
      const query: PaginationQuery = {
        page: 2,
        limit: 10,
        order: 'asc',
      };

      const result = buildPaginationOptions(query);

      expect(result).toEqual({
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should build options with sort field', () => {
      const query: PaginationQuery = {
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'desc',
      };

      const result = buildPaginationOptions(query);

      expect(result).toEqual({
        skip: 0,
        take: 20,
        orderBy: { name: 'desc' },
      });
    });

    it('should handle first page', () => {
      const query: PaginationQuery = {
        page: 1,
        limit: 15,
        order: 'asc',
      };

      const result = buildPaginationOptions(query);

      expect(result.skip).toBe(0);
      expect(result.take).toBe(15);
      expect(result.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('should handle large page numbers', () => {
      const query: PaginationQuery = {
        page: 100,
        limit: 50,
        order: 'desc',
      };

      const result = buildPaginationOptions(query);

      expect(result.skip).toBe(4950); // (100-1) * 50
      expect(result.take).toBe(50);
      expect(result.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('should handle different sort fields with orders', () => {
      const testCases = [
        { sort: 'id', order: 'asc' as const, expected: { id: 'asc' } },
        { sort: 'title', order: 'desc' as const, expected: { title: 'desc' } },
        {
          sort: 'created',
          order: 'asc' as const,
          expected: { created: 'asc' },
        },
      ];

      testCases.forEach(({ sort, order, expected }) => {
        const query: PaginationQuery = { page: 1, limit: 10, sort, order };
        const result = buildPaginationOptions(query);
        expect(result.orderBy).toEqual(expected);
      });
    });
  });

  describe('buildSearchOptions', () => {
    it('should build search options with search term', () => {
      const query = {
        page: 1,
        limit: 10,
        order: 'desc' as const,
        search: 'test',
      };

      const result = buildSearchOptions(query);

      expect(result).toEqual({
        where: {
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should build options without search term', () => {
      const query = {
        page: 2,
        limit: 20,
        order: 'asc' as const,
      };

      const result = buildSearchOptions(query);

      expect(result).toEqual({
        where: {},
        skip: 20,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should build search options with sort', () => {
      const query = {
        page: 1,
        limit: 15,
        sort: 'name',
        order: 'desc' as const,
        search: 'keyword',
      };

      const result = buildSearchOptions(query);

      expect(result.where).toEqual({
        OR: [
          { title: { contains: 'keyword', mode: 'insensitive' } },
          { description: { contains: 'keyword', mode: 'insensitive' } },
        ],
      });
      expect(result.orderBy).toEqual({ name: 'desc' });
    });

    it('should handle empty search string', () => {
      const query = {
        page: 1,
        limit: 10,
        order: 'desc' as const,
        search: '',
      };

      const result = buildSearchOptions(query);

      expect(result.where).toEqual({});
    });

    it('should handle special characters in search', () => {
      const query = {
        page: 1,
        limit: 10,
        order: 'desc' as const,
        search: 'test & demo',
      };

      const result = buildSearchOptions(query);

      expect(result.where.OR).toHaveLength(2);
      expect(result.where.OR[0]).toEqual({
        title: { contains: 'test & demo', mode: 'insensitive' },
      });
    });

    it('should handle unicode characters in search', () => {
      const query = {
        page: 1,
        limit: 10,
        order: 'desc' as const,
        search: '测试',
      };

      const result = buildSearchOptions(query);

      expect(result.where.OR).toHaveLength(2);
      expect(result.where.OR[0]).toEqual({
        title: { contains: '测试', mode: 'insensitive' },
      });
    });
  });

  describe('calculateOffset', () => {
    it('should calculate offset correctly', () => {
      expect(calculateOffset(1, 10)).toBe(0);
      expect(calculateOffset(2, 10)).toBe(10);
      expect(calculateOffset(3, 20)).toBe(40);
      expect(calculateOffset(5, 25)).toBe(100);
    });

    it('should handle page 1', () => {
      expect(calculateOffset(1, 1)).toBe(0);
      expect(calculateOffset(1, 50)).toBe(0);
      expect(calculateOffset(1, 100)).toBe(0);
    });

    it('should handle large numbers', () => {
      expect(calculateOffset(1000, 10)).toBe(9990);
      expect(calculateOffset(10000, 100)).toBe(999900);
    });

    it('should handle limit of 0', () => {
      expect(calculateOffset(5, 0)).toBe(0);
      expect(calculateOffset(100, 0)).toBe(0);
    });

    it('should handle negative limit', () => {
      expect(calculateOffset(5, -10)).toBe(-40);
      expect(calculateOffset(2, -5)).toBe(-5);
    });

    it('should handle page 0', () => {
      expect(calculateOffset(0, 10)).toBe(-10);
      expect(calculateOffset(0, 20)).toBe(-20);
    });

    it('should handle negative page', () => {
      expect(calculateOffset(-1, 10)).toBe(-20);
      expect(calculateOffset(-5, 20)).toBe(-120);
    });
  });

  describe('validatePaginationParams', () => {
    it('should validate valid parameters', () => {
      const params = {
        page: 2,
        limit: 15,
        sort: 'name',
        order: 'asc',
      };

      const result = validatePaginationParams(params);

      expect(result).toEqual({
        page: 2,
        limit: 15,
        sort: 'name',
        order: 'asc',
      });
    });

    it('should use default values', () => {
      const params = {};

      const result = validatePaginationParams(params);

      expect(result).toEqual({
        page: 1,
        limit: 20,
        sort: undefined,
        order: 'desc',
      });
    });

    it('should handle string numbers', () => {
      const params = {
        page: '3',
        limit: '25',
        order: 'asc',
      };

      const result = validatePaginationParams(params);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(result.order).toBe('asc');
    });

    it('should handle invalid numbers with defaults', () => {
      const params = {
        page: 'invalid',
        limit: 'invalid',
        order: 'asc',
      };

      const result = validatePaginationParams(params);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.order).toBe('asc');
    });

    it('should handle zero values', () => {
      const params = {
        page: 0,
        limit: 0,
      };

      expect(() => validatePaginationParams(params)).toThrow(
        'Page must be greater than 0'
      );
    });

    it('should handle negative page', () => {
      const params = {
        page: -1,
        limit: 10,
      };

      expect(() => validatePaginationParams(params)).toThrow(
        'Page must be greater than 0'
      );
    });

    it('should handle limit too small', () => {
      const params = {
        page: 1,
        limit: 0,
      };

      expect(() => validatePaginationParams(params)).toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should handle negative limit', () => {
      const params = {
        page: 1,
        limit: -5,
      };

      expect(() => validatePaginationParams(params)).toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should handle limit too large', () => {
      const params = {
        page: 1,
        limit: 101,
      };

      expect(() => validatePaginationParams(params)).toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should handle boundary values', () => {
      const validCases = [
        { page: 1, limit: 1 },
        { page: 1, limit: 100 },
        { page: 1000, limit: 1 },
        { page: 1000, limit: 100 },
      ];

      validCases.forEach(params => {
        expect(() => validatePaginationParams(params)).not.toThrow();
      });
    });

    it('should handle decimal numbers', () => {
      const params = {
        page: 2.5,
        limit: 15.7,
      };

      const result = validatePaginationParams(params);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
    });

    it('should handle null and undefined values', () => {
      const params = {
        page: null,
        limit: undefined,
        sort: 'name',
        order: 'asc',
      };

      const result = validatePaginationParams(params);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sort).toBe('name');
      expect(result.order).toBe('asc');
    });

    it('should validate order parameter', () => {
      const params1 = { page: 1, limit: 10, order: 'asc' };
      const result1 = validatePaginationParams(params1);
      expect(result1.order).toBe('asc');

      const params2 = { page: 1, limit: 10, order: 'desc' };
      const result2 = validatePaginationParams(params2);
      expect(result2.order).toBe('desc');

      const params3 = { page: 1, limit: 10, order: 'invalid' };
      const result3 = validatePaginationParams(params3);
      expect(result3.order).toBe('desc'); // should default to 'desc'
    });

    it('should handle boolean values', () => {
      const params = {
        page: true,
        limit: false,
        order: 'asc',
      };

      const result = validatePaginationParams(params);

      expect(result.page).toBe(1); // true converts to 1
      expect(result.limit).toBe(20); // false converts to 0, but defaults to 20
      expect(result.order).toBe('asc');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for interfaces', () => {
      const meta: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      };

      expect(meta.page).toBe(1);
      expect(meta.totalPages).toBe(10);
    });

    it('should maintain type safety for query', () => {
      const query: PaginationQuery = {
        page: 1,
        limit: 20,
        sort: 'name',
        order: 'asc',
      };

      expect(query.order).toBe('asc');
    });

    it('should maintain type safety for result', () => {
      const result: PaginatedResult<{ id: string }> = {
        data: [{ id: '1' }, { id: '2' }],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete pagination flow', () => {
      const rawParams = {
        page: '2',
        limit: '15',
        sort: 'name',
        order: 'asc',
        search: 'test',
      };

      // Validate parameters
      const validatedParams = validatePaginationParams(rawParams);
      expect(validatedParams.page).toBe(2);
      expect(validatedParams.limit).toBe(15);

      // Build search options
      const searchOptions = buildSearchOptions({
        ...validatedParams,
        search: 'test',
      });
      expect(searchOptions.skip).toBe(15); // (2-1) * 15
      expect(searchOptions.take).toBe(15);
      expect(searchOptions.orderBy).toEqual({ name: 'asc' });
      expect(searchOptions.where.OR).toBeDefined();

      // Calculate offset
      const offset = calculateOffset(
        validatedParams.page,
        validatedParams.limit
      );
      expect(offset).toBe(15);
    });

    it('should handle edge case with no sort and search', () => {
      const params = {
        page: 1,
        limit: 10,
      };

      const validated = validatePaginationParams(params);
      const options = buildSearchOptions({ ...validated });

      expect(options.orderBy).toEqual({ createdAt: 'desc' });
      expect(options.where).toEqual({});
    });
  });
});
