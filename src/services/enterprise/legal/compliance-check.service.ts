/**
 * 合规检查服务 (ComplianceCheckService)
 *
 * 提供企业合规检查的基础功能，支持对企业进行多维度合规评估。
 * 通过对企业适用的合规规则进行检查，生成检查结果和改进建议。
 *
 * ## 功能特性
 * - 执行合规检查：根据规则对企业进行合规评估
 * - 保存检查结果：将检查结果持久化存储
 * - 查询检查历史：获取企业历次合规检查记录
 * - 汇总合规状态：生成企业合规状态摘要统计
 *
 * ## 检查流程
 * 1. 根据企业业务范围获取适用的合规规则
 * 2. 对每条规则执行检查，评估合规状态
 * 3. 生成检查发现和改进建议
 * 4. 保存检查结果供后续追踪
 *
 * ## 检查结果状态
 * - COMPLIANT: 完全合规
 * - NON_COMPLIANT: 不合规
 * - PARTIAL_COMPLIANT: 部分合规（部分检查项不适用）
 *
 * ## 使用示例
 * ```typescript
 * import { ComplianceCheckService } from '@/services/enterprise/legal/compliance-check.service';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const service = new ComplianceCheckService(prisma);
 *
 * // 执行合规检查
 * const results = await service.performComplianceCheck({
 *   enterpriseId: 'enterprise-uuid',
 *   businessProcess: '数据处理',
 *   ruleIds: ['rule-uuid-1', 'rule-uuid-2']
 * });
 *
 * // 保存检查结果
 * await service.saveComplianceCheckResult('enterprise-uuid', results);
 *
 * // 获取合规状态摘要
 * const summary = await service.getComplianceSummary('enterprise-uuid');
 * // 返回 { totalRules: 10, compliant: 8, nonCompliant: 1, partialCompliant: 1, pendingRemediation: 2 }
 * ```
 *
 * @module services/enterprise/legal/compliance-check.service
 */

import { logger } from '@/lib/logger';
import { Prisma, PrismaClient } from '@prisma/client';

// 合规检查结果类型定义
interface ComplianceCheckResult {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  checkStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL_COMPLIANT';
  findings: Array<{
    checklistItem: string;
    status: 'passed' | 'failed' | 'not_applicable';
    notes?: string;
  }>;
  recommendations?: string[];
}

interface ComplianceCheckOptions {
  enterpriseId: string;
  businessProcess?: string;
  ruleIds?: string[];
}

/**
 * 合规检查服务
 * 负责对企业进行合规检查的基础功能
 */
