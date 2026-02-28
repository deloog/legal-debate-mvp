/**
 * 合规服务
 *
 * 负责合规规则管理和合规检查功能。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { ComplianceRuleType, ComplianceRuleSource, ComplianceCheckResult, Prisma } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 创建合规规则输入
 */
export interface CreateComplianceRuleInput {
  ruleCode: string;
  ruleName: string;
  ruleType: ComplianceRuleType;
  source: ComplianceRuleSource;
  description?: string;
  sourceUrl?: string;
  effectiveDate: Date;
  expiryDate?: Date;
  businessProcesses: string[];
  controlPoints: string[];
  checklistItems: Array<{ name: string; status: string }>;
}

/**
 * 创建合规检查输入
 */
export interface CreateComplianceCheckInput {
  enterpriseId: string;
  ruleId: string;
  checkDate: Date;
  checkResult: ComplianceCheckResult;
  checklistResults: Array<{ name: string; passed: boolean; notes?: string }>;
  nonCompliances?: Array<{ description: string; severity: string }>;
  remediationPlan?: string;
  remediationDeadline?: Date;
  reviewerId?: string;
  reviewerNotes?: string;
}

/**
 * 合规统计
 */
export interface ComplianceStatistics {
  total: number;
  compliant: number;
  nonCompliant: number;
  partialCompliant: number;
  complianceRate: number;
}

/**
 * 合规规则查询条件
 */
export interface ComplianceRuleQuery {
  ruleType?: ComplianceRuleType;
  source?: ComplianceRuleSource;
  status?: string;
}

// =============================================================================
// 服务导出
// =============================================================================

/**
 * 合规服务
 */
