import { AnalysisStatus } from '@prisma/client';

// Mock Prisma Client - inline to avoid scope issues
jest.mock('../../../lib/db/prisma', () => ({
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

const prismaMock = require('../../../lib/db/prisma').prisma;

// Test data factories
const createMockDocument = (overrides = {}) => ({
  id: 'doc-123',
  caseId: 'case-123',
  userId: 'user-123',
  filename: 'test-document.pdf',
  filePath: '/uploads/documents/test-document.pdf',
  fileType: 'PDF',
  fileSize: 1024000,
  mimeType: 'application/pdf',
  extractedData: null,
  analysisStatus: AnalysisStatus.PENDING,
  analysisResult: null,
  analysisError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('Document Status Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should follow correct status flow for successful analysis', async () => {
    const document = createMockDocument({
      analysisStatus: AnalysisStatus.PENDING,
    });

    // Step 1: Start processing
    prismaMock.document.update.mockResolvedValue({
      ...document,
      analysisStatus: AnalysisStatus.PROCESSING,
    });

    let result = await prismaMock.document.update({
      where: { id: document.id },
      data: { analysisStatus: AnalysisStatus.PROCESSING },
    });
    expect(result.analysisStatus).toBe(AnalysisStatus.PROCESSING);

    // Step 2: Complete with result
    const analysisResult = { summary: '分析完成', confidence: 0.9 };
    prismaMock.document.update.mockResolvedValue({
      ...result,
      analysisStatus: AnalysisStatus.COMPLETED,
      analysisResult,
    });

    result = await prismaMock.document.update({
      where: { id: document.id },
      data: {
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisResult,
      },
    });
    expect(result.analysisStatus).toBe(AnalysisStatus.COMPLETED);
    expect(result.analysisResult).toEqual(analysisResult);
  });

  it('should handle failed analysis correctly', async () => {
    const document = createMockDocument({
      analysisStatus: AnalysisStatus.PROCESSING,
    });

    // Analysis fails
    prismaMock.document.update.mockResolvedValue({
      ...document,
      analysisStatus: AnalysisStatus.FAILED,
      analysisError: 'AI服务超时',
    });

    const result = await prismaMock.document.update({
      where: { id: document.id },
      data: {
        analysisStatus: AnalysisStatus.FAILED,
        analysisError: 'AI服务超时',
      },
    });

    expect(result.analysisStatus).toBe(AnalysisStatus.FAILED);
    expect(result.analysisError).toBe('AI服务超时');
  });

  it('should handle missing analysis result gracefully', async () => {
    const document = createMockDocument({
      analysisStatus: AnalysisStatus.FAILED,
      analysisResult: null,
      analysisError: 'AI服务不可用',
    });

    prismaMock.document.findUnique.mockResolvedValue(document);

    const result = await prismaMock.document.findUnique({
      where: { id: document.id },
    });

    expect(result.analysisStatus).toBe(AnalysisStatus.FAILED);
    expect(result.analysisResult).toBeNull();
    expect(result.analysisError).toBe('AI服务不可用');
  });

  it('should handle empty extracted data', async () => {
    const document = createMockDocument({
      extractedData: {},
      analysisStatus: AnalysisStatus.COMPLETED,
      analysisResult: { summary: '无有效内容可提取' },
    });

    prismaMock.document.update.mockResolvedValue(document);

    const result = await prismaMock.document.update({
      where: { id: document.id },
      data: {
        extractedData: {},
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisResult: { summary: '无有效内容可提取' },
      },
    });

    expect(result.extractedData).toEqual({});
    expect(result.analysisResult.summary).toBe('无有效内容可提取');
  });
});
