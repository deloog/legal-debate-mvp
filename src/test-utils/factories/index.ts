// Import Prisma types for legal debate system
import type {
  User,
  Account,
  Session,
  Case,
  Document,
  Debate,
  DebateRound,
  Argument,
  LegalReference,
  AIInteraction,
} from '@prisma/client';
import {
  UserRole,
  CaseType,
  CaseStatus,
  AnalysisStatus,
  DebateStatus,
  RoundStatus,
  ArgumentSide,
  ArgumentType
} from '@prisma/client';

// User factory
export const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: UserRole.USER,
  permissions: null,
  organizationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// Account factory
export const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'account-123',
  userId: 'user-123',
  type: 'oauth',
  provider: 'github',
  providerAccountId: 'github-123',
  refresh_token: null,
  access_token: null,
  expires_at: null,
  token_type: null,
  scope: null,
  id_token: null,
  session_state: null,
  ...overrides,
});

// Session factory
export const createSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-123',
  sessionToken: 'session-token-123',
  userId: 'user-123',
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  ...overrides,
});

// Case factory
export const createCase = (overrides: Partial<Case> = {}): Case => ({
  id: 'case-123',
  userId: 'user-123',
  title: '劳动合同纠纷案',
  description: '关于加班费计算的争议案件',
  type: CaseType.LABOR,
  status: CaseStatus.ACTIVE,
  metadata: {
    plaintiff: '张三',
    defendant: '某某公司',
    claimAmount: 50000,
    court: '北京市朝阳区人民法院'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// Document factory
export const createDocument = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc-123',
  caseId: 'case-123',
  userId: 'user-123',
  filename: '劳动合同.pdf',
  filePath: '/uploads/documents/contract.pdf',
  fileType: 'PDF',
  fileSize: 1024000,
  mimeType: 'application/pdf',
  extractedData: {
    pages: 10,
    title: '劳动合同',
    parties: ['张三', '某某公司']
  },
  analysisStatus: AnalysisStatus.COMPLETED,
  analysisResult: {
    summary: '这是一份标准的劳动合同',
    keyTerms: ['试用期', '加班费', '解除合同']
  },
  analysisError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// Debate factory
export const createDebate = (overrides: Partial<Debate> = {}): Debate => ({
  id: 'debate-123',
  caseId: 'case-123',
  userId: 'user-123',
  title: '加班费计算标准辩论',
  status: DebateStatus.IN_PROGRESS,
  currentRound: 1,
  debateConfig: {
    mode: 'FORMAL',
    timeLimit: 300,
    aiProviders: ['zhipu', 'deepseek']
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// DebateRound factory
export const createDebateRound = (overrides: Partial<DebateRound> = {}): DebateRound => ({
  id: 'round-123',
  debateId: 'debate-123',
  roundNumber: 1,
  status: RoundStatus.IN_PROGRESS,
  startedAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Argument factory
export const createArgument = (overrides: Partial<Argument> = {}): Argument => ({
  id: 'arg-123',
  roundId: 'round-123',
  side: ArgumentSide.PLAINTIFF,
  content: '根据劳动合同法第44条，加班费应按照工资的150%支付',
  type: ArgumentType.MAIN_POINT,
  aiProvider: 'zhipu',
  generationTime: 1500,
  confidence: 0.85,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// LegalReference factory
export const createLegalReference = (overrides: Partial<LegalReference> = {}): LegalReference => ({
  id: 'ref-123',
  caseId: 'case-123',
  source: '中华人民共和国劳动合同法',
  content: '第四十四条 有下列情形之一的，用人单位应当按照下列标准支付高于劳动者正常工作时间工资的工资报酬：（一）安排劳动者延长工作时间的，支付不低于工资的百分之一百五十的工资报酬；（二）休息日安排劳动者工作又不能安排补休的，支付不低于工资的百分之二百的工资报酬；（三）法定休假日安排劳动者工作的，支付不低于工资的百分之三百的工资报酬。',
  lawType: '劳动法',
  articleNumber: '第四十四条',
  retrievalQuery: '加班费计算标准',
  relevanceScore: 0.95,
  metadata: {
    effectiveDate: '2008-01-01',
    revisedDate: '2018-12-29'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// AIInteraction factory
export const createAIInteraction = (overrides: Partial<AIInteraction> = {}): AIInteraction => ({
  id: 'interaction-123',
  type: 'debate_generation',
  provider: 'zhipu',
  model: 'chatglm3-6b',
  request: {
    prompt: '请为原告方生成关于加班费计算的论点',
    context: '劳动争议案件'
  },
  response: {
    content: '根据劳动合同法...',
    tokens: 256
  },
  tokensUsed: 256,
  duration: 1500,
  cost: 0.05,
  success: true,
  error: null,
  createdAt: new Date(),
  ...overrides,
});

// Mock data objects for quick testing
export const mockUser = createUser();
export const mockCase = createCase();
export const mockDocument = createDocument();
export const mockDebate = createDebate();
export const mockArgument = createArgument();
export const mockLegalReference = createLegalReference();

// Utility functions for creating related data
export const createCaseWithDocuments = (documentCount = 2) => {
  const user = createUser();
  const testCase = createCase({ userId: user.id });
  const documents = Array.from({ length: documentCount }, (_, i) =>
    createDocument({
      id: `doc-${i + 1}`,
      caseId: testCase.id,
      userId: user.id,
      filename: `document-${i + 1}.pdf`
    })
  );

  return { user, case: testCase, documents };
};

export const createDebateWithArguments = (roundCount = 2, argumentsPerRound = 2) => {
  const user = createUser();
  const testCase = createCase({ userId: user.id });
  const debate = createDebate({ caseId: testCase.id, userId: user.id });
  
  const rounds = Array.from({ length: roundCount }, (_, i) =>
    createDebateRound({
      id: `round-${i + 1}`,
      debateId: debate.id,
      roundNumber: i + 1
    })
  );

  const argumentList = rounds.flatMap(round =>
    Array.from({ length: argumentsPerRound }, (_, i) =>
      createArgument({
        id: `arg-${round.id}-${i + 1}`,
        roundId: round.id,
        side: i % 2 === 0 ? ArgumentSide.PLAINTIFF : ArgumentSide.DEFENDANT
      })
    )
  );

  return { user, case: testCase, debate, rounds, arguments: argumentList };
};
