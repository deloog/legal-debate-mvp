/**
 * 合规规则服务 (ComplianceRuleService)
 *
 * 提供合规规则的CRUD操作和查询功能
 *
 * ## 功能列表
 * - 创建合规规则
 * - 查询合规规则（支持按类型/来源/状态/业务流程过滤）
 * - 更新合规规则
 * - 删除合规规则
 * - 批量创建规则
 * - 获取规则统计信息
 *
 * ## 关联模型
 * - ComplianceRule: 合规规则
 * - EnterpriseComplianceCheck: 企业合规检查记录
 *
 * ## 使用示例
 * ```typescript
 * const service = new ComplianceRuleService(prisma);
 * const rules = await service.queryRules({ ruleType: 'REGULATORY', status: 'active' });
 * ```
 *
 * @see docs/long-term-evolution-guide.md P0-8 建立合规规则库基础
 */

import {
  Prisma,
  PrismaClient,
  ComplianceRule,
  ComplianceRuleType,
  ComplianceRuleSource,
} from '@prisma/client';
import { logger } from '@/lib/logger';

// 合规规则数据类型定义
interface ComplianceRuleData {
  ruleCode: string;
  ruleName: string;
  ruleType: ComplianceRuleType;
  source: ComplianceRuleSource;
  sourceUrl?: string;
  description?: string;
  effectiveDate: Date;
  expiryDate?: Date;
  businessProcesses?: string[];
  controlPoints?: string[];
  checklistItems?: Prisma.JsonValue[];
  status?: string;
  version?: string;
}

interface ComplianceRuleFilter {
  ruleType?: ComplianceRuleType;
  source?: ComplianceRuleSource;
  status?: string;
  businessProcess?: string;
  searchKeyword?: string;
  page?: number;
  pageSize?: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 合规规则服务
 * 负责合规规则的基础CRUD操作和查询功能
 */
export class ComplianceRuleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 创建合规规则
   */
  async createRule(data: ComplianceRuleData): Promise<ComplianceRule> {
    try {
      const rule = await this.prisma.complianceRule.create({
        data: {
          ruleCode: data.ruleCode,
          ruleName: data.ruleName,
          ruleType: data.ruleType,
          source: data.source,
          sourceUrl: data.sourceUrl,
          description: data.description,
          effectiveDate: data.effectiveDate,
          expiryDate: data.expiryDate,
          businessProcesses: data.businessProcesses || [],
          controlPoints: data.controlPoints || [],
          checklistItems: data.checklistItems || [],
          status: data.status || 'active',
          version: data.version || '1.0',
        },
      });

      logger.info('合规规则创建成功', {
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
      });

      return rule;
    } catch (error) {
      logger.error('创建合规规则失败', {
        error,
        ruleCode: data.ruleCode,
      });
      throw error;
    }
  }

  /**
   * 根据ID获取合规规则
   */
  async getRuleById(id: string): Promise<ComplianceRule | null> {
    try {
      return await this.prisma.complianceRule.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('获取合规规则失败', { error, ruleId: id });
      throw error;
    }
  }

  /**
   * 根据规则编号获取合规规则
   */
  async getRuleByCode(ruleCode: string): Promise<ComplianceRule | null> {
    try {
      return await this.prisma.complianceRule.findUnique({
        where: { ruleCode },
      });
    } catch (error) {
      logger.error('获取合规规则失败', { error, ruleCode });
      throw error;
    }
  }

  /**
   * 查询合规规则列表（支持分页和过滤）
   */
  async queryRules(
    filter: ComplianceRuleFilter
  ): Promise<PaginatedResult<ComplianceRule>> {
    try {
      const page = filter.page || 1;
      const pageSize = filter.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // 构建查询条件
      const where: Prisma.ComplianceRuleWhereInput = {};

      if (filter.ruleType) {
        where.ruleType = filter.ruleType;
      }

      if (filter.source) {
        where.source = filter.source;
      }

      if (filter.status) {
        where.status = filter.status;
      }

      if (filter.businessProcess) {
        where.businessProcesses = {
          has: filter.businessProcess,
        };
      }

      if (filter.searchKeyword) {
        where.OR = [
          { ruleName: { contains: filter.searchKeyword, mode: 'insensitive' } },
          { ruleCode: { contains: filter.searchKeyword, mode: 'insensitive' } },
          {
            description: {
              contains: filter.searchKeyword,
              mode: 'insensitive',
            },
          },
        ];
      }

      // 查询数据
      const [data, total] = await Promise.all([
        this.prisma.complianceRule.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.complianceRule.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      logger.error('查询合规规则列表失败', { error, filter });
      throw error;
    }
  }

  /**
   * 更新合规规则
   */
  async updateRule(
    id: string,
    data: Partial<ComplianceRuleData>
  ): Promise<ComplianceRule> {
    try {
      const rule = await this.prisma.complianceRule.update({
        where: { id },
        data: {
          ...(data.ruleName && { ruleName: data.ruleName }),
          ...(data.ruleType && { ruleType: data.ruleType }),
          ...(data.source && { source: data.source }),
          ...(data.sourceUrl !== undefined && { sourceUrl: data.sourceUrl }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.effectiveDate && { effectiveDate: data.effectiveDate }),
          ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate }),
          ...(data.businessProcesses && {
            businessProcesses: data.businessProcesses,
          }),
          ...(data.controlPoints && { controlPoints: data.controlPoints }),
          ...(data.checklistItems && { checklistItems: data.checklistItems }),
          ...(data.status && { status: data.status }),
          ...(data.version && { version: data.version }),
          lastUpdated: new Date(),
        },
      });

      logger.info('合规规则更新成功', {
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
      });

      return rule;
    } catch (error) {
      logger.error('更新合规规则失败', { error, ruleId: id });
      throw error;
    }
  }

