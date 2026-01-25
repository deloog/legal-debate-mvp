/**
 * 费率配置管理器
 * 负责管理用户自定义的费率配置
 */

import { FeeConfigType, FeeRateConfig, PrismaClient } from '@prisma/client';
import {
  LawyerFeeRateData,
  LitigationFeeRateData,
  TravelExpenseRateData,
  isLawyerFeeRateData,
  isLitigationFeeRateData,
  isTravelExpenseRateData,
} from '../../types/calculation';

export class FeeConfigManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 创建或更新费率配置
   */
  async upsertConfig(
    userId: string,
    type: FeeConfigType,
    name: string,
    data: LawyerFeeRateData | LitigationFeeRateData | TravelExpenseRateData,
    description?: string,
    isDefault: boolean = false
  ): Promise<FeeRateConfig> {
    // 验证数据格式
    this.validateConfigData(type, data);

    // 如果设置为默认配置，先取消该类型的其他默认配置
    if (isDefault) {
      await this.prisma.feeRateConfig.updateMany({
        where: {
          userId,
          configType: type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // 转换 data 为 Prisma 兼容的 Json
    const rateData =
      data as unknown as import('@prisma/client/runtime/library').InputJsonValue;

    return this.prisma.feeRateConfig.upsert({
      where: {
        userId_configType_name: {
          userId,
          configType: type,
          name,
        },
      },
      update: {
        rateData,
        description,
        isDefault,
      },
      create: {
        userId,
        configType: type,
        name,
        description,
        rateData,
        isDefault,
      },
    });
  }

  /**
   * 获取用户的默认配置
   */
  async getDefaultConfig(
    userId: string,
    type: FeeConfigType
  ): Promise<FeeRateConfig | null> {
    return this.prisma.feeRateConfig.findFirst({
      where: {
        userId,
        configType: type,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * 获取用户的所有配置
   */
  async getUserConfigs(
    userId: string,
    type?: FeeConfigType
  ): Promise<FeeRateConfig[]> {
    return this.prisma.feeRateConfig.findMany({
      where: {
        userId,
        ...(type ? { configType: type } : {}),
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * 删除配置（软删除）
   */
  async deleteConfig(userId: string, id: string): Promise<FeeRateConfig> {
    return this.prisma.feeRateConfig.update({
      where: {
        id,
        userId, // 确保只能删除自己的配置
      },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * 验证配置数据格式
   */
  private validateConfigData(type: FeeConfigType, data: unknown): void {
    let isValid = false;

    switch (type) {
      case FeeConfigType.LAWYER_FEE:
        isValid = isLawyerFeeRateData(data);
        break;
      case FeeConfigType.LITIGATION_FEE:
        isValid = isLitigationFeeRateData(data);
        break;
      case FeeConfigType.TRAVEL_EXPENSE:
        isValid = isTravelExpenseRateData(data);
        break;
      case FeeConfigType.OTHER_EXPENSE:
        isValid = true; // 其他费用暂无严格格式限制
        break;
    }

    if (!isValid) {
      throw new Error(`Invalid configuration data for type ${type}`);
    }
  }
}
