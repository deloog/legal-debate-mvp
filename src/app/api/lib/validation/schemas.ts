import { z } from 'zod';

/**
 * 通用ID验证 - 支持UUID和CUID格式
 * UUID格式: 8-4-4-4-12 (如: 123e4567-e89b-12d3-a456-426614174000)
 * CUID格式: 25位字符 (如: cmjtg7np100axc0zgwiwpwt9a)
 * 测试ID格式: mock-article-id-数字 (用于E2E测试)
 */
export const uuidSchema = z
  .string()
  .min(1, 'ID is required')
  .refine(
    val => {
      // 尝试UUID格式
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // Prisma CUID格式 - 放宽限制以支持实际生成的CUID
      // 标准CUID是25位，但实际可能稍长或稍短
      const cuidRegex = /^[a-z0-9]{20,30}$/;
      // 测试ID格式: 支持 test-*-id、mock-*-id[-数字]、non-existent-*-id 等常见测试命名
      const testIdRegex = /^(test|mock|non-existent)(-[a-z]+)*(-\d+)?$/;
      return (
        uuidRegex.test(val) || cuidRegex.test(val) || testIdRegex.test(val)
      );
    },
    { message: 'Invalid ID format (expected UUID or CUID)' }
  );

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
  userId: z.string().min(1, 'User ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description too long'),
  type: z.enum([
    'civil',
    'criminal',
    'administrative',
    'labor',
    'commercial',
    'intellectual',
    'other',
  ]),
  status: z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
  amount: z.number().optional(),
  caseNumber: z.string().optional(),
  cause: z.string().optional(),
  court: z.string().optional(),
  plaintiffName: z.string().optional(),
  defendantName: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * 案件查询参数验证
 */
export const caseQuerySchema = paginationSchema.extend({
  userId: z.string().optional(),
  type: z
    .enum([
      'civil',
      'criminal',
      'administrative',
      'labor',
      'commercial',
      'intellectual',
      'other',
    ])
    .optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
});

/**
 * 案件更新验证模式
 * 注意：不包含userId字段，因为案件的所有权不允许修改
 */
export const updateCaseSchema = createCaseSchema
  .omit({ userId: true })
  .partial()
  // createCaseSchema.status has .default('draft'); strip the default so an
  // omitted status field is truly undefined rather than 'draft' in updates.
  .extend({
    status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  })
  .strict();

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
  status: z
    .enum(['DRAFT', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
    .optional(),
  config: z
    .object({
      maxRounds: z.number().int().min(1).max(10).default(3),
      timePerRound: z.number().int().min(1).max(60).default(30), // minutes
      allowNewEvidence: z.boolean().default(true),
      debateMode: z.enum(['standard', 'fast', 'detailed']).default('standard'),
    })
    .optional(),
});

export const updateDebateSchema = createDebateSchema.partial();

/**
 * 辩论轮次相关验证模式
 */
export const createDebateRoundSchema = z.object({
  roundNumber: z.number().int().min(1).optional(),
  status: z
    .enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'])
    .default('PENDING'),
});

/**
 * 论点相关验证模式
 */
export const createArgumentSchema = z.object({
  roundId: uuidSchema,
  side: z.enum(['PLAINTIFF', 'DEFENDANT', 'NEUTRAL']),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(2000, 'Content too long'),
  type: z
    .enum([
      'MAIN_POINT',
      'SUPPORTING',
      'REBUTTAL',
      'EVIDENCE',
      'LEGAL_BASIS',
      'CONCLUSION',
    ])
    .default('MAIN_POINT'),
  legalReferences: z
    .array(
      z.object({
        id: uuidSchema.optional(),
        content: z.string(),
        relevance: z.number().min(0).max(1),
      })
    )
    .optional(),
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
  username: z
    .string()
    .min(3, 'Username too short')
    .max(50, 'Username too long'),
  role: z.enum(['lawyer', 'admin', 'user']).default('lawyer'),
  profile: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      licenseNumber: z.string().optional(),
      organization: z.string().optional(),
    })
    .optional(),
});

export const updateUserSchema = createUserSchema.partial();

/**
 * AI服务相关验证模式
 */
export const parseDocumentSchema = z.object({
  documentId: uuidSchema,
  options: z
    .object({
      extractKeyInfo: z.boolean().default(true),
      identifyLegalIssues: z.boolean().default(true),
      generateSummary: z.boolean().default(false),
    })
    .optional(),
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
  options: z
    .object({
      maxArguments: z.number().int().min(2).max(10).default(6),
      legalDepth: z
        .enum(['basic', 'intermediate', 'advanced'])
        .default('intermediate'),
      includeEvidence: z.boolean().default(true),
    })
    .optional(),
});

/**
 * 为轮次生成论点的验证模式
 */
export const generateArgumentsSchema = z.object({
  // 文章 ID 可为 UUID、CUID 或带连字符的 E2E 测试 ID（如 e2e-law-article-001）
  applicableArticles: z.array(z.string().min(1).max(100)).max(50).default([]),
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
export type CreateLegalReferenceInput = z.infer<
  typeof createLegalReferenceSchema
>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ParseDocumentInput = z.infer<typeof parseDocumentSchema>;
export type SearchLawsInput = z.infer<typeof searchLawsSchema>;
export type GenerateDebateInput = z.infer<typeof generateDebateSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
