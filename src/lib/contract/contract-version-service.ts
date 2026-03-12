/**
 * 合同版本管理服务
 * 记录合同的修改历史，支持版本对比和回滚
 */

import { prisma } from '@/lib/db/prisma';
import { ContractStatus, FeeType, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * 合同快照类型（Record类型，用于存储任意 JSON 数据）
 */
export type ContractSnapshot = Record<string, unknown>;

/**
 * 版本对比结果
 */
export interface VersionDiff {
  versionId1: string;
  versionId2: string;
  changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

/**
 * 类型守卫：检查 Json 值是否为合同快照
 */
function isContractSnapshot(value: unknown): value is ContractSnapshot {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 合同版本服务类
 */
export class ContractVersionService {
  /**
   * 创建新版本
   * @param contractId 合同ID
   * @param changeType 变更类型
   * @param createdBy 创建人
   * @param comment 版本说明
   */
  async createVersion(
    contractId: string,
    changeType: 'CREATE' | 'UPDATE' | 'SIGN',
    createdBy: string,
    comment?: string
  ): Promise<void> {
    try {
      // 获取合同当前数据
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          payments: true,
        },
      });

      if (!contract) {
        throw new Error('合同不存在');
      }

      // 获取当前最大版本号
      const lastVersion = await prisma.contractVersion.findFirst({
        where: { contractId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const newVersion = (lastVersion?.version || 0) + 1;

      // 创建快照
      const snapshot = {
        contractNumber: contract.contractNumber,
        clientType: contract.clientType,
        clientName: contract.clientName,
        clientIdNumber: contract.clientIdNumber,
        clientAddress: contract.clientAddress,
        clientContact: contract.clientContact,
        lawFirmName: contract.lawFirmName,
        lawyerName: contract.lawyerName,
        lawyerId: contract.lawyerId,
        caseType: contract.caseType,
        caseSummary: contract.caseSummary,
        scope: contract.scope,
        feeType: contract.feeType,
        totalFee: contract.totalFee.toString(),
        paidAmount: contract.paidAmount.toString(),
        feeDetails: contract.feeDetails,
        terms: contract.terms,
        specialTerms: contract.specialTerms,
        status: contract.status,
        signedAt: contract.signedAt,
        signatureData: contract.signatureData,
        clientSignature: contract.clientSignature,
        clientSignedAt: contract.clientSignedAt,
        lawyerSignature: contract.lawyerSignature,
        lawyerSignedAt: contract.lawyerSignedAt,
        payments: contract.payments.map(p => ({
          id: p.id,
          paymentNumber: p.paymentNumber,
          amount: p.amount.toString(),
          paymentType: p.paymentType,
          paymentMethod: p.paymentMethod,
          status: p.status,
          paidAt: p.paidAt,
        })),
      };

      // 计算变更内容（与上一版本对比）
      let changes:
        | { field: string; oldValue: unknown; newValue: unknown }[]
        | null = null;
      if (lastVersion) {
        const previousVersion = await prisma.contractVersion.findFirst({
          where: { contractId, version: lastVersion.version },
        });

        if (previousVersion && isContractSnapshot(previousVersion.snapshot)) {
          changes = this.calculateChanges(previousVersion.snapshot, snapshot);
        }
      }

      // 创建版本记录
      await prisma.contractVersion.create({
        data: {
          contractId,
          version: newVersion,
          snapshot,
          changes: changes as Prisma.InputJsonValue,
          changeType,
          createdBy,
          comment,
        },
      });

      logger.info(`[ContractVersion] 版本 ${newVersion} 创建成功`);
    } catch (error) {
      logger.error('[ContractVersion] 创建版本失败:', error);
      throw error;
    }
  }

  /**
   * 获取版本列表
   * @param contractId 合同ID
   * @returns 版本列表
   */
  async getVersions(contractId: string) {
    return await prisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        changeType: true,
        createdBy: true,
        createdAt: true,
        comment: true,
        changes: true,
      },
    });
  }

  /**
   * 获取版本详情
   * @param versionId 版本ID
   * @returns 版本详情
   */
  async getVersionDetail(versionId: string) {
    return await prisma.contractVersion.findUnique({
      where: { id: versionId },
    });
  }

  /**
   * 版本对比
   * @param versionId1 版本1 ID
   * @param versionId2 版本2 ID
   * @returns 对比结果
   */
  async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<VersionDiff> {
    const version1 = await prisma.contractVersion.findUnique({
      where: { id: versionId1 },
    });

    const version2 = await prisma.contractVersion.findUnique({
      where: { id: versionId2 },
    });

    if (!version1 || !version2) {
      throw new Error('版本不存在');
    }

    if (
      !isContractSnapshot(version1.snapshot) ||
      !isContractSnapshot(version2.snapshot)
    ) {
      throw new Error('版本快照格式不正确');
    }

    const changes = this.calculateChanges(version1.snapshot, version2.snapshot);

    return {
      versionId1,
      versionId2,
      changes,
    };
  }

  /**
   * 版本回滚
   * @param contractId 合同ID
   * @param versionId 目标版本ID
   * @param createdBy 操作人
   */
  async rollbackToVersion(
    contractId: string,
    versionId: string,
    createdBy: string
  ): Promise<void> {
    const version = await prisma.contractVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.contractId !== contractId) {
      throw new Error('版本不存在或不属于该合同');
    }

    if (!isContractSnapshot(version.snapshot)) {
      throw new Error('版本快照格式不正确');
    }

    const snapshot = version.snapshot;

    // 更新合同数据（使用类型断言处理动态数据）
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        clientType: snapshot.clientType as string | undefined,
        clientName: snapshot.clientName as string | undefined,
        clientIdNumber: snapshot.clientIdNumber as string | undefined,
        clientAddress: snapshot.clientAddress as string | undefined,
        clientContact: snapshot.clientContact as string | undefined,
        lawFirmName: snapshot.lawFirmName as string | undefined,
        lawyerName: snapshot.lawyerName as string | undefined,
        lawyerId: snapshot.lawyerId as string | undefined,
        caseType: snapshot.caseType as string | undefined,
        caseSummary: snapshot.caseSummary as string | undefined,
        scope: snapshot.scope as string | undefined,
        feeType: snapshot.feeType as FeeType | undefined,
        totalFee: snapshot.totalFee as number | string | undefined,
        feeDetails: snapshot.feeDetails as Prisma.InputJsonValue,
        terms: snapshot.terms as Prisma.InputJsonValue,
        specialTerms: snapshot.specialTerms as string | undefined,
        status: snapshot.status as ContractStatus | undefined,
      },
    });

    // 创建回滚版本记录
    await this.createVersion(
      contractId,
      'UPDATE',
      createdBy,
      `回滚到版本 ${version.version}`
    );

    logger.info(`[ContractVersion] 回滚到版本 ${version.version} 成功`);
  }

  /**
   * 计算两个快照之间的变更
   * @param oldSnapshot 旧快照
   * @param newSnapshot 新快照
   * @returns 变更列表
   */
  private calculateChanges(
    oldSnapshot: ContractSnapshot,
    newSnapshot: ContractSnapshot
  ): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    // 需要对比的字段
    const fieldsToCompare = [
      'clientName',
      'clientType',
      'clientIdNumber',
      'clientAddress',
      'clientContact',
      'lawFirmName',
      'lawyerName',
      'caseType',
      'caseSummary',
      'scope',
      'feeType',
      'totalFee',
      'specialTerms',
      'status',
    ];

    for (const field of fieldsToCompare) {
      const oldValue = oldSnapshot[field];
      const newValue = newSnapshot[field];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue,
          newValue,
        });
      }
    }

    return changes;
  }
}

// 导出单例
export const contractVersionService = new ContractVersionService();
