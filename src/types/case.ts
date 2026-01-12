import { Case as PrismaCase } from '@prisma/client';

// DocAnalyzer输出的metadata结构
export interface CaseMetadata {
  parties?: {
    plaintiff?: PartyInfo;
    defendant?: PartyInfo;
    thirdParties?: PartyInfo[];
  };
  caseDetails?: {
    cause?: string;
    subCause?: string;
    amount?: number;
    court?: string;
    caseNumber?: string;
  };
  claims?: Claim[];
  facts?: Fact[];
  keyDates?: Record<string, string>;
  docAnalyzerMetadata?: {
    analysisId?: string;
    analyzedAt?: string;
    confidence?: number;
    extractedFields?: string[];
  };
}

export interface PartyInfo {
  name: string;
  type?: 'individual' | 'company' | 'organization';
  idNumber?: string;
  address?: string;
  contact?: string;
  legalRepresentative?: string;
}

export interface Claim {
  id: string;
  type: 'payment' | 'compensation' | 'performance' | 'declaration' | 'other';
  description: string;
  amount?: number;
  currency?: string;
  basis?: string;
}

export interface Fact {
  id: string;
  description: string;
  date?: string;
  evidenceRefs?: string[];
}

// 扩展的Case类型
export type CaseWithMetadata = PrismaCase & {
  metadata?: CaseMetadata | null;
};

// 创建Case的DTO
export interface CreateCaseInput {
  title: string;
  description: string;
  type: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  amount?: number;
  court?: string;
  caseNumber?: string;
  metadata?: CaseMetadata;
}

// 更新Case的DTO
export interface UpdateCaseInput {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  amount?: number;
  court?: string;
  caseNumber?: string;
  metadata?: CaseMetadata;
}

// 查询Case的参数
export interface CaseQueryParams {
  userId?: string;
  status?: string;
  type?: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  court?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// DocAnalyzer输入结构
export interface DocAnalyzerInput {
  documentContent: string;
  documentType: 'lawsuit' | 'contract' | 'evidence' | 'other';
  caseId?: string;
}

// DocAnalyzer输出结构
export interface DocAnalyzerOutput {
  success: boolean;
  data?: CaseMetadata;
  error?: string;
  confidence?: number;
  processingTime?: number;
}

// 案件统计信息
export interface CaseStatistics {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  casesByType: Record<string, number>;
  casesByCause: Record<string, number>;
  averageAmount?: number;
}
