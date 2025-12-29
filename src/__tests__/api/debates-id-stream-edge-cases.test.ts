import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
/// <reference path="./test-types.d.ts" />

// Mock Prisma
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    debate: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    debateRound: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    argument: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock AI service
const mockGetUnifiedAIService = jest.fn() as any;

jest.mock("@/lib/ai/unified-service", () => ({
  getUnifiedAIService: mockGetUnifiedAIService,
}));

import { prisma } from "@/lib/db/prisma";

describe("Debates Stream API - Edge Cases", () => {
  let mockReq: any;
  let mockContext: any;
  let mockedPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma as any;

    // 创建模拟的NextRequest对象
    mockReq = {
      url: "http://localhost:3000/api/v1/debates/123e4567-e89b-12d3-a456-426614174000/stream",
      headers: new Headers(),
      signal: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        aborted: false,
      },
    } as any;

    // 创建模拟的context对象
    mockContext = {
      params: {
        id: "123e4567-e89b-12d3-a456-426614174000",
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Stream Processing Edge Cases", () => {
    it("should handle large data stream processing", async () => {
      // Mock large AI response
      const largeContent =
        "原告：" +
        "大量论点内容。".repeat(1000) +
        "被告：" +
        "大量反驳内容。".repeat(1000);

      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockResolvedValue({
          choices: [
            {
              message: { content: largeContent },
            },
          ],
        }),
      });

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 0,
        debateConfig: { maxRounds: 1 },
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);
      mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx: any = {
          debateRound: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({
              id: "round-1",
              debateId: "123e4567-e89b-12d3-a456-426614174000",
              roundNumber: 1,
              status: "IN_PROGRESS",
              startedAt: new Date(),
            }),
          },
          argument: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({}),
          },
          debate: {
            // @ts-ignore
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle stream with special characters", async () => {
      // Mock content with special characters
      const specialContent =
        "原告：特殊字符测试 🚀🔥🎯！被告：反驳论点 @#$%^&*()";

      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockResolvedValue({
          choices: [
            {
              message: { content: specialContent },
            },
          ],
        }),
      });

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 0,
        debateConfig: { maxRounds: 1 },
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);
      mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx: any = {
          debateRound: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({
              id: "round-1",
              debateId: "123e4567-e89b-12d3-a456-426614174000",
              roundNumber: 1,
              status: "IN_PROGRESS",
              startedAt: new Date(),
            }),
          },
          argument: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({}),
          },
          debate: {
            // @ts-ignore
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle debate with maximum rounds reached", async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 3, // 已经达到最大轮次
        debateConfig: { maxRounds: 3 },
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 3, arguments: 10 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle debate with no rounds configuration", async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 0,
        debateConfig: {}, // 没有配置最大轮次
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle debate with zero max rounds", async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 0,
        debateConfig: { maxRounds: 0 }, // 最大轮次为0
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe("Client Disconnection Scenarios", () => {
    it("should handle client disconnection during round processing", async () => {
      const mockAbortController = new AbortController();
      mockReq.signal = mockAbortController.signal;

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 0,
        debateConfig: { maxRounds: 2 },
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);

      // 模拟客户端在流处理过程中断开连接
      setTimeout(() => {
        mockAbortController.abort();
      }, 100);
    });

    it("should handle client disconnection immediately after connection", async () => {
      const mockAbortController = new AbortController();
      mockReq.signal = mockAbortController.signal;

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        case: { title: "测试案件", description: "案件描述" },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      // 立即断开连接
      mockAbortController.abort();

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle multiple rapid disconnections", async () => {
      const mockAbortController = new AbortController();
      mockReq.signal = mockAbortController.signal;

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        currentRound: 0,
        debateConfig: { maxRounds: 1 },
        case: { title: "测试案件", description: "案件描述" },
        rounds: [],
        _count: { rounds: 0, arguments: 0 },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);

      // 模拟多次快速断开连接
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          mockAbortController.abort();
        }, i * 50);
      }
    });
  });
});
