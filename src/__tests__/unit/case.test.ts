const { CaseType, CaseStatus } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

// Mock Prisma Client
const mockPrisma = {
  case: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../../lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Test data factories
const createMockUser = () => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
});

const createMockCase = (overrides = {}) => ({
  id: 'case-123',
  userId: 'user-123',
  title: '测试案件',
  description: '这是一个测试案件描述',
  type: CaseType.CIVIL,
  status: CaseStatus.DRAFT,
  plaintiffName: '张三',
  defendantName: '某某公司',
  cause: '合同纠纷',
  amount: new Decimal('50000'),
  court: '北京市朝阳区人民法院',
  caseNumber: '（2024）京0105民初12345号',
  metadata: {
    parties: {
      plaintiff: { name: '张三', type: 'individual' },
      defendant: { name: '某某公司', type: 'company' },
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('Case Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('createCase', () => {
      it('should create a case with basic fields', async () => {
        const user = createMockUser();
        const caseData = {
          title: '测试案件',
          description: '这是一个测试案件描述',
          type: CaseType.CIVIL,
        };

        const expectedCase = createMockCase({
          userId: user.id,
          title: caseData.title,
          description: caseData.description,
          type: CaseType.CIVIL,
        });

        mockPrisma.case.create.mockResolvedValue(expectedCase);

        const result = await mockPrisma.case.create({
          data: {
            userId: user.id,
            ...caseData,
          },
        });

        expect(mockPrisma.case.create).toHaveBeenCalledWith({
          data: {
            userId: user.id,
            ...caseData,
          },
        });
        expect(result).toEqual(expectedCase);
      });

      it('should create a case with DocAnalyzer fields', async () => {
        const user = createMockUser();
        const metadata = {
          parties: {
            plaintiff: {
              name: '张三',
              type: 'individual',
              idNumber: '110101199001011234',
            },
            defendant: {
              name: '某某公司',
              type: 'company',
            },
          },
          claims: [
            {
              id: 'claim_1',
              type: 'payment',
              description: '支付赔偿金10000元',
              amount: 10000,
              currency: 'CNY',
            },
          ],
        };

        const caseData = {
          title: '劳动合同纠纷',
          description: '加班费争议',
          type: CaseType.LABOR,
          plaintiffName: '张三',
          defendantName: '某某公司',
          cause: '劳动合同纠纷',
          amount: 50000,
          court: '北京市朝阳区人民法院',
          caseNumber: '（2024）京0105民初12345号',
          metadata,
        };

        const expectedCase = createMockCase({
          userId: user.id,
          ...caseData,
          amount: new Decimal('50000'),
        });

        mockPrisma.case.create.mockResolvedValue(expectedCase);

        const result = await mockPrisma.case.create({
          data: {
            userId: user.id,
            ...caseData,
          },
        });

        expect(mockPrisma.case.create).toHaveBeenCalledWith({
          data: {
            userId: user.id,
            ...caseData,
          },
        });
        expect(result.plaintiffName).toBe('张三');
        expect(result.defendantName).toBe('某某公司');
        expect(result.metadata).toEqual(metadata);
      });
    });

    describe('findCase', () => {
      it('should find a case by id', async () => {
        const testCase = createMockCase({ id: 'case-123' });
        mockPrisma.case.findUnique.mockResolvedValue(testCase);

        const result = await mockPrisma.case.findUnique({
          where: { id: 'case-123' },
        });

        expect(mockPrisma.case.findUnique).toHaveBeenCalledWith({
          where: { id: 'case-123' },
        });
        expect(result).toEqual(testCase);
      });

      it('should return null when case not found', async () => {
        mockPrisma.case.findUnique.mockResolvedValue(null);

        const result = await mockPrisma.case.findUnique({
          where: { id: 'nonexistent' },
        });

        expect(result).toBeNull();
      });
    });

    describe('updateCase', () => {
      it('should update case basic fields', async () => {
        const originalCase = createMockCase({ id: 'case-123' });
        const updateData = {
          title: '更新后的案件标题',
          status: CaseStatus.ACTIVE,
        };

        const updatedCase = { ...originalCase, ...updateData };
        mockPrisma.case.update.mockResolvedValue(updatedCase);

        const result = await mockPrisma.case.update({
          where: { id: 'case-123' },
          data: updateData,
        });

        expect(mockPrisma.case.update).toHaveBeenCalledWith({
          where: { id: 'case-123' },
          data: updateData,
        });
        expect(result.title).toBe('更新后的案件标题');
        expect(result.status).toBe('ACTIVE');
      });

      it('should update DocAnalyzer metadata', async () => {
        const originalCase = createMockCase({ id: 'case-123' });
        const newMetadata = {
          parties: {
            plaintiff: { name: '李四', type: 'individual' },
            defendant: { name: '某某企业', type: 'company' },
          },
          claims: [
            {
              id: 'claim_2',
              type: 'compensation',
              description: '支付违约金5000元',
              amount: 5000,
            },
          ],
        };

        const updatedCase = { ...originalCase, metadata: newMetadata };
        mockPrisma.case.update.mockResolvedValue(updatedCase);

        const result = await mockPrisma.case.update({
          where: { id: 'case-123' },
          data: { metadata: newMetadata },
        });

        expect(result.metadata).toEqual(newMetadata);
        expect(result.metadata.parties.plaintiff.name).toBe('李四');
      });
    });

    describe('deleteCase', () => {
      it('should soft delete a case', async () => {
        const testCase = createMockCase({ id: 'case-123' });
        const deletedCase = { ...testCase, deletedAt: new Date() };
        mockPrisma.case.update.mockResolvedValue(deletedCase);

        const result = await mockPrisma.case.update({
          where: { id: 'case-123' },
          data: { deletedAt: new Date() },
        });

        expect(mockPrisma.case.update).toHaveBeenCalledWith({
          where: { id: 'case-123' },
          data: { deletedAt: expect.any(Date) },
        });
        expect(result.deletedAt).toBeDefined();
      });
    });
  });

  describe('Query Operations', () => {
    it('should find cases by plaintiff name', async () => {
      const testCases = [
        createMockCase({ plaintiffName: '张三' }),
        createMockCase({ plaintiffName: '张三', id: 'case-456' }),
      ];
      mockPrisma.case.findMany.mockResolvedValue(testCases);

      const result = await mockPrisma.case.findMany({
        where: { plaintiffName: '张三' },
      });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith({
        where: { plaintiffName: '张三' },
      });
      expect(result).toHaveLength(2);
      expect(result.every(c => c.plaintiffName === '张三')).toBe(true);
    });

    it('should find cases by defendant name', async () => {
      const testCases = [createMockCase({ defendantName: '某某公司' })];
      mockPrisma.case.findMany.mockResolvedValue(testCases);

      const result = await mockPrisma.case.findMany({
        where: { defendantName: '某某公司' },
      });

      expect(result[0].defendantName).toBe('某某公司');
    });

    it('should find cases by cause', async () => {
      const testCases = [createMockCase({ cause: '合同纠纷' })];
      mockPrisma.case.findMany.mockResolvedValue(testCases);

      const result = await mockPrisma.case.findMany({
        where: { cause: '合同纠纷' },
      });

      expect(result[0].cause).toBe('合同纠纷');
    });

    it('should find cases by amount range', async () => {
      const testCases = [
        createMockCase({ amount: new Decimal('50000') }),
        createMockCase({ amount: new Decimal('75000') }),
      ];
      mockPrisma.case.findMany.mockResolvedValue(testCases);

      const result = await mockPrisma.case.findMany({
        where: {
          amount: {
            gte: new Decimal('30000'),
            lte: new Decimal('80000'),
          },
        },
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('Relations', () => {
    it('should create case with related documents', async () => {
      const user = createMockUser();
      const caseData = {
        title: '测试案件',
        description: '测试描述',
        type: CaseType.CIVIL,
      };

      const testCase = createMockCase({
        userId: user.id,
        ...caseData,
      });

      mockPrisma.case.create.mockResolvedValue(testCase);

      const result = await mockPrisma.case.create({
        data: {
          userId: user.id,
          ...caseData,
          documents: {
            create: [
              {
                filename: 'test.pdf',
                filePath: '/uploads/test.pdf',
                fileType: 'PDF',
                fileSize: 1024,
                mimeType: 'application/pdf',
                userId: user.id,
              },
            ],
          },
        },
        include: { documents: true },
      });

      expect(result).toBeDefined();
      expect(mockPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documents: expect.any(Object),
          }),
          include: { documents: true },
        })
      );
    });

    it('should create case with related debates', async () => {
      const user = createMockUser();
      const caseData = {
        title: '测试案件',
        description: '测试描述',
        type: CaseType.CIVIL,
      };

      const testCase = createMockCase({
        userId: user.id,
        ...caseData,
      });

      mockPrisma.case.create.mockResolvedValue(testCase);

      const result = await mockPrisma.case.create({
        data: {
          userId: user.id,
          ...caseData,
          debates: {
            create: [
              {
                title: '测试辩论',
                status: 'DRAFT',
                userId: user.id,
              },
            ],
          },
        },
        include: { debates: true },
      });

      expect(result).toBeDefined();
      expect(mockPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debates: expect.any(Object),
          }),
          include: { debates: true },
        })
      );
    });
  });
});

