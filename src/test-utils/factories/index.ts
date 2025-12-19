// Define types locally for now (will be replaced with Prisma types later)
export enum AnalysisType {
  DOCUMENT_SUMMARY = 'DOCUMENT_SUMMARY',
  LEGAL_STRUCTURE = 'LEGAL_STRUCTURE',
  KEY_TERMS = 'KEY_TERMS',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Analysis {
  id: string;
  documentId: string;
  userId: string;
  type: AnalysisType;
  result: Record<string, unknown>;
  status: AnalysisStatus;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// User factory
export const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Document factory
export const createDocument = (
  overrides: Partial<Document> = {}
): Document => ({
  id: 'doc-123',
  title: 'Test Document',
  filename: 'test.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  content: 'This is test content',
  userId: 'user-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Analysis factory
export const createAnalysis = (
  overrides: Partial<Analysis> = {}
): Analysis => ({
  id: 'analysis-123',
  documentId: 'doc-123',
  userId: 'user-123',
  type: AnalysisType.DOCUMENT_SUMMARY,
  result: { summary: 'Test summary' },
  status: AnalysisStatus.COMPLETED,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock user data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

// Mock document data
export const mockDocument = {
  id: 'doc-123',
  title: 'Test Document',
  filename: 'test.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  content: 'This is test content',
  userId: 'user-123',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock analysis data
export const mockAnalysis = {
  id: 'analysis-123',
  documentId: 'doc-123',
  userId: 'user-123',
  type: 'DOCUMENT_SUMMARY' as AnalysisType,
  result: { summary: 'Test summary' },
  status: 'COMPLETED' as AnalysisStatus,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
