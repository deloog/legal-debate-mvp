/**
 * 咨询转案件服务
 *
 * 提供将咨询记录转化为正式案件的功能：
 * - 数据迁移
 * - 关联建立
 * - 状态更新
 */

import { prisma } from '@/lib/db/prisma';
import { ConsultStatus } from '@/types/consultation';
import { CaseType, CaseStatus } from '@prisma/client';

/**
 * 转化输入参数
 */
export interface ConversionInput {
  consultationId: string;
  userId: string;
  // 案件信息（可选覆盖）
  title?: string;
  description?: string;
  caseType?: CaseType;
  plaintiffName?: string;
  defendantName?: string;
  amount?: number;
  // 客户信息
  createClient?: boolean;
}

/**
 * 转化结果
 */
export interface ConversionResult {
  success: boolean;
  caseId?: string;
  clientId?: string;
  message: string;
}

/**
 * 咨询转案件服务类
 */
export class ConversionService {
  /**
   * 将咨询转化为案件
   */
  public async convertToCase(
    input: ConversionInput
  ): Promise<ConversionResult> {
    try {
      // 1. 查询咨询记录
      const consultation = await prisma.consultation.findFirst({
        where: {
          id: input.consultationId,
          deletedAt: null,
        },
      });

      if (!consultation) {
        return {
          success: false,
          message: '咨询记录不存在',
        };
      }

      // 2. 检查是否已转化
      if (consultation.convertedToCaseId) {
        return {
          success: false,
          message: '该咨询已转化为案件',
        };
      }

      // 3. 确定案件类型
      let caseType = input.caseType || CaseType.CIVIL;
      if (!input.caseType && consultation.caseType) {
        // 尝试根据咨询中的案件类型推断
        const typeMapping: Record<string, CaseType> = {
          劳动争议: CaseType.LABOR,
          劳动: CaseType.LABOR,
          合同纠纷: CaseType.CIVIL,
          合同: CaseType.CIVIL,
          婚姻家庭: CaseType.CIVIL,
          离婚: CaseType.CIVIL,
          刑事: CaseType.CRIMINAL,
          行政: CaseType.ADMINISTRATIVE,
          商事: CaseType.COMMERCIAL,
          知识产权: CaseType.INTELLECTUAL,
        };

        for (const [keyword, type] of Object.entries(typeMapping)) {
          if (consultation.caseType.includes(keyword)) {
            caseType = type;
            break;
          }
        }
      }

      // 4. 使用事务创建案件和更新咨询
      const result = await prisma.$transaction(async tx => {
        // 可选：创建客户记录
        let clientId: string | undefined;
        if (input.createClient && consultation.clientName) {
          const client = await tx.client.create({
            data: {
              userId: input.userId,
              name: consultation.clientName,
              phone: consultation.clientPhone,
              email: consultation.clientEmail,
              company: consultation.clientCompany,
              source: 'ONLINE', // 来自咨询
            },
          });
          clientId = client.id;
        }

        // 创建案件
        const newCase = await tx.case.create({
          data: {
            userId: input.userId,
            title:
              input.title ||
              `${consultation.clientName}${consultation.caseType || ''}案`,
            description: input.description || consultation.caseSummary,
            type: caseType,
            status: CaseStatus.DRAFT,
            plaintiffName: input.plaintiffName || consultation.clientName,
            defendantName: input.defendantName,
            amount: input.amount,
            clientId,
            metadata: {
              consultationId: consultation.id,
              consultNumber: consultation.consultNumber,
              originalCaseType: consultation.caseType,
              aiAssessment: consultation.aiAssessment,
              winRate: consultation.winRate,
              difficulty: consultation.difficulty,
              riskLevel: consultation.riskLevel,
              suggestedFee: consultation.suggestedFee
                ? Number(consultation.suggestedFee)
                : null,
            },
          },
        });

        // 更新咨询记录
        await tx.consultation.update({
          where: { id: consultation.id },
          data: {
            status: ConsultStatus.CONVERTED,
            convertedToCaseId: newCase.id,
            convertedAt: new Date(),
          },
        });

        return {
          caseId: newCase.id,
          clientId,
        };
      });

      return {
        success: true,
        caseId: result.caseId,
        clientId: result.clientId,
        message: '转化成功',
      };
    } catch (error) {
      console.error('转化失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '转化失败',
      };
    }
  }

  /**
   * 获取转化预览数据
   */
  public async getConversionPreview(consultationId: string): Promise<{
    success: boolean;
    data?: {
      consultNumber: string;
      clientName: string;
      clientPhone: string | null;
      clientEmail: string | null;
      caseType: string | null;
      caseSummary: string;
      clientDemand: string | null;
      suggestedTitle: string;
      suggestedCaseType: CaseType;
      winRate: number | null;
      difficulty: string | null;
      riskLevel: string | null;
      suggestedFee: number | null;
    };
    message?: string;
  }> {
    try {
      const consultation = await prisma.consultation.findFirst({
        where: {
          id: consultationId,
          deletedAt: null,
        },
      });

      if (!consultation) {
        return {
          success: false,
          message: '咨询记录不存在',
        };
      }

      if (consultation.convertedToCaseId) {
        return {
          success: false,
          message: '该咨询已转化为案件',
        };
      }

      // 推断案件类型
      let suggestedCaseType = CaseType.CIVIL;
      if (consultation.caseType) {
        const typeMapping: Record<string, CaseType> = {
          劳动争议: CaseType.LABOR,
          劳动: CaseType.LABOR,
          合同纠纷: CaseType.CIVIL,
          合同: CaseType.CIVIL,
          婚姻家庭: CaseType.CIVIL,
          离婚: CaseType.CIVIL,
          刑事: CaseType.CRIMINAL,
          行政: CaseType.ADMINISTRATIVE,
          商事: CaseType.COMMERCIAL,
          知识产权: CaseType.INTELLECTUAL,
        };

        for (const [keyword, type] of Object.entries(typeMapping)) {
          if (consultation.caseType.includes(keyword)) {
            suggestedCaseType = type;
            break;
          }
        }
      }

      return {
        success: true,
        data: {
          consultNumber: consultation.consultNumber,
          clientName: consultation.clientName,
          clientPhone: consultation.clientPhone,
          clientEmail: consultation.clientEmail,
          caseType: consultation.caseType,
          caseSummary: consultation.caseSummary,
          clientDemand: consultation.clientDemand,
          suggestedTitle: `${consultation.clientName}${consultation.caseType || ''}案`,
          suggestedCaseType,
          winRate: consultation.winRate,
          difficulty: consultation.difficulty,
          riskLevel: consultation.riskLevel,
          suggestedFee: consultation.suggestedFee
            ? Number(consultation.suggestedFee)
            : null,
        },
      };
    } catch (error) {
      console.error('获取转化预览失败:', error);
      return {
        success: false,
        message: '获取转化预览失败',
      };
    }
  }
}

/**
 * 创建转化服务实例
 */
export function createConversionService(): ConversionService {
  return new ConversionService();
}