describe('Case Metadata Structure', () => {
  it('should validate metadata structure', () => {
    const metadata = {
      parties: {
        plaintiff: {
          name: '张三',
          type: 'individual',
          idNumber: '110101199001011234',
          address: '北京市朝阳区',
          contact: '13800138000',
        },
        defendant: {
          name: '某某公司',
          type: 'company',
          idNumber: '91110105MAXXX1234',
          address: '北京市朝阳区',
          contact: '010-12345678',
          legalRepresentative: '李四',
        },
        thirdParties: [
          {
            name: '王五',
            type: 'individual',
          },
        ],
      },
      caseDetails: {
        cause: '劳动合同纠纷',
        subCause: '加班费争议',
        amount: 50000,
        court: '北京市朝阳区人民法院',
        caseNumber: '（2024）京0105民初12345号',
      },
      claims: [
        {
          id: 'claim_1',
          type: 'payment',
          description: '支付加班费50000元',
          amount: 50000,
          currency: 'CNY',
          basis: '劳动合同法第44条',
        },
        {
          id: 'claim_2',
          type: 'compensation',
          description: '支付经济补偿金10000元',
          amount: 10000,
          currency: 'CNY',
          basis: '劳动合同法第46条',
        },
      ],
      facts: [
        {
          id: 'fact_1',
          description: '2023年1月至2024年12月期间经常加班',
          date: '2023-01-01',
          evidenceRefs: ['doc_1', 'doc_2'],
        },
      ],
      keyDates: {
        contractStartDate: '2022-01-01',
        disputeStartDate: '2023-01-01',
        filingDate: '2024-12-01',
      },
      docAnalyzerMetadata: {
        analysisId: 'doc_analysis_123',
        analyzedAt: '2024-12-19T10:30:00Z',
        confidence: 0.95,
        extractedFields: ['parties', 'claims', 'facts', 'dates'],
      },
    };

    expect(metadata.parties.plaintiff.name).toBe('张三');
    expect(metadata.parties.defendant.type).toBe('company');
    expect(metadata.claims).toHaveLength(2);
    expect(metadata.claims[0].type).toBe('payment');
    expect(metadata.facts[0].evidenceRefs).toContain('doc_1');
    expect(metadata.docAnalyzerMetadata.confidence).toBe(0.95);
  });
});
