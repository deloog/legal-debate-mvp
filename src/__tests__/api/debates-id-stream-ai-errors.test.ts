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

describe("Debates Stream API - AI Service Error Handling", () => {
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

  describe("AI Service Error Scenarios", () => {
    it("should handle AI service returning empty content", async () => {
      // Mock AI service to return empty content
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockResolvedValue({
          choices: [
            {
              message: { content: "" },
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
        // @ts-ignore
        return await callback({
          debateRound: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({
              id: "round-1",
              debateId: "123e4567-e89b-12d3-a456-426614174000",
              roundNumber: 1,
              status: "IN_PROGRESS",
              startedAt: new Date(),
            } as any),
          },
          argument: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({} as any),
          },
          debate: {
            // @ts-ignore
            update: jest.fn().mockResolvedValue({} as any),
          },
        });
      });

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle AI service timeout", async () => {
      // Mock AI service to timeout
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest
          .fn()
          .mockImplementation(
            () =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI service timeout")), 100),
              ),
          ),
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

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle AI service complete failure", async () => {
      // Mock AI service to completely fail
      mockGetUnifiedAIService.mockRejectedValue(
        new Error("AI service unavailable"),
      );

      mockedPrisma.debate.findUnique.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "测试辩论",
        status: "active",
        case: { title: "测试案件", description: "案件描述" },
      });

      mockedPrisma.debateRound.findMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle AI service returning malformed response", async () => {
      // Mock AI service to return malformed response
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockResolvedValue({
          choices: null, // Malformed response
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
            } as any),
          },
          argument: {
            // @ts-ignore
            create: jest.fn().mockResolvedValue({} as any),
          },
          debate: {
            // @ts-ignore
            update: jest.fn().mockResolvedValue({} as any),
          },
        };
        return await callback(tx as any);
      });

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle AI service network errors", async () => {
      // Mock AI service network error
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest.fn().mockRejectedValue(new Error("Network error")),
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

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it("should handle AI service rate limiting", async () => {
      // Mock AI service rate limiting
      mockGetUnifiedAIService.mockResolvedValue({
        // @ts-ignore
        generateDebate: jest
          .fn()
          .mockRejectedValue(new Error("Rate limit exceeded")),
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

      const { GET } = await import("@/app/api/v1/debates/[id]/stream/route");

      const response = await GET(mockReq, mockContext);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });
});
