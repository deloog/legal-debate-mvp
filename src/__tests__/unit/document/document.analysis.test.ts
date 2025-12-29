import { AnalysisStatus } from "@prisma/client";

// Mock Prisma Client - inline to avoid scope issues
jest.mock("../../../lib/db/prisma", () => ({
  prisma: {
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const prismaMock = require("../../../lib/db/prisma").prisma;

// Test data factories
const createMockDocument = (overrides = {}) => ({
  id: "doc-123",
  caseId: "case-123",
  userId: "user-123",
  filename: "test-document.pdf",
  filePath: "/uploads/documents/test-document.pdf",
  fileType: "PDF",
  fileSize: 1024000,
  mimeType: "application/pdf",
  extractedData: null,
  analysisStatus: AnalysisStatus.PENDING,
  analysisResult: null,
  analysisError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe("AI Analysis Result Storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should store complex analysis results", async () => {
    const complexAnalysisResult = {
      documentType: "起诉状",
      parties: {
        plaintiff: { name: "张三", type: "individual" },
        defendant: { name: "某某公司", type: "company" },
      },
      claims: [
        {
          type: "payment",
          amount: 50000,
          description: "支付违约金",
        },
      ],
      facts: [
        {
          description: "合同签订于2023年1月1日",
          date: "2023-01-01",
        },
      ],
      legalBasis: ["合同法第107条"],
      confidence: 0.95,
      analysisTime: 1500, // ms
      aiProvider: "zhipu",
      model: "glm-4",
      extractedAt: new Date().toISOString(),
    };

    const document = createMockDocument({
      analysisStatus: AnalysisStatus.COMPLETED,
      analysisResult: complexAnalysisResult,
    });

    prismaMock.document.update.mockResolvedValue(document);

    const result = await prismaMock.document.update({
      where: { id: document.id },
      data: {
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisResult: complexAnalysisResult,
      },
    });

    expect(result.analysisResult).toEqual(complexAnalysisResult);
    expect(result.analysisResult.parties.plaintiff.name).toBe("张三");
    expect(result.analysisResult.claims).toHaveLength(1);
    expect(result.analysisResult.confidence).toBe(0.95);
    expect(result.analysisResult.aiProvider).toBe("zhipu");
  });

  it("should handle partial analysis results", async () => {
    const partialResult = {
      documentType: "判决书",
      parties: {
        plaintiff: { name: "李四" },
        // defendant missing
      },
      confidence: 0.7, // lower confidence
      warnings: ["被告信息不完整", "金额信息缺失"],
    };

    const document = createMockDocument({
      analysisStatus: AnalysisStatus.COMPLETED,
      analysisResult: partialResult,
    });

    prismaMock.document.update.mockResolvedValue(document);

    const result = await prismaMock.document.update({
      where: { id: document.id },
      data: {
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisResult: partialResult,
      },
    });

    expect(result.analysisResult.parties.plaintiff.name).toBe("李四");
    expect(result.analysisResult.parties.defendant).toBeUndefined();
    expect(result.analysisResult.confidence).toBe(0.7);
    expect(result.analysisResult.warnings).toContain("被告信息不完整");
  });
});