export const complianceService = {
  /**
   * 创建合规规则
   */
  async createComplianceRule(input: CreateComplianceRuleInput) {
    const rule = await prisma.complianceRule.create({
      data: {
        ruleCode: input.ruleCode,
        ruleName: input.ruleName,
        ruleType: input.ruleType,
        source: input.source,
        description: input.description,
        sourceUrl: input.sourceUrl,
        effectiveDate: input.effectiveDate,
        expiryDate: input.expiryDate,
        businessProcesses: input.businessProcesses,
        controlPoints: input.controlPoints,
        checklistItems: input.checklistItems as unknown as Prisma.InputJsonValue[],
      },
    });

    logger.info('合规规则创建成功', {
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
    });

    return rule;
  },

  /**
   * 更新合规规则
   */
  async updateComplianceRule(id: string, data: Partial<CreateComplianceRuleInput>) {
    return prisma.complianceRule.update({
      where: { id },
      data: {
        ...data,
        checklistItems: data.checklistItems as unknown as Prisma.InputJsonValue[],
        lastUpdated: new Date(),
      },
    });
  },

  /**
   * 删除合规规则
   */
  async deleteComplianceRule(id: string) {
    return prisma.complianceRule.delete({
      where: { id },
    });
  },

  /**
   * 获取合规规则
   */
  async getComplianceRule(id: string) {
    return prisma.complianceRule.findUnique({
      where: { id },
    });
  },

  /**
   * 获取合规规则列表
   */
  async getComplianceRules(query: ComplianceRuleQuery = {}) {
    return prisma.complianceRule.findMany({
      where: {
        ...(query.ruleType && { ruleType: query.ruleType }),
        ...(query.source && { source: query.source }),
        ...(query.status && { status: query.status }),
      },
      orderBy: { effectiveDate: 'desc' },
    });
  },

  /**
   * 创建合规检查记录
   */
  async createComplianceCheck(input: CreateComplianceCheckInput) {
    // 验证企业存在
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: input.enterpriseId },
    });

    if (!enterprise) {
      throw new Error('企业不存在');
    }

    // 验证规则存在
    const rule = await prisma.complianceRule.findUnique({
      where: { id: input.ruleId },
    });

    if (!rule) {
      throw new Error('合规规则不存在');
    }

    const complianceCheck = await prisma.enterpriseComplianceCheck.create({
      data: {
        enterpriseId: input.enterpriseId,
        ruleId: input.ruleId,
        checkDate: input.checkDate,
        checkResult: input.checkResult,
        checklistResults: input.checklistResults as unknown as Prisma.InputJsonValue[],
        nonCompliances: (input.nonCompliances ?? []) as unknown as Prisma.InputJsonValue[],
        remediationPlan: input.remediationPlan,
        remediationDeadline: input.remediationDeadline,
        remediationStatus: input.nonCompliances?.length ? 'pending' : 'completed',
        reviewerId: input.reviewerId,
        reviewerNotes: input.reviewerNotes,
      },
    });

    logger.info('合规检查记录创建成功', {
      checkId: complianceCheck.id,
      enterpriseId: input.enterpriseId,
      ruleId: input.ruleId,
    });

    return complianceCheck;
  },

  /**
   * 更新合规检查记录
   */
  async updateComplianceCheck(id: string, data: Partial<CreateComplianceCheckInput>) {
    return prisma.enterpriseComplianceCheck.update({
      where: { id },
      data: {
        ...data,
        checklistResults: data.checklistResults as unknown as Prisma.InputJsonValue[],
        nonCompliances: data.nonCompliances as unknown as Prisma.InputJsonValue[],
      },
    });
  },

  /**
   * 获取企业合规检查记录
   */
  async getEnterpriseComplianceChecks(enterpriseId: string) {
    return prisma.enterpriseComplianceCheck.findMany({
      where: { enterpriseId },
      include: { rule: true },
      orderBy: { checkDate: 'desc' },
    });
  },

  /**
   * 获取合规检查记录
   */
  async getComplianceCheck(id: string) {
    return prisma.enterpriseComplianceCheck.findUnique({
      where: { id },
      include: { rule: true },
    });
  },

  /**
   * 获取合规统计数据
   */
  async getComplianceStatistics(enterpriseId: string): Promise<ComplianceStatistics> {
    const total = await prisma.enterpriseComplianceCheck.count({
      where: { enterpriseId },
    });

    const compliant = await prisma.enterpriseComplianceCheck.count({
      where: {
        enterpriseId,
        checkResult: 'COMPLIANT',
      },
    });

    const partialCompliant = await prisma.enterpriseComplianceCheck.count({
      where: {
        enterpriseId,
        checkResult: 'PARTIAL_COMPLIANT',
      },
    });

    const nonCompliant = await prisma.enterpriseComplianceCheck.count({
      where: {
        enterpriseId,
        checkResult: 'NON_COMPLIANT',
      },
    });

    const complianceRate = total > 0 ? (compliant / total) * 100 : 0;

    return {
      total,
      compliant,
      nonCompliant,
      partialCompliant,
      complianceRate: Math.round(complianceRate * 100) / 100,
    };
  },

  /**
   * 获取待整改的合规检查项
   */
  async getPendingRemediationChecks(enterpriseId: string) {
    return prisma.enterpriseComplianceCheck.findMany({
      where: {
        enterpriseId,
        remediationStatus: {
          in: ['pending', 'in_progress', 'overdue'],
        },
      },
      include: { rule: true },
      orderBy: { remediationDeadline: 'asc' },
    });
  },

  /**
   * 更新整改状态
   */
  async updateRemediationStatus(
    checkId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  ) {
    return prisma.enterpriseComplianceCheck.update({
      where: { id: checkId },
      data: { remediationStatus: status },
    });
  },

  /**
   * 批量创建合规规则
   */
  async batchCreateRules(rules: CreateComplianceRuleInput[]) {
    const results = [];

    for (const rule of rules) {
      try {
        const result = await this.createComplianceRule(rule);
        results.push({ success: true, data: result });
      } catch (error) {
        logger.error('批量创建合规规则失败', {
          ruleCode: rule.ruleCode,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },
};
