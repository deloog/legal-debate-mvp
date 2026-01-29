/**
 * 合同数据验证规则
 */
import { z } from 'zod';
import { FeeType, ContractStatus } from '@/types/contract';

// 创建合同验证规则
export const createContractSchema = z.object({
  // 关联
  caseId: z.string().optional(),
  consultationId: z.string().optional(),

  // 委托方信息
  clientType: z.enum(['INDIVIDUAL', 'ENTERPRISE'], {
    required_error: '请选择委托人类型',
  }),
  clientName: z
    .string()
    .min(1, '委托人姓名/名称不能为空')
    .max(100, '委托人姓名/名称不能超过100个字符'),
  clientIdNumber: z
    .string()
    .max(50, '证件号码不能超过50个字符')
    .optional()
    .nullable(),
  clientAddress: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .nullable(),
  clientContact: z
    .string()
    .max(50, '联系方式不能超过50个字符')
    .optional()
    .nullable(),

  // 受托方信息
  lawFirmName: z
    .string()
    .min(1, '律所名称不能为空')
    .max(100, '律所名称不能超过100个字符'),
  lawyerName: z
    .string()
    .min(1, '承办律师姓名不能为空')
    .max(50, '承办律师姓名不能超过50个字符'),
  lawyerId: z.string().min(1, '律师ID不能为空'),

  // 委托事项
  caseType: z.string().min(1, '案件类型不能为空'),
  caseSummary: z
    .string()
    .min(1, '案情简述不能为空')
    .max(2000, '案情简述不能超过2000个字符'),
  scope: z
    .string()
    .min(1, '委托范围不能为空')
    .max(500, '委托范围不能超过500个字符'),

  // 收费信息
  feeType: z.nativeEnum(FeeType, {
    required_error: '请选择收费方式',
  }),
  totalFee: z
    .number()
    .min(0, '总费用不能为负数')
    .max(100000000, '总费用不能超过1亿'),
  feeDetails: z.any().optional(),

  // 合同条款
  terms: z.any().optional(),
  specialTerms: z
    .string()
    .max(2000, '特别约定不能超过2000个字符')
    .optional()
    .nullable(),

  // 付款计划
  payments: z
    .array(
      z.object({
        paymentType: z.string().min(1, '付款类型不能为空'),
        amount: z.number().min(0, '付款金额不能为负数'),
        dueDate: z.coerce.date().optional(),
      })
    )
    .optional(),
});

// 更新合同验证规则
export const updateContractSchema = z.object({
  // 委托方信息
  clientType: z.enum(['INDIVIDUAL', 'ENTERPRISE']).optional(),
  clientName: z
    .string()
    .min(1, '委托人姓名/名称不能为空')
    .max(100, '委托人姓名/名称不能超过100个字符')
    .optional(),
  clientIdNumber: z
    .string()
    .max(50, '证件号码不能超过50个字符')
    .optional()
    .nullable(),
  clientAddress: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .nullable(),
  clientContact: z
    .string()
    .max(50, '联系方式不能超过50个字符')
    .optional()
    .nullable(),

  // 受托方信息
  lawFirmName: z
    .string()
    .min(1, '律所名称不能为空')
    .max(100, '律所名称不能超过100个字符')
    .optional(),
  lawyerName: z
    .string()
    .min(1, '承办律师姓名不能为空')
    .max(50, '承办律师姓名不能超过50个字符')
    .optional(),

  // 委托事项
  caseType: z.string().min(1, '案件类型不能为空').optional(),
  caseSummary: z
    .string()
    .min(1, '案情简述不能为空')
    .max(2000, '案情简述不能超过2000个字符')
    .optional(),
  scope: z
    .string()
    .min(1, '委托范围不能为空')
    .max(500, '委托范围不能超过500个字符')
    .optional(),

  // 收费信息
  feeType: z.nativeEnum(FeeType).optional(),
  totalFee: z
    .number()
    .min(0, '总费用不能为负数')
    .max(100000000, '总费用不能超过1亿')
    .optional(),
  feeDetails: z.any().optional(),

  // 合同条款
  terms: z.any().optional(),
  specialTerms: z
    .string()
    .max(2000, '特别约定不能超过2000个字符')
    .optional()
    .nullable(),

  // 状态
  status: z.nativeEnum(ContractStatus).optional(),

  // 签署信息
  signedAt: z.coerce.date().optional().nullable(),
  signatureData: z.any().optional(),
});

// 创建付款记录验证规则
export const createPaymentSchema = z.object({
  contractId: z.string().min(1, '合同ID不能为空'),
  amount: z
    .number()
    .min(0.01, '付款金额必须大于0')
    .max(100000000, '付款金额不能超过1亿'),
  paymentType: z.string().min(1, '付款类型不能为空'),
  paymentMethod: z.string().optional().nullable(),
  note: z.string().max(500, '备注不能超过500个字符').optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
});

// 合同列表查询参数验证
export const contractListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ContractStatus).optional(),
  keyword: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// 验证函数
export function validateCreateContract(data: unknown) {
  return createContractSchema.safeParse(data);
}

export function validateUpdateContract(data: unknown) {
  return updateContractSchema.safeParse(data);
}

export function validateCreatePayment(data: unknown) {
  return createPaymentSchema.safeParse(data);
}

export function validateContractListQuery(data: unknown) {
  return contractListQuerySchema.safeParse(data);
}

// 获取第一个验证错误信息
export function getFirstZodError(
  result: z.SafeParseReturnType<unknown, unknown>
): string {
  if (result.success) return '';

  const firstError = result.error.errors[0];
  return firstError?.message || '数据验证失败';
}
