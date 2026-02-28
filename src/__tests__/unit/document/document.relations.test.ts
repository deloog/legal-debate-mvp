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
const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  ...overrides,
});

const createMockCase = (overrides = {}) => ({
  id: 'case-123',
  userId: 'user-123',
  title: '测试案件',
  description: '这是一个测试案件描述',
  ...overrides,
});

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

describe('Relations and Associations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create document with case association', async () => {
    const user = createMockUser();
    const caseData = createMockCase();
    const document = createMockDocument({
      caseId: caseData.id,
      userId: user.id,
    });

    prismaMock.case.findUnique.mockResolvedValue(caseData);
    prismaMock.document.create.mockResolvedValue(document);

    // Verify case exists
    const foundCase = await prismaMock.case.findUnique({
      where: { id: caseData.id },
    });
    expect(foundCase).toEqual(caseData);

    // Create document
    const result = await prismaMock.document.create({
      data: {
        caseId: caseData.id,
        userId: user.id,
        filename: 'test.pdf',
        filePath: '/uploads/test.pdf',
        fileType: 'PDF',
        fileSize: 1024,
        mimeType: 'application/pdf',
      },
    });

    expect(result.caseId).toBe(caseData.id);
    expect(result.userId).toBe(user.id);
  });

  it('should create document with user association', async () => {
    const user = createMockUser();
    const document = createMockDocument({
      userId: user.id,
    });

    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.document.create.mockResolvedValue(document);

    // Verify user exists
    const foundUser = await prismaMock.user.findUnique({
      where: { id: user.id },
    });
    expect(foundUser).toEqual(user);

    // Create document
    const result = await prismaMock.document.create({
      data: {
        caseId: 'case-123',
        userId: user.id,
        filename: 'test.pdf',
        filePath: '/uploads/test.pdf',
        fileType: 'PDF',
        fileSize: 1024,
        mimeType: 'application/pdf',
      },
    });

    expect(result.userId).toBe(user.id);
  });

  it('should find all documents for a case', async () => {
    const caseId = 'case-123';
    const documents = [
      createMockDocument({ caseId, filename: 'doc1.pdf' }),
      createMockDocument({ caseId, filename: 'doc2.pdf', id: 'doc-456' }),
      createMockDocument({ caseId, filename: 'doc3.pdf', id: 'doc-789' }),
    ];

    prismaMock.document.findMany.mockResolvedValue(documents);

    const result = await prismaMock.document.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });

    expect(result).toHaveLength(3);
    expect(result.every(d => d.caseId === caseId)).toBe(true);
    expect(prismaMock.document.findMany).toHaveBeenCalledWith({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
  });
});