export class ComplianceCheckService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 执行合规检查
   */
  async performComplianceCheck(
    options: ComplianceCheckOptions
  ): Promise<ComplianceCheckResult[]> {
    try {
      // 构建规则查询条件
      const where: Prisma.ComplianceRuleWhereInput = {
        status: 'active',
      };

      if (options.businessProcess) {
        where.businessProcesses = {
          has: options.businessProcess,
        };
      }

      if (options.ruleIds && options.ruleIds.length > 0) {
        where.id = { in: options.ruleIds };
      }

      // 获取适用的合规规则
      const rules = await this.prisma.complianceRule.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
      });

      // 对每个规则执行检查
      const results: ComplianceCheckResult[] = [];

      for (const rule of rules) {
        const checkResult = await this.checkRule(rule, options.enterpriseId);
        results.push(checkResult);
      }

      logger.info('合规检查完成', {
        enterpriseId: options.enterpriseId,
        rulesChecked: results.length,
        compliantCount: results.filter(r => r.checkStatus === 'COMPLIANT')
          .length,
        nonCompliantCount: results.filter(
          r => r.checkStatus === 'NON_COMPLIANT'
        ).length,
      });

      return results;
    } catch (error) {
      logger.error('执行合规检查失败', { error, options });
      throw error;
    }
  }

  /**
   * 检查单条规则
   */
  private async checkRule(
    rule: Awaited<ReturnType<typeof this.prisma.complianceRule.findUnique>>,
    enterpriseId: string
  ): Promise<ComplianceCheckResult> {
    // 处理 rule 为 null 的情况
    if (!rule) {
      return {
        ruleId: 'unknown',
        ruleCode: 'UNKNOWN',
        ruleName: 'Unknown Rule',
        checkStatus: 'NON_COMPLIANT',
        findings: [],
        recommendations: ['规则不存在或已删除'],
      };
    }

    const findings: ComplianceCheckResult['findings'] = [];
    const recommendations: string[] = [];

    // 获取检查清单项
    const checklistItems =
      (rule.checklistItems as Array<{
        item: string;
        description: string;
        required: boolean;
      }>) || [];

    // 查询是否有近30天内的检查记录，直接复用（避免重复检查）
    const recentCheck = await this.prisma.enterpriseComplianceCheck.findFirst({
      where: {
        enterpriseId,
        ruleId: rule.id,
        checkDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { checkDate: 'desc' },
    });

    if (recentCheck) {
      return {
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        checkStatus:
          recentCheck.checkResult as ComplianceCheckResult['checkStatus'],
        findings:
          recentCheck.checklistResults as ComplianceCheckResult['findings'],
        recommendations,
      };
    }

    // 加载企业信息用于自动评估
    const enterprise = await this.prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
      select: {
        status: true,
        businessLicense: true,
        verificationData: true,
        creditCode: true,
        legalPerson: true,
        industryType: true,
        expiresAt: true,
      },
    });

    for (const item of checklistItems) {
      const itemKey = item.item.toLowerCase();
      let status: 'passed' | 'failed' | 'not_applicable';
      let notes: string;

      if (
        itemKey.includes('营业执照') ||
        itemKey.includes('business_license') ||
        itemKey.includes('证照')
      ) {
        status = enterprise?.businessLicense
          ? 'passed'
          : item.required
            ? 'failed'
            : 'not_applicable';
        notes = enterprise?.businessLicense
          ? '营业执照已上传'
          : '未上传营业执照';
      } else if (
        itemKey.includes('认证') ||
        itemKey.includes('verification') ||
        itemKey.includes('核验')
      ) {
        status = enterprise?.verificationData
          ? 'passed'
          : item.required
            ? 'failed'
            : 'not_applicable';
        notes = enterprise?.verificationData
          ? '已完成企业认证'
          : '尚未完成企业认证';
      } else if (
        itemKey.includes('有效期') ||
        itemKey.includes('expire') ||
        itemKey.includes('过期')
      ) {
        const isValid =
          enterprise?.expiresAt == null || enterprise.expiresAt > new Date();
        status = isValid
          ? 'passed'
          : item.required
            ? 'failed'
            : 'not_applicable';
        notes = isValid ? '证照在有效期内' : '证照已过期，请及时续期';
      } else if (enterprise?.status === 'APPROVED') {
        // 企业状态正常的情况下，无特定数据依赖的检查项自动通过
        status = 'passed';
        notes = '企业认证状态正常';
      } else if (!item.required) {
        status = 'not_applicable';
        notes = '非必填检查项，暂不适用';
      } else {
        status = 'failed';
        notes = '企业未激活或缺少所需资料，需人工核查';
      }

      findings.push({ checklistItem: item.item, status, notes });
    }

    // 简化判断逻辑：所有项目都通过则合规，有一个失败则不合规
    const failedCount = findings.filter(f => f.status === 'failed').length;
    const notApplicableCount = findings.filter(
      f => f.status === 'not_applicable'
    ).length;

    let checkStatus: ComplianceCheckResult['checkStatus'] = 'COMPLIANT';
    if (failedCount > 0) {
      checkStatus = 'NON_COMPLIANT';
    } else if (notApplicableCount === checklistItems.length) {
      checkStatus = 'PARTIAL_COMPLIANT';
    }

    // 生成建议
    if (checkStatus === 'NON_COMPLIANT') {
      recommendations.push(`建议立即整改${rule.ruleName}相关不合规项`);
    }

    return {
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      checkStatus,
      findings,
      recommendations,
    };
  }

  /**
   * 保存合规检查结果
   */
  async saveComplianceCheckResult(
    enterpriseId: string,
    checkResults: ComplianceCheckResult[]
  ): Promise<void> {
    try {
      for (const result of checkResults) {
        // 查找或创建对应的规则记录
        const rule = await this.prisma.complianceRule.findUnique({
          where: { id: result.ruleId },
        });

        if (!rule) {
          logger.warn('规则不存在，跳过保存', { ruleId: result.ruleId });
          continue;
        }

        // 创建合规检查记录
        await this.prisma.enterpriseComplianceCheck.create({
          data: {
            enterpriseId,
            ruleId: result.ruleId,
            checkDate: new Date(),
            checkResult: result.checkStatus,
            checklistResults:
              result.findings as unknown as Prisma.InputJsonValue[],
          },
        });
      }

      logger.info('合规检查结果保存成功', {
        enterpriseId,
        resultCount: checkResults.length,
      });
    } catch (error) {
      logger.error('保存合规检查结果失败', { error, enterpriseId });
      throw error;
    }
  }

  /**
   * 获取企业的合规检查历史
   */
  async getComplianceCheckHistory(
    enterpriseId: string,
    limit: number = 10
  ): Promise<
    ReturnType<typeof this.prisma.enterpriseComplianceCheck.findMany>
  > {
    try {
      return await this.prisma.enterpriseComplianceCheck.findMany({
        where: { enterpriseId },
        include: {
          rule: true,
        },
        orderBy: { checkDate: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('获取合规检查历史失败', { error, enterpriseId });
      throw error;
    }
  }

  /**
   * 获取企业的合规状态摘要
   */
  async getComplianceSummary(enterpriseId: string): Promise<{
    totalRules: number;
    compliant: number;
    nonCompliant: number;
    partialCompliant: number;
    pendingRemediation: number;
  }> {
    try {
      const checks = await this.prisma.enterpriseComplianceCheck.findMany({
        where: { enterpriseId },
        orderBy: { checkDate: 'desc' },
      });

      // 只取最新的检查结果
      const latestByRule = new Map<string, (typeof checks)[0]>();
      for (const check of checks) {
        if (!latestByRule.has(check.ruleId)) {
          latestByRule.set(check.ruleId, check);
        }
      }

      const latestChecks = Array.from(latestByRule.values());

      const compliant = latestChecks.filter(
        c => c.checkResult === 'COMPLIANT'
      ).length;
      const nonCompliant = latestChecks.filter(
        c => c.checkResult === 'NON_COMPLIANT'
      ).length;
      const partialCompliant = latestChecks.filter(
        c => c.checkResult === 'PARTIAL_COMPLIANT'
      ).length;

      const pendingRemediation =
        await this.prisma.enterpriseComplianceCheck.count({
          where: {
            enterpriseId,
            remediationStatus: { in: ['pending', 'in_progress'] },
          },
        });

      return {
        totalRules: latestChecks.length,
        compliant,
        nonCompliant,
        partialCompliant,
        pendingRemediation,
      };
    } catch (error) {
      logger.error('获取合规状态摘要失败', { error, enterpriseId });
      throw error;
    }
  }
}

export default ComplianceCheckService;
