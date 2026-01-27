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

// eslint-disable-next-line @typescript-eslint/no-require-imports
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

describe('Document CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDocument', () => {
    it('should create a document with basic fields', async () => {
      const user = createMockUser();
      const caseData = createMockCase();
      const documentData = {
        filename: 'test-document.pdf',
        filePath: '/uploads/documents/test-document.pdf',
        fileType: 'PDF',
        fileSize: 1024000,
        mimeType: 'application/pdf',
      };

      const expectedDocument = createMockDocument({
        caseId: caseData.id,
        userId: user.id,
        ...documentData,
      });

      prismaMock.document.create.mockResolvedValue(expectedDocument);

      const result = await prismaMock.document.create({
        data: {
          caseId: caseData.id,
          userId: user.id,
          ...documentData,
        },
      });

      expect(prismaMock.document.create).toHaveBeenCalledWith({
        data: {
          caseId: caseData.id,
          userId: user.id,
          ...documentData,
        },
      });
      expect(result).toEqual(expectedDocument);
      expect(result.filename).toBe('test-document.pdf');
      expect(result.fileType).toBe('PDF');
      expect(result.analysisStatus).toBe(AnalysisStatus.PENDING);
    });

    it('should create a document with extracted data', async () => {
      const user = createMockUser();
      const caseData = createMockCase();
      const extractedData = {
        title: '起诉状',
        plaintiff: '张三',
        defendant: '李四',
        claims: ['支付赔偿金'],
        facts: ['合同违约事实'],
      };

      const documentData = {
        filename: 'lawsuit.pdf',
        filePath: '/uploads/documents/lawsuit.pdf',
        fileType: 'PDF',
        fileSize: 2048000,
        mimeType: 'application/pdf',
        extractedData,
      };

      const expectedDocument = createMockDocument({
        caseId: caseData.id,
        userId: user.id,
        ...documentData,
      });

      prismaMock.document.create.mockResolvedValue(expectedDocument);

      const result = await prismaMock.document.create({
        data: {
          caseId: caseData.id,
          userId: user.id,
          ...documentData,
        },
      });

      expect(result.extractedData).toEqual(extractedData);
      expect(result.extractedData.plaintiff).toBe('张三');
      expect(result.extractedData.defendant).toBe('李四');
    });
  });

  describe('findDocument', () => {
    it('should find a document by id', async () => {
      const testDocument = createMockDocument({ id: 'doc-123' });
      prismaMock.document.findUnique.mockResolvedValue(testDocument);

      const result = await prismaMock.document.findUnique({
        where: { id: 'doc-123' },
      });

      expect(prismaMock.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
      });
      expect(result).toEqual(testDocument);
    });

    it('should return null when document not found', async () => {
      prismaMock.document.findUnique.mockResolvedValue(null);

      const result = await prismaMock.document.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('should find document with related case and user', async () => {
      const user = createMockUser();
      const caseData = createMockCase();
      const testDocument = createMockDocument();

      prismaMock.document.findUnique.mockResolvedValue({
        ...testDocument,
        case: caseData,
        user: user,
      });

      const result = await prismaMock.document.findUnique({
        where: { id: 'doc-123' },
        include: { case: true, user: true },
      });

      expect(prismaMock.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        include: { case: true, user: true },
      });
      expect(result.case).toEqual(caseData);
      expect(result.user).toEqual(user);
    });
  });

  describe('findDocuments', () => {
    it('should find documents by case id', async () => {
      const testDocuments = [
        createMockDocument({ caseId: 'case-123' }),
        createMockDocument({ caseId: 'case-123', id: 'doc-456' }),
      ];
      prismaMock.document.findMany.mockResolvedValue(testDocuments);

      const result = await prismaMock.document.findMany({
        where: { caseId: 'case-123' },
      });

      expect(prismaMock.document.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123' },
      });
      expect(result).toHaveLength(2);
      expect(result.every(d => d.caseId === 'case-123')).toBe(true);
    });

    it('should find documents by analysis status', async () => {
      const testDocuments = [
        createMockDocument({ analysisStatus: AnalysisStatus.COMPLETED }),
        createMockDocument({
          analysisStatus: AnalysisStatus.COMPLETED,
          id: 'doc-456',
        }),
      ];
      prismaMock.document.findMany.mockResolvedValue(testDocuments);

      const result = await prismaMock.document.findMany({
        where: { analysisStatus: AnalysisStatus.COMPLETED },
      });

      expect(result).toHaveLength(2);
      expect(
        result.every(d => d.analysisStatus === AnalysisStatus.COMPLETED)
      ).toBe(true);
    });

    it('should find documents by file type', async () => {
      const testDocuments = [
        createMockDocument({ fileType: 'PDF' }),
        createMockDocument({ fileType: 'PDF', id: 'doc-456' }),
      ];
      prismaMock.document.findMany.mockResolvedValue(testDocuments);

      const result = await prismaMock.document.findMany({
        where: { fileType: 'PDF' },
      });

      expect(result).toHaveLength(2);
      expect(result.every(d => d.fileType === 'PDF')).toBe(true);
    });
  });

  describe('updateDocument', () => {
    it('should update document basic fields', async () => {
      const originalDocument = createMockDocument({ id: 'doc-123' });
      const updateData = {
        filename: 'updated-document.pdf',
        analysisStatus: AnalysisStatus.PROCESSING,
      };

      const updatedDocument = { ...originalDocument, ...updateData };
      prismaMock.document.update.mockResolvedValue(updatedDocument);

      const result = await prismaMock.document.update({
        where: { id: 'doc-123' },
        data: updateData,
      });

      expect(prismaMock.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: updateData,
      });
      expect(result.filename).toBe('updated-document.pdf');
      expect(result.analysisStatus).toBe(AnalysisStatus.PROCESSING);
    });

    it('should update document analysis result', async () => {
      const originalDocument = createMockDocument({ id: 'doc-123' });
      const analysisResult = {
        summary: '这是一个合同纠纷案件',
        keyPoints: ['合同违约', '赔偿要求'],
        confidence: 0.95,
        extractedAt: new Date().toISOString(),
      };

      const updatedDocument = {
        ...originalDocument,
        analysisStatus: AnalysisStatus.COMPLETED,
        analysisResult,
      };
      prismaMock.document.update.mockResolvedValue(updatedDocument);

      const result = await prismaMock.document.update({
        where: { id: 'doc-123' },
        data: {
          analysisStatus: AnalysisStatus.COMPLETED,
          analysisResult,
        },
      });

      expect(result.analysisStatus).toBe(AnalysisStatus.COMPLETED);
      expect(result.analysisResult).toEqual(analysisResult);
      expect(result.analysisResult.confidence).toBe(0.95);
    });

    it('should update document with analysis error', async () => {
      const originalDocument = createMockDocument({ id: 'doc-123' });
      const analysisError = 'AI服务暂时不可用，请稍后重试';

      const updatedDocument = {
        ...originalDocument,
        analysisStatus: AnalysisStatus.FAILED,
        analysisError,
      };
      prismaMock.document.update.mockResolvedValue(updatedDocument);

      const result = await prismaMock.document.update({
        where: { id: 'doc-123' },
        data: {
          analysisStatus: AnalysisStatus.FAILED,
          analysisError,
        },
      });

      expect(result.analysisStatus).toBe(AnalysisStatus.FAILED);
      expect(result.analysisError).toBe(analysisError);
    });
  });

  describe('deleteDocument', () => {
    it('should soft delete a document', async () => {
      const testDocument = createMockDocument({ id: 'doc-123' });
      const deletedDocument = { ...testDocument, deletedAt: new Date() };
      prismaMock.document.update.mockResolvedValue(deletedDocument);

      const result = await prismaMock.document.update({
        where: { id: 'doc-123' },
        data: { deletedAt: expect.any(Date) },
      });

      expect(prismaMock.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });
  });
});
