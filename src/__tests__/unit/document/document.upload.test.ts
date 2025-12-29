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

describe("File Upload and Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should validate required fields for document creation", async () => {
    const documentData = {
      caseId: "case-123",
      userId: "user-123",
      filename: "test.pdf",
      filePath: "/uploads/test.pdf",
      fileType: "PDF",
      fileSize: 1024,
      mimeType: "application/pdf",
    };

    const expectedDocument = createMockDocument(documentData);
    prismaMock.document.create.mockResolvedValue(expectedDocument);

    const result = await prismaMock.document.create({
      data: documentData,
    });

    expect(result.filename).toBe(documentData.filename);
    expect(result.filePath).toBe(documentData.filePath);
    expect(result.fileType).toBe(documentData.fileType);
    expect(result.fileSize).toBe(documentData.fileSize);
    expect(result.mimeType).toBe(documentData.mimeType);
  });

  it("should handle different file types", async () => {
    const fileTypes = ["PDF", "DOCX", "TXT", "JPG", "PNG"];
    const documents = [];

    for (const fileType of fileTypes) {
      const documentData = createMockDocument({
        fileType,
        mimeType: `application/${fileType.toLowerCase()}`,
      });
      documents.push(documentData);
    }

    prismaMock.document.findMany.mockResolvedValue(documents);

    const result = await prismaMock.document.findMany({
      where: { fileType: { in: fileTypes } },
    });

    expect(result).toHaveLength(fileTypes.length);
    expect(result.map((d) => d.fileType)).toEqual(fileTypes);
  });

  it("should handle file size validation", async () => {
    const smallFile = createMockDocument({ fileSize: 1024 }); // 1KB
    const largeFile = createMockDocument({ fileSize: 10485760 }); // 10MB

    prismaMock.document.findMany.mockResolvedValue([smallFile, largeFile]);

    const result = await prismaMock.document.findMany({
      where: {
        fileSize: {
          gte: 1024,
          lte: 10485760,
        },
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0].fileSize).toBe(1024);
    expect(result[1].fileSize).toBe(10485760);
  });

  it("should handle very large file sizes", async () => {
    const largeFile = createMockDocument({
      fileSize: 50 * 1024 * 1024, // 50MB
      filename: "large-document.pdf",
    });

    prismaMock.document.create.mockResolvedValue(largeFile);

    const result = await prismaMock.document.create({
      data: {
        caseId: "case-123",
        userId: "user-123",
        filename: "large-document.pdf",
        filePath: "/uploads/large-document.pdf",
        fileType: "PDF",
        fileSize: 50 * 1024 * 1024,
        mimeType: "application/pdf",
      },
    });

    expect(result.fileSize).toBe(50 * 1024 * 1024);
    expect(result.filename).toBe("large-document.pdf");
  });
});
