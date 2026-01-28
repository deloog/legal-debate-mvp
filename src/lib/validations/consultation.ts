/**
 * 咨询相关的数据验证模式
 * 使用 zod 进行表单验证
 */
import { z } from 'zod';
import {
  ConsultationType,
  ConsultStatus,
  isValidConsultationType,
} from '@/types/consultation';

/**
 * 手机号正则表达式（中国大陆手机号）
 */
const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 邮箱正则表达式
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 咨询方式验证
 */
const consultTypeSchema = z
  .nativeEnum(ConsultationType)
  .refine(
    (value): value is ConsultationType => isValidConsultationType(value),
    {
      message: '无效的咨询方式',
    }
  );

/**
 * 咨询状态验证
 */
const consultStatusSchema = z.nativeEnum(ConsultStatus);

/**
 * 手机号验证
 */
const phoneSchema = z
  .string()
  .regex(PHONE_REGEX, '请输入有效的手机号码')
  .optional();

/**
 * 邮箱验证
 */
const emailSchema = z
  .string()
  .regex(EMAIL_REGEX, '请输入有效的邮箱地址')
  .optional();

/**
 * 咨询人姓名验证
 */
const clientNameSchema = z
  .string()
  .min(1, '请输入咨询人姓名')
  .max(50, '姓名不能超过50个字符')
  .trim();

/**
 * 单位名称验证
 */
const clientCompanySchema = z
  .string()
  .max(100, '单位名称不能超过100个字符')
  .trim()
  .optional();

/**
 * 案情摘要验证
 */
const caseSummarySchema = z
  .string()
  .min(10, '案情摘要至少需要10个字符')
  .max(500, '案情摘要不能超过500个字符')
  .trim();

/**
 * 客户诉求验证
 */
const clientDemandSchema = z
  .string()
  .max(1000, '客户诉求不能超过1000个字符')
  .trim()
  .optional();

/**
 * 案件类型验证
 */
const caseTypeSchema = z
  .string()
  .max(50, '案件类型不能超过50个字符')
  .optional();

/**
 * 跟进备注验证
 */
const followUpNotesSchema = z
  .string()
  .max(500, '跟进备注不能超过500个字符')
  .trim()
  .optional();

/**
 * 咨询时间验证
 */
const consultTimeSchema = z.coerce.date();

/**
 * 跟进日期验证
 */
const followUpDateSchema = z.coerce.date();

/**
 * 咨询人信息验证模式
 */
export const consultationClientInfoSchema = z.object({
  clientName: clientNameSchema,
  clientPhone: phoneSchema,
  clientEmail: emailSchema,
  clientCompany: clientCompanySchema,
});

/**
 * 咨询详情信息验证模式
 */
export const consultationDetailsSchema = z.object({
  consultType: consultTypeSchema,
  consultTime: consultTimeSchema,
  caseType: caseTypeSchema,
  caseSummary: caseSummarySchema,
  clientDemand: clientDemandSchema,
});

/**
 * 跟进信息验证模式
 */
export const consultationFollowUpSchema = z.object({
  followUpDate: followUpDateSchema.optional(),
  followUpNotes: followUpNotesSchema.optional(),
});

/**
 * 完整的新增咨询表单验证模式
 */
export const createConsultationSchema = z
  .object({
    // 咨询方式
    consultType: consultTypeSchema,
    consultTime: consultTimeSchema,
    // 咨询人信息
    clientName: clientNameSchema,
    clientPhone: phoneSchema,
    clientEmail: emailSchema,
    clientCompany: clientCompanySchema,
    // 案情信息
    caseType: caseTypeSchema,
    caseSummary: caseSummarySchema,
    clientDemand: clientDemandSchema,
    // 跟进设置
    followUpDate: followUpDateSchema.optional(),
    followUpNotes: followUpNotesSchema.optional(),
  })
  .refine(data => data.caseSummary.length >= 10, {
    message: '案情摘要至少需要10个字符',
    path: ['caseSummary'],
  });

/**
 * 更新咨询表单验证模式
 */
export const updateConsultationSchema = createConsultationSchema.partial();

/**
 * 咨询查询参数验证模式
 */
export const consultationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: consultStatusSchema.optional(),
  consultType: consultTypeSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  keyword: z.string().optional(),
  sortBy: z.enum(['consultTime', 'createdAt', 'followUpDate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * 创建咨询请求类型
 */
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

/**
 * 更新咨询请求类型
 */
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;

/**
 * 咨询查询参数类型
 */
export type ConsultationQueryParams = z.infer<typeof consultationQuerySchema>;

/**
 * 验证咨询人信息
 */
export function validateClientInfo(data: unknown) {
  return consultationClientInfoSchema.safeParse(data);
}

/**
 * 验证咨询详情信息
 */
export function validateConsultationDetails(data: unknown) {
  return consultationDetailsSchema.safeParse(data);
}

/**
 * 验证完整的新增咨询数据
 */
export function validateCreateConsultation(data: unknown) {
  return createConsultationSchema.safeParse(data);
}

/**
 * 验证更新咨询数据
 */
export function validateUpdateConsultation(data: unknown) {
  return updateConsultationSchema.safeParse(data);
}

/**
 * 验证咨询查询参数
 */
export function validateConsultationQuery(data: unknown) {
  return consultationQuerySchema.safeParse(data);
}

/**
 * 格式化验证错误
 * 将 zod 错误转换为用户友好的错误消息
 */
export function formatZodError(error: unknown): Record<string, string> {
  const errors: Record<string, string> = {};

  if (
    error &&
    typeof error === 'object' &&
    'issues' in error &&
    Array.isArray(error.issues)
  ) {
    error.issues.forEach((err: unknown) => {
      if (err && typeof err === 'object' && 'path' in err && 'message' in err) {
        const path = Array.isArray(err.path)
          ? err.path.join('.')
          : String(err.path);
        errors[path] = String(err.message);
      }
    });
  }

  return errors;
}

/**
 * 提取第一个错误消息
 */
export function getFirstZodError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '数据验证失败';
  }

  // zod v4 safeParse 返回 { success: boolean; data?: T; error?: ZodError }
  // 当success为false时，error属性存在
  const zodError = (
    error as {
      error?: { issues?: Array<{ message?: string }> };
    }
  ).error;
  if (
    zodError &&
    typeof zodError === 'object' &&
    'issues' in zodError &&
    Array.isArray(zodError.issues) &&
    zodError.issues.length > 0
  ) {
    const firstIssue = zodError.issues[0];
    if (
      firstIssue &&
      typeof firstIssue === 'object' &&
      'message' in firstIssue
    ) {
      return String(firstIssue.message);
    }
  }

  // 兼容其他结构（直接传入的ZodError对象）
  if (
    'issues' in error &&
    Array.isArray(error.issues) &&
    error.issues.length > 0
  ) {
    const firstIssue = error.issues[0];
    if (
      firstIssue &&
      typeof firstIssue === 'object' &&
      'message' in firstIssue
    ) {
      return String(firstIssue.message);
    }
  }

  return '数据验证失败';
}
