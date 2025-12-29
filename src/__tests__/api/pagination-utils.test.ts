import {
  createCursor,
  parseCursor,
  buildCursorOptions,
  estimateTotalCount,
  createPaginationLinks,
  calculatePaginationStats,
} from "@/app/api/lib/responses/pagination-utils";

describe("Pagination Utils", () => {
  describe("createCursor", () => {
    interface TestItem {
      id: string;
      name: string;
      created: Date;
    }

    const testItems: TestItem[] = [
      { id: "1", name: "Item 1", created: new Date("2023-01-01") },
      { id: "2", name: "Item 2", created: new Date("2023-01-02") },
      { id: "3", name: "Item 3", created: new Date("2023-01-03") },
      { id: "4", name: "Item 4", created: new Date("2023-01-04") },
      { id: "5", name: "Item 5", created: new Date("2023-01-05") },
    ];

    it("should return all items when length <= limit", () => {
      const limit = 5;
      const result = createCursor(testItems, "id", limit);

      expect(result.data).toEqual(testItems);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should return limited items with cursor when more data exists", () => {
      const limit = 3;
      const result = createCursor(testItems, "id", limit);

      expect(result.data).toEqual(testItems.slice(0, limit));
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();

      // 验证游标包含正确的信息
      const parsed = JSON.parse(
        Buffer.from(result.nextCursor!, "base64").toString(),
      );
      expect(parsed).toEqual({ id: "4" });
    });

    it("should work with different key types", () => {
      const limit = 2;
      const result = createCursor(testItems, "created", limit);

      expect(result.data).toEqual(testItems.slice(0, limit));
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();

      const parsed = JSON.parse(
        Buffer.from(result.nextCursor!, "base64").toString(),
      );
      expect(parsed).toEqual({ created: testItems[2].created.toISOString() });
    });

    it("should handle empty array", () => {
      const result = createCursor([], "id", 10);

      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle single item with limit 1", () => {
      const singleItem = [testItems[0]];
      const result = createCursor(singleItem, "id", 1);

      expect(result.data).toEqual(singleItem);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle limit of 0", () => {
      const result = createCursor(testItems, "id", 0);

      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeUndefined(); // 修复：limit为0时不应该有nextCursor
    });

    it("should handle negative limit", () => {
      const result = createCursor(testItems, "id", -1);

      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeUndefined(); // 修复：负数limit时不应该有nextCursor
    });
  });

  describe("parseCursor", () => {
    it("should parse valid cursor", () => {
      const cursorData = { id: "123", created: "2023-01-01" };
      const cursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");

      const result = parseCursor(cursor);

      expect(result).toEqual(cursorData);
    });

    it("should return null for empty string", () => {
      const result = parseCursor("");
      expect(result).toBeNull();
    });

    it("should return null for undefined", () => {
      const result = parseCursor(undefined);
      expect(result).toBeNull();
    });

    it("should return null for invalid base64", () => {
      const result = parseCursor("invalid-base64");
      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", () => {
      const invalidJson = Buffer.from("invalid-json").toString("base64");
      const result = parseCursor(invalidJson);
      expect(result).toBeNull();
    });

    it("should handle empty object cursor", () => {
      const cursor = Buffer.from(JSON.stringify({})).toString("base64");
      const result = parseCursor(cursor);
      expect(result).toEqual({});
    });

    it("should handle complex nested cursor data", () => {
      const complexData = {
        id: "123",
        timestamp: "2023-01-01T00:00:00Z",
        filters: { type: "user", status: "active" },
        sort: { field: "created", direction: "desc" },
      };
      const cursor = Buffer.from(JSON.stringify(complexData)).toString(
        "base64",
      );

      const result = parseCursor(cursor);

      expect(result).toEqual(complexData);
    });
  });

  describe("buildCursorOptions", () => {
    it("should build options without cursor", () => {
      const result = buildCursorOptions(undefined, 20);

      expect(result.cursor).toBeNull();
      expect(result.take).toBe(21); // limit + 1
    });

    it("should build options with cursor", () => {
      const cursor = Buffer.from(JSON.stringify({ id: "123" })).toString(
        "base64",
      );
      const result = buildCursorOptions(cursor, 10);

      expect(result.cursor).toEqual({ id: "123" });
      expect(result.take).toBe(11); // limit + 1
    });

    it("should use default limit when not provided", () => {
      const result = buildCursorOptions(undefined);

      expect(result.take).toBe(21); // 20 + 1
    });

    it("should handle invalid cursor", () => {
      const result = buildCursorOptions("invalid-cursor", 5);

      expect(result.cursor).toBeNull();
      expect(result.take).toBe(6); // limit + 1
    });

    it("should handle zero limit", () => {
      const result = buildCursorOptions(undefined, 0);

      expect(result.take).toBe(1); // 0 + 1
    });

    it("should handle negative limit", () => {
      const result = buildCursorOptions(undefined, -5);

      expect(result.take).toBe(-4); // -5 + 1
    });
  });

  describe("estimateTotalCount", () => {
    it("should return provided total count", async () => {
      const countFunction = jest.fn().mockResolvedValue(100);
      const result = await estimateTotalCount(countFunction, 50);

      expect(result).toBe(50);
      expect(countFunction).not.toHaveBeenCalled();
    });

    it("should call count function when total not provided", async () => {
      const countFunction = jest.fn().mockResolvedValue(100);
      const result = await estimateTotalCount(countFunction);

      expect(result).toBe(100);
      expect(countFunction).toHaveBeenCalledTimes(1);
    });

    it("should handle zero total count", async () => {
      const countFunction = jest.fn().mockResolvedValue(0);
      const result = await estimateTotalCount(countFunction, 0);

      expect(result).toBe(0);
      expect(countFunction).not.toHaveBeenCalled();
    });

    it("should handle count function error", async () => {
      const countFunction = jest
        .fn()
        .mockRejectedValue(new Error("Database error"));

      await expect(estimateTotalCount(countFunction)).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle count function returning null", async () => {
      const countFunction = jest.fn().mockResolvedValue(null);
      const result = await estimateTotalCount(countFunction);

      expect(result).toBeNull();
    });
  });

  describe("createPaginationLinks", () => {
    const baseUrl = "https://api.example.com/items";

    it("should create complete pagination links", () => {
      const pagination = {
        page: 2,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      };

      const result = createPaginationLinks(baseUrl, pagination);

      expect(result.first).toBe(`${baseUrl}?page=1`);
      expect(result.prev).toBe(`${baseUrl}?page=1`);
      expect(result.next).toBe(`${baseUrl}?page=3`);
      expect(result.last).toBe(`${baseUrl}?page=5`);
    });

    it("should handle first page", () => {
      const pagination = {
        page: 1,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      };

      const result = createPaginationLinks(baseUrl, pagination);

      expect(result.first).toBe(`${baseUrl}?page=1`);
      expect(result.prev).toBeNull();
      expect(result.next).toBe(`${baseUrl}?page=2`);
      expect(result.last).toBe(`${baseUrl}?page=3`);
    });

    it("should handle last page", () => {
      const pagination = {
        page: 3,
        totalPages: 3,
        hasNext: false,
        hasPrev: true,
      };

      const result = createPaginationLinks(baseUrl, pagination);

      expect(result.first).toBe(`${baseUrl}?page=1`);
      expect(result.prev).toBe(`${baseUrl}?page=2`);
      expect(result.next).toBeNull();
      expect(result.last).toBe(`${baseUrl}?page=3`);
    });

    it("should include query parameters", () => {
      const pagination = {
        page: 2,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      };
      const queryParams = { sort: "name", filter: "active" };

      const result = createPaginationLinks(baseUrl, pagination, queryParams);

      expect(result.first).toBe(`${baseUrl}?page=1&sort=name&filter=active`);
      expect(result.prev).toBe(`${baseUrl}?page=1&sort=name&filter=active`);
      expect(result.next).toBe(`${baseUrl}?page=3&sort=name&filter=active`);
      expect(result.last).toBe(`${baseUrl}?page=5&sort=name&filter=active`);
    });

    it("should handle single page", () => {
      const pagination = {
        page: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      const result = createPaginationLinks(baseUrl, pagination);

      expect(result.first).toBe(`${baseUrl}?page=1`);
      expect(result.prev).toBeNull();
      expect(result.next).toBeNull();
      expect(result.last).toBe(`${baseUrl}?page=1`);
    });

    it("should handle empty query parameters", () => {
      const pagination = {
        page: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      const result = createPaginationLinks(baseUrl, pagination, {});

      expect(result.first).toBe(`${baseUrl}?page=1`);
    });

    it("should handle special characters in query parameters", () => {
      const pagination = {
        page: 1,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      };
      const queryParams = { search: "test & demo", category: "测试" };

      const result = createPaginationLinks(baseUrl, pagination, queryParams);

      expect(result.first).toContain("search=test%20%26%20demo");
      expect(result.first).toContain("category=%E6%B5%8B%E8%AF%95");
    });
  });

  describe("calculatePaginationStats", () => {
    it("should calculate basic pagination stats", () => {
      const result = calculatePaginationStats(2, 10, 50);

      expect(result.currentPage).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalItems).toBe(50);
      expect(result.totalPages).toBe(5);
      expect(result.itemsFrom).toBe(11);
      expect(result.itemsTo).toBe(20);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
    });

    it("should handle first page", () => {
      const result = calculatePaginationStats(1, 10, 25);

      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(3);
      expect(result.itemsFrom).toBe(1);
      expect(result.itemsTo).toBe(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("should handle last page", () => {
      const result = calculatePaginationStats(3, 10, 25);

      expect(result.currentPage).toBe(3);
      expect(result.totalPages).toBe(3);
      expect(result.itemsFrom).toBe(21);
      expect(result.itemsTo).toBe(25);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(true);
    });

    it("should handle single page", () => {
      const result = calculatePaginationStats(1, 10, 5);

      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.itemsFrom).toBe(1);
      expect(result.itemsTo).toBe(5);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("should handle empty result set", () => {
      const result = calculatePaginationStats(1, 10, 0);

      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(0);
      expect(result.itemsFrom).toBe(1);
      expect(result.itemsTo).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("should handle large page sizes", () => {
      const result = calculatePaginationStats(1, 100, 1000);

      expect(result.totalPages).toBe(10);
      expect(result.itemsFrom).toBe(1);
      expect(result.itemsTo).toBe(100);
    });

    it("should handle page larger than total pages", () => {
      const result = calculatePaginationStats(10, 10, 50);

      expect(result.currentPage).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.itemsFrom).toBe(91);
      expect(result.itemsTo).toBe(50); // Cap at total
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(true);
    });

    it("should handle page size of 1", () => {
      const result = calculatePaginationStats(3, 1, 5);

      expect(result.totalPages).toBe(5);
      expect(result.itemsFrom).toBe(3);
      expect(result.itemsTo).toBe(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(true);
    });

    it("should handle exact division", () => {
      const result = calculatePaginationStats(2, 10, 20);

      expect(result.totalPages).toBe(2);
      expect(result.itemsFrom).toBe(11);
      expect(result.itemsTo).toBe(20);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(true);
    });
  });
});
