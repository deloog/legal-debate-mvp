import { z } from 'zod';

/**
 * 通用UUID验证
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * 分页参数验证
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

/**
 * 案件相关验证模式
 */
export const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  type: z.enum(['civil', 'criminal', 'administrative', 'labor', 'commercial', 'intellectual_property', 'other']),
  status: z.enum(['draft', 'active', 'closed', 'archived']).default('draft'),
});

export const updateCaseSchema = createCaseSchema.partial();

/**
 * 文档相关验证模式
 */
export const uploadDocumentSchema = z.object({
  caseId: uuidSchema,
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['pdf', 'doc', 'docx', 'jpg', 'png', 'txt']),
  description: z.string().optional(),
});

/**
 * 辩论相关验证模式
 */
export const createDebateSchema = z.object({
  caseId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  config: z.object({
    maxRounds: z.number().int().min(1).max(10).default(3),
    timePerRound: z.number().int().min(1).max(60).default(30), // minutes
    allowNewEvidence: z.boolean().default(true),
    debateMode: z.enum(['standard', 'fast', 'detailed']).default('standard'),
  }).optional(),
});

export const updateDebateSchema = createDebateSchema.partial();

/**
 * 辩论轮次相关验证模式
 */
export const createDebateRoundSchema = z.object({
  roundNumber: z.number().int().min(1).optional(),
  status: z.enum(['preparing', 'active', 'completed', 'pending', 'in_progress']).default('preparing'),
});

/**
 * 论点相关验证模式
 */
export const createArgumentSchema = z.object({
  roundId: uuidSchema,
  side: z.enum(['pro', 'con']),
  content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
  type: z.enum(['opening', 'rebuttal', 'closing', 'evidence']).default('opening'),
  legalReferences: z.array(z.object({
    id: uuidSchema.optional(),
    content: z.string(),
    relevance: z.number().min(0).max(1),
  })).optional(),
});

/**
 * 法律依据相关验证模式
 */
export const createLegalReferenceSchema = z.object({
  caseId: uuidSchema.optional(),
  roundId: uuidSchema.optional(),
  source: z.string().min(1, 'Source is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().optional(),
  relevance: z.number().min(0).max(1).optional(),
  retrievalQuery: z.string().optional(),
});

/**
 * 用户相关验证模式
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username too short').max(50, 'Username too long'),
  role: z.enum(['lawyer', 'admin', 'user']).default('lawyer'),
  profile: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    licenseNumber: z.string().optional(),
    organization: z.string().optional(),
  }).optional(),
});

export const updateUserSchema = createUserSchema.partial();

/**
 * AI服务相关验证模式
 */
export const parseDocumentSchema = z.object({
  documentId: uuidSchema,
  options: z.object({
    extractKeyInfo: z.boolean().default(true),
    identifyLegalIssues: z.boolean().default(true),
    generateSummary: z.boolean().default(false),
  }).optional(),
});

export const searchLawsSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  includeExpired: z.boolean().default(false),
});

export const generateDebateSchema = z.object({
  debateId: uuidSchema,
  roundNumber: z.number().int().min(1),
  options: z.object({
    maxArguments: z.number().int().min(2).max(10).default(6),
    legalDepth: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate'),
    includeEvidence: z.boolean().default(true),
  }).optional(),
});

/**
 * 导出所有验证模式的类型
 */
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type CreateDebateInput = z.infer<typeof createDebateSchema>;
export type UpdateDebateInput = z.infer<typeof updateDebateSchema>;
export type CreateDebateRoundInput = z.infer<typeof createDebateRoundSchema>;
export type CreateArgumentInput = z.infer<typeof createArgumentSchema>;
export type CreateLegalReferenceInput = z.infer<typeof createLegalReferenceSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ParseDocumentInput = z.infer<typeof parseDocumentSchema>;
export type SearchLawsInput = z.infer<typeof searchLawsSchema>;
export type GenerateDebateInput = z.infer<typeof generateDebateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