  /**
   * 删除合规规则
   */
  async deleteRule(id: string): Promise<void> {
    try {
      await this.prisma.complianceRule.delete({
        where: { id },
      });

      logger.info('合规规则删除成功', { ruleId: id });
    } catch (error) {
      logger.error('删除合规规则失败', { error, ruleId: id });
      throw error;
    }
  }

  /**
   * 获取所有业务流程类型
   */
  async getAllBusinessProcesses(): Promise<string[]> {
    try {
      const rules = await this.prisma.complianceRule.findMany({
        select: { businessProcesses: true },
        where: {
          status: 'active',
        },
      });

      const processSet = new Set<string>();
      rules.forEach(rule => {
        rule.businessProcesses.forEach(process => {
          processSet.add(process);
        });
      });

      return Array.from(processSet).sort();
    } catch (error) {
      logger.error('获取业务流程类型失败', { error });
      throw error;
    }
  }

  /**
   * 获取有效的合规规则
   */
  async getActiveRules(): Promise<ComplianceRule[]> {
    try {
      return await this.prisma.complianceRule.findMany({
        where: {
          status: 'active',
        },
        orderBy: { effectiveDate: 'desc' },
      });
    } catch (error) {
      logger.error('获取有效合规规则失败', { error });
      throw error;
    }
  }

  /**
   * 批量创建合规规则
   */
  async bulkCreateRules(
    dataList: ComplianceRuleData[]
  ): Promise<ComplianceRule[]> {
    try {
      const rules = await this.prisma.complianceRule.createManyAndReturn({
        data: dataList.map(data => ({
          ruleCode: data.ruleCode,
          ruleName: data.ruleName,
          ruleType: data.ruleType,
          source: data.source,
          sourceUrl: data.sourceUrl,
          description: data.description,
          effectiveDate: data.effectiveDate,
          expiryDate: data.expiryDate,
          businessProcesses: data.businessProcesses || [],
          controlPoints: data.controlPoints || [],
          checklistItems: data.checklistItems || [],
          status: data.status || 'active',
          version: data.version || '1.0',
        })),
      });

      logger.info('批量创建合规规则成功', {
        count: rules.length,
      });

      return rules;
    } catch (error) {
      logger.error('批量创建合规规则失败', { error });
      throw error;
    }
  }

  /**
   * 根据业务流程获取相关规则
   */
  async getRulesByBusinessProcess(
    businessProcess: string
  ): Promise<ComplianceRule[]> {
    try {
      return await this.prisma.complianceRule.findMany({
        where: {
          status: 'active',
          businessProcesses: {
            has: businessProcess,
          },
        },
        orderBy: { effectiveDate: 'desc' },
      });
    } catch (error) {
      logger.error('根据业务流程获取规则失败', {
        error,
        businessProcess,
      });
      throw error;
    }
  }

  /**
   * 获取规则统计信息
   */
  async getRuleStatistics(): Promise<{
    total: number;
    active: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    try {
      const [total, active, rules] = await Promise.all([
        this.prisma.complianceRule.count(),
        this.prisma.complianceRule.count({
          where: { status: 'active' },
        }),
        this.prisma.complianceRule.findMany({
          select: { ruleType: true, source: true },
        }),
      ]);

      const byType: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      rules.forEach(rule => {
        byType[rule.ruleType] = (byType[rule.ruleType] || 0) + 1;
        bySource[rule.source] = (bySource[rule.source] || 0) + 1;
      });

      return { total, active, byType, bySource };
    } catch (error) {
      logger.error('获取规则统计信息失败', { error });
      throw error;
    }
  }
}

export default ComplianceRuleService;
